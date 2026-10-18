// Parçacık sahneleri: her parçacığın her sahnedeki hedefi (zamanın fonksiyonu olarak).
//
// Koordinatlar "birim" uzayında: merkez (0,0), y aşağı, 1 birim = sahne yarıçapı (R).
// Bütün fonksiyonlar worklet: UI thread'de, her karede, React'e dokunmadan çalışır.
// Rastgelelik yok: her parçacığın özellikleri makeParticles() ile sabit tohumdan bir kez üretilir.

import { GLASS_INSET_RATIO } from '../components/SkiaGlass';

export const SCENE = {
  SCATTER: 0, // dağınık ışık tozu (giriş)
  DROP: 1, // A: su damlası
  RHYTHM: 2, // B: çekirdek + yörüngeler
  GLASS: 3, // C: dolan bardak
  TUBES: 4, // splash: iki tüp = "mola" (duraklat) simgesi
};

// Parçacık başına sabit değerler (ATTR adet): a, b, c, d, e (0..1), faz (0..2π), boyut, gecikme
export const ATTR = 8;
// Sahne çıktısı (OUT adet): x, y, z (-1..1 derinlik), boyut, opaklık, ton (0 koyu su .. 1 parlak), parıltı
export const OUT = 7;

const TAU = Math.PI * 2;

// mulberry32: küçük, deterministik PRNG
function prng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeParticles(count, seed = 7) {
  const rnd = prng(seed);
  const attrs = new Array(count * ATTR);
  for (let i = 0; i < count; i++) {
    const o = i * ATTR;
    attrs[o] = rnd();
    attrs[o + 1] = rnd();
    attrs[o + 2] = rnd();
    attrs[o + 3] = rnd();
    attrs[o + 4] = rnd();
    attrs[o + 5] = rnd() * TAU;
    // çoğu küçük, azı büyük: toz + birkaç belirgin ışık
    attrs[o + 6] = 0.35 + Math.pow(rnd(), 2.2) * 1.3;
    attrs[o + 7] = rnd();
  }
  return attrs;
}

// ---- Geometri sabitleri -------------------------------------------------------------

// B: üç yörünge (yarıçap, eğim, ekran düzlemindeki dönüş, açısal hız)
export const RINGS = [
  { r: 0.42, incl: 1.16, rot: -0.42, w: 0.3 },
  { r: 0.68, incl: 1.22, rot: 0.38, w: 0.2 },
  { r: 0.94, incl: 1.1, rot: 1.2, w: 0.13 },
];
const SIP_SPEED = 2.2; // "yudum" ışıkları yörüngedeki tozdan hızlı akar

// C: SkiaGlass ile aynı oranlarda bardak (ağız geniş, taban GLASS_INSET_RATIO kadar dar)
const G_TOP = -0.62;
const G_BOT = 0.96;
const G_HW_TOP = 0.6;
const G_HW_BOT = G_HW_TOP * (1 - 2 * GLASS_INSET_RATIO);
const G_FILL_END = 3.2; // sahneye girişten kaç sn sonra bardak dolmuş olur
const G_DROP_START = -1.12;

// Splash: iki kapsül tüp
const T_CX = 0.32;
const T_HW = 0.16;
const T_TOP = -0.74;
const T_BOT = 0.74;

// ---- Yardımcılar --------------------------------------------------------------------

const clamp01 = (v) => {
  'worklet';
  return v < 0 ? 0 : v > 1 ? 1 : v;
};
export const easeInOut = (v) => {
  'worklet';
  return v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2;
};
const fract = (v) => {
  'worklet';
  return v - Math.floor(v);
};

// Damla konturu: θ=0 tepedeki sivri uç, alt kısım yuvarlak
const dropX = (th) => {
  'worklet';
  return 0.8 * Math.sin(th) * Math.sin(th / 2);
};
const dropY = (th) => {
  'worklet';
  return -Math.cos(th) * 0.98 + 0.04;
};

