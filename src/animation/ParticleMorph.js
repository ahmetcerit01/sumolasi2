import React, { useEffect, useMemo } from 'react';
import { AppState, Platform } from 'react-native';
import {
  Atlas,
  Canvas,
  Circle,
  Group,
  RadialGradient,
  Skia,
  useRSXformBuffer,
  useColorBuffer,
  useTexture,
  vec,
} from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useFrameCallback, useSharedValue, withTiming } from 'react-native-reanimated';
import { scheduleOnUI } from 'react-native-worklets';
import {
  ATTR,
  OUT,
  RIPPLES,
  RIPPLE_OUT,
  SCENE,
  computeLeads,
  easeInOut,
  makeParticles,
  sceneRipples,
  sceneTarget,
  viaPoint,
} from './particleScenes';

// Parçacık dönüşüm motoru.
//
// - Bütün parçacıklar tek bir Skia Atlas çağrısıyla çizilir (parçacık başına React bileşeni yok).
// - Konumlar her karede UI thread'de hesaplanır (useFrameCallback); React state hiç güncellenmez.
// - Her parçacığın her sahnede analitik bir hedefi var (particleScenes.js). Geçişte eski ve yeni hedef
//   arasında, parçacığa özel gecikmeyle ve iki sahneye özgü bir ara şekilden geçerek (quadratic bezier) akar.
// - Gecikme simetrik tutulur: geçiş yarıda tersine çevrilirse parçacıklar zıplamadan geri döner.
// - Katmanlar: yumuşak ışık halesi, hareket izi (önceki karelerden), parlak çekirdek.
// - Kalite profili: kare süresi uzarsa parçacık sayısı, iz ve hale otomatik azaltılır.
//
// props: width, height, scene (SCENE.*), colors (tema), dark, reduceMotion,
//        transitionMs, entryMs, count, active (false → döngü durur),
//        centerX/centerY/radius (isteğe bağlı: tuval tam ekranken sahneyi bir alana yerleştirmek için)
// Not: kare döngüsü ilk ölçülerle kurulur; ölçü değişirse bileşen key ile yeniden oluşturulmalı.

const SPRITE = 64; // dokudaki her sprite'ın boyu (px)
const STAGGER = 0.4; // geçişin ne kadarı parçacıklara gecikme olarak dağıtılır
const LAYERS = 4; // hale, iz 2, iz 1, çekirdek
const F_STRIDE = 8; // kare verisi: x, y, boyut(px), opaklık, ton, parıltı, önceki x, önceki y

const hexToRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

// Tonu (0..1) 3 duraklı tema paletine çevir: koyu su → su → parlak
const paletteFor = (dark) =>
  dark
    ? [...hexToRgb('#1F8FB8'), ...hexToRgb('#5AD3F0'), ...hexToRgb('#EAFBFF')]
    : [...hexToRgb('#5AABEE'), ...hexToRgb('#2B8FE8'), ...hexToRgb('#0B5CAD')];

export const defaultParticleCount = () => (Platform.OS === 'ios' ? 420 : 300);