const glassHalfW = (y) => {
  'worklet';
  return G_HW_TOP + (G_HW_BOT - G_HW_TOP) * clamp01((y - G_TOP) / (G_BOT - G_TOP));
};
export const glassLevel = (st) => {
  'worklet';
  return 0.12 + 0.68 * easeInOut(clamp01((st - 0.45) / (G_FILL_END - 0.45)));
};
const glassSurfaceY = (x, t, level) => {
  'worklet';
  return G_BOT - level * (G_BOT - G_TOP) + 0.032 * Math.sin(x * 5 + t * 2.1) + 0.016 * Math.sin(x * 9 - t * 3.2);
};
// Düşen damlaların döngüsü; bardak dolduktan sonra seyrekleşir (son durum düşük yoğunluklu)
const fallPeriod = (b, st) => {
  'worklet';
  return (2.4 + 1.6 * b) * (st > G_FILL_END + 1 ? 2.2 : 1);
};
const FALL_PORTION = 0.32; // döngünün düşüşe ayrılan kısmı

export const tubesLevel = (st) => {
  'worklet';
  return easeInOut(clamp01((st - 0.95) / 1.5));
};

// ---- Sahne hedefi ---------------------------------------------------------------------
// t: genel saat (sn), st: bu sahne hedef olalı geçen süre (sn)

export function sceneTarget(scene, A, i, t, st, o) {
  'worklet';
  const p = i * ATTR;
  const a = A[p];
  const b = A[p + 1];
  const c = A[p + 2];
  const d = A[p + 3];
  const e = A[p + 4];
  const ph = A[p + 5];
  const sz = A[p + 6];
  let x = 0;
  let y = 0;
  let z = 0;
  let size = sz;
  let alpha = 1;
  let tone = 0.5;
  let glow = 0;

  if (scene === 1) {
    // A — su damlası
    const breathe = 1 + 0.028 * Math.sin(t * 1.5);
    if (a < 0.3) {
      // kontur: parlak, kenar boyunca yavaşça kayan ışık
      // damla eğrisi yalnızca 0..2π aralığında tanımlı (sin(θ/2) işaret değiştirmesin)
      const th = (b * TAU + t * 0.05) % TAU;
      const n = 1 + 0.014 * Math.sin(t * 2 + ph);
      x = dropX(th) * n;
      y = dropY(th) * n;
      z = Math.cos(th) * 0.3;
      size = 0.85 + 0.6 * sz;
      alpha = 0.92;
      tone = 0.82 + 0.15 * e;
      glow = e > 0.62 ? 1 : 0;
    } else {
      // iç dolgu: küçük, yavaş dönen parçacıklar
      const th = ((b * TAU + t * 0.09 * (d - 0.5) * 2) % TAU + TAU) % TAU;
      const rr = Math.sqrt(c) * 0.9;
      const cx = 0;
      const cy = 0.36;
      x = cx + (dropX(th) - cx) * rr + 0.018 * Math.sin(t * 0.8 + ph);
      y = cy + (dropY(th) - cy) * rr + 0.018 * Math.cos(t * 0.7 + ph);
      z = (c - 0.5) * 1.2;
      size = 0.4 + 0.5 * sz;
      alpha = 0.42 + 0.4 * e;
      tone = 0.2 + 0.55 * (1 - c);
      glow = 0.3; // su gövdesi: hafif hale ile yumuşak hacim
    }
    x *= breathe;
    y *= breathe;
  } else if (scene === 2) {
    // B — parlak çekirdek ve çevresinde organik yörüngeler
    if (a < 0.22) {
      const ang = c * TAU + t * 0.45;
      const rr = 0.17 * Math.pow(b, 0.7) * (1 + 0.08 * Math.sin(t * 2.1 + ph));
      x = Math.cos(ang) * rr;
      y = Math.sin(ang) * rr;
      z = (d - 0.5) * 0.4;
      size = 0.6 + 0.8 * sz;
      alpha = 0.85;
      tone = 0.92;
      glow = e > 0.55 ? 1 : 0;
    } else {
      const k = Math.floor(b * 3) % 3;
      const ring = RINGS[k];
      const sip = a < 0.3;
      const th = c * TAU + ring.w * t * (sip ? SIP_SPEED : 1);
      const r = ring.r * (1 + 0.035 * Math.sin(3 * th + t * 0.7 + k)) + (sip ? 0 : (d - 0.5) * 0.05);
      const px = r * Math.cos(th);
      const py = r * Math.sin(th) * Math.cos(ring.incl);
      z = Math.sin(th) * Math.sin(ring.incl) / ring.r;
      const cr = Math.cos(ring.rot);
      const sr = Math.sin(ring.rot);
      x = px * cr - py * sr;
      y = px * sr + py * cr;
      if (sip) {
        size = 1.25 + 0.5 * sz;
        alpha = 1;
        tone = 0.9;
        glow = 1;
      } else {
        size = 0.45 + 0.45 * sz;
        alpha = (0.45 + 0.35 * e) * (0.7 + 0.3 * z);
        tone = 0.45 + 0.2 * e;
      }
    }
  } else if (scene === 3) {
    // C — bardak, yükselen su, düşen damlalar
    const level = glassLevel(st);
    if (a < 0.26) {
      // bardak konturu: sol duvar, taban, sağ duvar
      const s = b * 4.15;
      const hgt = G_BOT - G_TOP;
      if (s < 1.58) {
        y = G_TOP + (s / 1.58) * hgt;
        x = -glassHalfW(y);
      } else if (s < 2.57) {
        y = G_BOT;
        x = -G_HW_BOT + ((s - 1.58) / 0.99) * 2 * G_HW_BOT;
      } else {
        y = G_BOT - ((s - 2.57) / 1.58) * hgt;
        x = glassHalfW(y);
      }
      x += 0.008 * Math.sin(t * 1.7 + ph);
      z = 0.2;
      size = 0.6 + 0.45 * sz;
      alpha = 0.7;
      tone = 0.72;
    } else if (a < 0.84) {
      // su gövdesi
      const xn = (d * 2 - 1) * 0.9;
      const surf = glassSurfaceY(xn * G_HW_TOP, t, level);
      y = G_BOT - 0.04 + (surf - G_BOT + 0.07) * Math.pow(c, 0.85);
      x = xn * glassHalfW(y) + 0.02 * Math.sin(t * 0.7 + ph);
      z = (e - 0.5) * 0.8;
      size = 0.45 + 0.55 * sz;
      alpha = 0.5 + 0.35 * e;
      tone = 0.15 + 0.55 * c;
      glow = 0.3;
    } else if (a < 0.95) {
      // su yüzeyi: parlak dalga çizgisi
      const xn = (b * 2 - 1) * 0.94;
      const yy = glassSurfaceY(xn * G_HW_TOP, t, level);
      x = xn * glassHalfW(yy);
      y = yy;
      z = (c - 0.5) * 0.5;
      size = 0.7 + 0.4 * sz;
      alpha = 0.9;
      tone = 0.93;
      glow = e > 0.5 ? 1 : 0;
    } else {
      // yüzeye düşen damlalar
      const u = fract(st / fallPeriod(b, st) + c);
      const xn = (d * 2 - 1) * 0.5;
      x = xn * G_HW_TOP;
      const surf = glassSurfaceY(x, t, level);
      if (u < FALL_PORTION) {
        const q = u / FALL_PORTION;
        y = G_DROP_START + (surf - G_DROP_START) * q * q;
        alpha = clamp01(q * 6);
      } else {
        y = surf;
        alpha = 0;
      }
      size = 1.05;
      tone = 0.95;
      glow = 1;
    }
    // doldu: bardak boyunca bir kez süzülen ışık vurgusu
    const g = (st - G_FILL_END) / 0.9;
    if (g > 0 && g < 1) {
      const band = x + y * 0.45 - (-1.3 + 2.8 * g);
      const k = Math.max(0, 1 - Math.abs(band) / 0.2);
      alpha = Math.min(1, alpha + k * 0.7);
      tone = tone + (1 - tone) * k;
      if (k > 0.5) glow = 1;
    }
  } else if (scene === 4) {
    // Splash — iki kapsül tüp, alttan dolan su
    const side = c < 0.5 ? -1 : 1;
    const cx = side * T_CX;
    const level = tubesLevel(st);
    const surf = T_BOT - level * (T_BOT - T_TOP) + 0.025 * Math.sin(t * 2.4 + side);
    if (a < 0.3) {
      // kapsül çevresi
      const straight = T_BOT - T_TOP - 2 * T_HW;
      const per = 2 * straight + TAU * T_HW;
      const s = b * per;
      if (s < straight) {
        x = cx + T_HW;
        y = T_TOP + T_HW + s;
      } else if (s < straight + Math.PI * T_HW) {
        const an = (s - straight) / T_HW;
        x = cx + T_HW * Math.cos(an);
        y = T_BOT - T_HW + T_HW * Math.sin(an);
      } else if (s < 2 * straight + Math.PI * T_HW) {
        x = cx - T_HW;
        y = T_BOT - T_HW - (s - straight - Math.PI * T_HW);
      } else {
        const an = Math.PI + (s - 2 * straight - Math.PI * T_HW) / T_HW;
        x = cx + T_HW * Math.cos(an);
        y = T_TOP + T_HW + T_HW * Math.sin(an);
      }
      size = 0.6 + 0.5 * sz;
      alpha = 0.75;
      tone = 0.7;
      glow = e > 0.8 ? 1 : 0;
    } else {
      // iç dolgu: suyun altında parlak, üstünde soluk toz; birkaçı kabarcık gibi yükselir
      x = cx + (d * 2 - 1) * (T_HW - 0.04);
      if (e > 0.94 && level > 0.05) {
        y = T_BOT - 0.06 - fract(t * 0.35 + ph) * (T_BOT - 0.06 - surf);
      } else {
        y = T_TOP + 0.06 + b * (T_BOT - T_TOP - 0.12);
      }
      const under = y > surf;
      size = 0.4 + 0.55 * sz;
      alpha = under ? 0.55 + 0.35 * e : 0.1;
      tone = under ? 0.25 + 0.5 * (1 - (y - surf) / (T_BOT - T_TOP)) : 0.6;
      glow = under ? 0.35 : 0;
      if (under && Math.abs(y - surf) < 0.035) {
        tone = 0.95;
        glow = 1;
      }
    }
    z = (e - 0.5) * 0.5;
  } else {
    // 0 — dağınık toz bulutu: yavaş sürüklenme, hafif parıldama
    const ang = a * TAU + t * 0.03 * (c - 0.5);
    const rad = 0.35 + 1.3 * Math.sqrt(b);
    x = Math.cos(ang) * rad * 1.05 + 0.04 * Math.sin(t * 0.5 + ph);
    y = Math.sin(ang) * rad * 1.3;
    z = d * 2 - 1;
    size = 0.3 + 0.6 * sz;
    alpha = (0.25 + 0.35 * e) * (0.75 + 0.25 * Math.sin(t * 1.3 + ph));
    tone = 0.3 + 0.5 * c;
  }

  o[0] = x;
  o[1] = y;
  o[2] = z;
  o[3] = size;
  o[4] = alpha;
  o[5] = tone;
  o[6] = glow;
}