export default function ParticleMorph({
  width,
  height,
  scene = SCENE.DROP,
  colors,
  dark,
  reduceMotion = false,
  transitionMs = 950,
  entryMs = 1500,
  count = defaultParticleCount(),
  active = true,
  dim = 0,
  centerX,
  centerY,
  radius,
}) {
  const N = count;
  const attrs = useMemo(() => makeParticles(N), [N]);
  const leads = useMemo(() => computeLeads(attrs, N), [attrs, N]);

  // Sahne merkezi ve ölçeği
  const R = radius ?? Math.min(width * 0.4, height * 0.43);
  const cx = centerX ?? width / 2;
  const cy = centerY ?? height / 2;
  const unit = Math.max(0.9, Math.min(1.4, R / 140));
  const pal = useMemo(() => paletteFor(dark), [dark]);
  const additive = !!dark;

  // Geçiş durumu (hepsi UI thread'de değişir)
  const sFrom = useSharedValue(SCENE.SCATTER);
  const sTo = useSharedValue(SCENE.SCATTER);
  const P = useSharedValue(1);
  const mirror = useSharedValue(0);
  const t0From = useSharedValue(0);
  const t0To = useSharedValue(0);
  const nowS = useSharedValue(0);
  const tBase = useSharedValue(-1);
  const frame = useSharedValue(new Array(N * F_STRIDE).fill(0));
  const ripples = useSharedValue(new Array(RIPPLES * RIPPLE_OUT).fill(0));
  const bloom = useSharedValue(0);
  const canvasOpacity = useSharedValue(reduceMotion ? 0 : 1);
  // dim: sahne arka plana çekildiğinde (ör. form adımları) parçacıklar solar
  const dimLevel = useSharedValue(dim);
  useEffect(() => {
    dimLevel.value = withTiming(dim, { duration: reduceMotion ? 0 : 600 });
  }, [dim]);
  const layerOpacity = useDerivedValue(() => canvasOpacity.value * (1 - dimLevel.value));
  // kalite: 2 tam, 1 orta, 0 düşük
  const quality = useSharedValue(2);
  const perfFrames = useSharedValue(0);
  const perfSum = useSharedValue(0);

  // ---- Kare hesabı -------------------------------------------------------------------
  const compute = (now, dtMs, frozen) => {
    'worklet';
    const prev = frame.value;
    const F = new Array(N * F_STRIDE);
    const q = quality.value;
    const nActive = q === 2 ? N : q === 1 ? Math.floor(N * 0.72) : Math.floor(N * 0.5);
    const from = sFrom.value;
    const to = sTo.value;
    const p = P.value;
    const mir = mirror.value;
    const stFrom = frozen ? 30 : now - t0From.value;
    const stTo = frozen ? 30 : now - t0To.value;
    const t = frozen ? 0 : now;
    const ta = [0, 0, 0, 0, 0, 0, 0];
    const tb = [0, 0, 0, 0, 0, 0, 0];
    const tv = [0, 0];
    const moving = p < 1 && from !== to;

    for (let i = 0; i < N; i++) {
      const o = i * F_STRIDE;
      if (i >= nActive) {
        F[o] = cx;
        F[o + 1] = cy;
        F[o + 2] = 0;
        F[o + 3] = 0;
        F[o + 4] = 0;
        F[o + 5] = 0;
        F[o + 6] = cx;
        F[o + 7] = cy;
        continue;
      }
      sceneTarget(to, attrs, i, t, stTo, tb);
      let x = tb[0];
      let y = tb[1];
      let z = tb[2];
      let size = tb[3];
      let alpha = tb[4];
      let tone = tb[5];
      let glow = tb[6];

      if (moving) {
        const d = attrs[i * ATTR + 7];
        const dd = mir ? 1 - d : d;
        const e = easeInOut(Math.min(1, Math.max(0, (p - dd * STAGGER) / (1 - STAGGER))));
        if (e < 1) {
          sceneTarget(from, attrs, i, t, stFrom, ta);
          viaPoint(from, to, attrs, i, t, ta[0], ta[1], tb[0], tb[1], tv);
          const u = 1 - e;
          x = u * u * ta[0] + 2 * e * u * tv[0] + e * e * tb[0];
          y = u * u * ta[1] + 2 * e * u * tv[1] + e * e * tb[1];
          z = ta[2] + (tb[2] - ta[2]) * e;
          const arc = Math.sin(Math.PI * e);
          // yolun ortasında bazı parçacıklar kameraya yaklaşır: derinlik hissi
          size = (ta[3] + (tb[3] - ta[3]) * e) * (1 + 0.55 * arc * (attrs[i * ATTR + 4] - 0.3));
          alpha = (ta[4] + (tb[4] - ta[4]) * e) * (1 - 0.12 * arc);
          tone = ta[5] + (tb[5] - ta[5]) * e;
          glow = ta[6] + (tb[6] - ta[6]) * e;
        }
      }

      // 2D'de perspektif: öndekiler biraz büyük, parlak ve merkezden uzak
      const persp = 1 + 0.05 * z;
      const px = cx + x * R * persp;
      const py = cy + y * R * persp;
      F[o] = px;
      F[o + 1] = py;
      F[o + 2] = (2 + 3 * size) * unit * (1 + 0.22 * z);
      F[o + 3] = Math.min(1, Math.max(0, alpha * (0.82 + 0.18 * z)));
      F[o + 4] = tone;
      F[o + 5] = glow;
      // iz: önceki karedeki konum (kare süresine göre normalize)
      const k = frozen ? 0 : Math.min(1.5, 16.7 / Math.max(dtMs, 4));
      const ox = prev[o + 2] > 0 ? prev[o] : px;
      const oy = prev[o + 2] > 0 ? prev[o + 1] : py;
      F[o + 6] = px + (ox - px) * k;
      F[o + 7] = py + (oy - py) * k;
    }
    frame.value = F;

    const rip = new Array(RIPPLES * RIPPLE_OUT).fill(0);
    sceneRipples(to, leads, t, stTo, rip, frozen ? 0 : moving ? p * p * p : 1);
    for (let k = 0; k < RIPPLES; k++) {
      const r = k * RIPPLE_OUT;
      rip[r] = cx + rip[r] * R;
      rip[r + 1] = cy + rip[r + 1] * R;
      rip[r + 2] = rip[r + 2] * R;
    }
    ripples.value = rip;
    // arka plandaki hafif ışıma: sahne oturdukça belirginleşir, yavaşça nefes alır
    bloom.value = (moving ? 0.6 + 0.4 * p : 1) * (0.85 + 0.15 * Math.sin(t * 0.9));
  };

  const loop = useFrameCallback((info) => {
    'worklet';
    // saat bileşen başladığında 0'dan başlar (büyük sayılarda trigonometri hassasiyeti kaybolmasın)
    if (tBase.value < 0) tBase.value = info.timestamp;
    const now = (info.timestamp - tBase.value) / 1000 + 0.001;
    nowS.value = now;
    const dt = info.timeSincePreviousFrame ?? 16.7;
    // kalite profili: ilk saniyeden sonra 90 karelik ortalamaya bak, yalnızca düşür
    perfFrames.value += 1;
    if (perfFrames.value > 60) perfSum.value += dt;
    if (perfFrames.value >= 150) {
      if (perfSum.value / 90 > 22 && quality.value > 0) quality.value = quality.value - 1;
      perfFrames.value = 0;
      perfSum.value = 0;
    }
    // döngü başlamadan kurulan geçişin başlangıç zamanı ilk karede belli olur
    if (t0To.value < 0) t0To.value = now;
    if (t0From.value < 0) t0From.value = now;
    compute(now, dt, false);
  }, false);

  // ---- Sahne geçişleri ---------------------------------------------------------------
  const start = (c, dur) => {
    'worklet';
    sFrom.value = sTo.value;
    t0From.value = t0To.value;
    sTo.value = c;
    t0To.value = nowS.value > 0 ? nowS.value : -1;
    mirror.value = 0;
    P.value = 0;
    P.value = withTiming(1, { duration: dur, easing: Easing.linear });
  };

  const goTo = (c, dur) => {
    'worklet';
    if (c === sTo.value) {
      if (P.value < 1) P.value = withTiming(1, { duration: dur * (1 - P.value), easing: Easing.linear });
      return;
    }
    if (c === sFrom.value && P.value < 1) {
      // yarıda geri dönüş: aynı yoldan, zıplamadan geri akar
      sFrom.value = sTo.value;
      sTo.value = c;
      const tf = t0From.value;
      t0From.value = t0To.value;
      t0To.value = tf;
      mirror.value = 1 - mirror.value;
      const rest = P.value;
      P.value = 1 - rest;
      P.value = withTiming(1, { duration: dur * rest, easing: Easing.linear });
      return;
    }
    if (P.value < 1) {
      // üçüncü bir sahneye hızlı atlama: mevcut geçişi kısaca tamamla, sonra yenisine akıt
      P.value = withTiming(1, { duration: 60 + 160 * (1 - P.value), easing: Easing.linear }, (done) => {
        if (done) start(c, dur);
      });
      return;
    }
    start(c, dur);
  };

  // Hareketi Azalt: uzun yolculuk ve döngü yok; kısa saydamlık geçişiyle sabit şekiller
  const jumpStatic = (c) => {
    'worklet';
    canvasOpacity.value = withTiming(0, { duration: 140 }, () => {
      sFrom.value = c;
      sTo.value = c;
      P.value = 1;
      compute(0, 16.7, true);
      canvasOpacity.value = withTiming(1, { duration: 220 });
    });
  };

  const first = useSharedValue(true);
  useEffect(() => {
    // görünmezken (ör. splash'in arkasında) giriş animasyonu boşa oynamasın
    if (!active) return;
    scheduleOnUI(() => {
      'worklet';
      if (reduceMotion) {
        jumpStatic(scene);
        return;
      }
      if (first.value) {
        first.value = false;
        // giriş: dağınık tozdan ilk şekle
        start(scene, entryMs);
      } else {
        goTo(scene, transitionMs);
      }
    });
  }, [scene, reduceMotion, active]);

  // Döngü yalnızca ekran görünür ve uygulama ön plandayken çalışır
  useEffect(() => {
    const run = active && !reduceMotion && AppState.currentState === 'active';
    loop.setActive(run);
    const sub = AppState.addEventListener('change', (s) => loop.setActive(active && !reduceMotion && s === 'active'));
    return () => {
      sub.remove();
      loop.setActive(false);
    };
  }, [active, reduceMotion]);

  // ---- Çizim -------------------------------------------------------------------------
  const texture = useTexture(
    <Group>
      <Circle cx={32} cy={32} r={32}>
        <RadialGradient
          c={vec(32, 32)}
          r={32}
          colors={['#FFFFFFFF', '#FFFFFF73', '#FFFFFF1F', '#FFFFFF00']}
          positions={[0, 0.18, 0.5, 1]}
        />
      </Circle>
      <Circle cx={96} cy={32} r={32}>
        <RadialGradient
          c={vec(96, 32)}
          r={32}
          colors={['#FFFFFFFF', '#FFFFFFF0', '#FFFFFF66', '#FFFFFF00']}
          positions={[0, 0.32, 0.6, 1]}
        />
      </Circle>
    </Group>,
    { width: SPRITE * 2, height: SPRITE }
  );

  const sprites = useMemo(() => {
    const halo = Skia.XYWHRect(0, 0, SPRITE, SPRITE);
    const core = Skia.XYWHRect(SPRITE, 0, SPRITE, SPRITE);
    return new Array(N * LAYERS).fill(0).map((_, idx) => (idx < N ? halo : core));
  }, [N]);

  const transforms = useRSXformBuffer(N * LAYERS, (val, idx) => {
    'worklet';
    const F = frame.value;
    const layer = Math.floor(idx / N);
    const o = (idx - layer * N) * F_STRIDE;
    let x = F[o];
    let y = F[o + 1];
    let diam = F[o + 2];
    if (layer === 0) {
      diam *= 5.5;
    } else if (layer === 1) {
      x = x + (F[o + 6] - x) * 2;
      y = y + (F[o + 7] - y) * 2;
      diam *= 0.6;
    } else if (layer === 2) {
      x = F[o + 6];
      y = F[o + 7];
      diam *= 0.8;
    }
    const s = diam / SPRITE;
    val.set(s, 0, x - (SPRITE / 2) * s, y - (SPRITE / 2) * s);
  });

  const haloBase = additive ? 0.3 : 0.2;
  const colorsBuf = useColorBuffer(N * LAYERS, (val, idx) => {
    'worklet';
    const F = frame.value;
    const layer = Math.floor(idx / N);
    const o = (idx - layer * N) * F_STRIDE;
    const tone = F[o + 4];
    // 3 duraklı ton
    const seg = tone < 0.5 ? 0 : 3;
    const f = tone < 0.5 ? tone * 2 : (tone - 0.5) * 2;
    val[0] = pal[seg] + (pal[seg + 3] - pal[seg]) * f;
    val[1] = pal[seg + 1] + (pal[seg + 4] - pal[seg + 1]) * f;
    val[2] = pal[seg + 2] + (pal[seg + 5] - pal[seg + 2]) * f;
    let a = F[o + 3];
    if (layer === 0) {
      a *= (quality.value === 2 ? 0.05 : 0) + haloBase * F[o + 5];
    } else if (layer < 3) {
      // iz yalnızca hareket ederken görünür
      const dx = F[o + 6] - F[o];
      const dy = F[o + 7] - F[o + 1];
      const m = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 3);
      const g = quality.value === 2 ? 2 : quality.value;
      a *= m * (layer === 1 ? (g >= 2 ? 0.2 : 0) : g >= 1 ? 0.42 : 0);
    }
    val[3] = a;
  });

  // halka dalgaları
  const ring = (k) => ({
    transform: useDerivedValue(() => {
      const r = ripples.value;
      const q = k * RIPPLE_OUT;
      return [{ translateX: r[q] }, { translateY: r[q + 1] }, { rotate: r[q + 4] }, { scaleY: Math.max(0.05, r[q + 3]) }];
    }),
    radius: useDerivedValue(() => Math.max(0.1, ripples.value[k * RIPPLE_OUT + 2])),
    opacity: useDerivedValue(() => ripples.value[k * RIPPLE_OUT + 5]),
  });
  const rings = [ring(0), ring(1), ring(2)];
  const ringColor = dark ? '#9FE6F7' : colors.accent;

  return (
    <Canvas style={{ width, height }}>
      <Group opacity={layerOpacity}>
      {/* kontrollü bloom: yalnızca koyu temada (açık zeminde düşük alfa gradyan bantlaşıyor) */}
      {dark && <Group opacity={bloom}>
        <Circle cx={cx} cy={cy} r={R * 1.5}>
          <RadialGradient
            c={vec(cx, cy)}
            r={R * 1.5}
            colors={['rgba(90,211,240,0.16)', 'rgba(90,211,240,0.05)', 'rgba(90,211,240,0)']}
            positions={[0, 0.45, 1]}
          />
        </Circle>
      </Group>}
      <Group blendMode={additive ? 'plus' : 'srcOver'}>
        <Atlas image={texture} sprites={sprites} transforms={transforms} colors={colorsBuf} colorBlendMode="modulate" />
      </Group>
      {rings.map((r, k) => (
        <Group key={k} transform={r.transform} opacity={r.opacity}>
          <Circle cx={0} cy={0} r={r.radius} color={ringColor} style="stroke" strokeWidth={1.4} />
        </Group>
      ))}
      </Group>
    </Canvas>
  );
}