// İki sahne arasındaki ara şekil (geçişin ortasında en çok görünen form).
// Simetrik: A→B ve B→A aynı yoldan geçer, böylece geri dönüşler de akıcı olur.
export function viaPoint(from, to, A, i, t, ax, ay, bx, by, o) {
  'worklet';
  const p = i * ATTR;
  const a = A[p];
  const b = A[p + 1];
  const c = A[p + 2];
  // yönden bağımsız olsun: her zaman küçük indeksli sahneden büyüğe doğru hesapla
  if (from > to) {
    let tmp = ax;
    ax = bx;
    bx = tmp;
    tmp = ay;
    ay = by;
    by = tmp;
  }
  const lo = from < to ? from : to;
  const hi = from < to ? to : from;
  if (lo === 1 && hi === 2) {
    // damla, parlak çekirdeğe çöker; oradan yörüngeler açılır
    o[0] = (ax + bx) * 0.14;
    o[1] = (ay + by) * 0.14;
  } else if (lo === 2 && hi === 3) {
    // yörüngeler genişleyip yatay bir su dalgasına dönüşür
    const xn = a * 2 - 1;
    o[0] = xn * 1.35;
    o[1] = 0.12 + 0.1 * Math.sin(xn * 6 + t * 2) + (b - 0.5) * 0.08;
  } else if (hi === 4) {
    // splash: toz önce tek bir ışık sütununda birleşir, sonra iki tüpe ayrılır
    o[0] = (b - 0.5) * 0.22;
    o[1] = (c * 2 - 1) * 0.72;
  } else if (lo === 0) {
    // dağınık tozdan belirsiz bir ışık bulutuna
    const ang = a * TAU;
    const r = 0.32 * Math.sqrt(c);
    o[0] = Math.cos(ang) * r;
    o[1] = Math.sin(ang) * r * 1.15;
  } else {
    // diğer çiftler: orta nokta + hafif savrulma
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;
    const sw = (b - 0.5) * 0.5;
    o[0] = mx - (by - ay) * sw;
    o[1] = my + (bx - ax) * sw;
  }
}

// Halka dalgaları (en fazla 3): sahneye göre [cx, cy, r, basıklık, açı, opaklık]
export const RIPPLES = 3;
export const RIPPLE_OUT = 6;

export function sceneRipples(scene, leads, t, st, out, weight) {
  'worklet';
  for (let k = 0; k < RIPPLES; k++) {
    const q = k * RIPPLE_OUT;
    if (scene === 2) {
      // yudum ışığı çekirdeğin önünden geçerken yörünge düzleminde halka
      const ring = RINGS[k];
      const w = ring.w * SIP_SPEED;
      const since = fract((ring.w * SIP_SPEED * t + leads[k] - Math.PI / 2) / TAU) * (TAU / w);
      const prog = since / 1.5;
      if (prog < 1 && weight > 0) {
        out[q] = 0;
        out[q + 1] = 0;
        out[q + 2] = 0.16 + 0.55 * prog;
        out[q + 3] = Math.cos(ring.incl);
        out[q + 4] = ring.rot;
        out[q + 5] = (1 - prog) * (1 - prog) * 0.55 * weight;
        continue;
      }
    } else if (scene === 3 && k < 2) {
      // damla su yüzeyine çarpınca genişleyen halka
      const L = leads[3 + k * 4];
      const per = fallPeriod(leads[4 + k * 4], st);
      const u = fract(st / per + leads[5 + k * 4]);
      const prog = (u - FALL_PORTION) / 0.3;
      if (prog > 0 && prog < 1 && weight > 0) {
        const x = L * G_HW_TOP;
        out[q] = x;
        out[q + 1] = glassSurfaceY(x, t, glassLevel(st));
        out[q + 2] = 0.03 + 0.3 * prog;
        out[q + 3] = 0.28;
        out[q + 4] = 0;
        out[q + 5] = (1 - prog) * 0.7 * weight;
        continue;
      }
    }
    out[q + 5] = 0;
  }
}

// Halkaları gerçek parçacıklarla eşleştirmek için "öncü" parçacıkların değerleri (JS'te bir kez)
export function computeLeads(A, count) {
  const leads = new Array(11).fill(0);
  const ringFound = [false, false, false];
  let falls = 0;
  for (let i = 0; i < count; i++) {
    const p = i * ATTR;
    const a = A[p];
    if (a >= 0.22 && a < 0.3) {
      const k = Math.floor(A[p + 1] * 3) % 3;
      if (!ringFound[k]) {
        ringFound[k] = true;
        leads[k] = A[p + 2] * TAU;
      }
    }
    if (a >= 0.95 && falls < 2) {
      // [3+k*4] konum, [4+k*4] periyot tohumu, [5+k*4] faz
      leads[3 + falls * 4] = (A[p + 3] * 2 - 1) * 0.5;
      leads[4 + falls * 4] = A[p + 1];
      leads[5 + falls * 4] = A[p + 2];
      falls++;
    }
  }
  return leads;
}
