import { Button, Circle, Gauge, HStack, Image, ProgressView, Spacer, Text, VStack, ZStack } from '@expo/ui/swift-ui';
import {
  aspectRatio,
  buttonStyle,
  containerBackground,
  contentTransition,
  font,
  foregroundStyle,
  frame,
  buttonBorderShape,
  gaugeStyle,
  kerning,
  minimumScaleFactor,
  monospacedDigit,
  offset,
  opacity,
  resizable,
  tint,
  widgetURL,
} from '@expo/ui/swift-ui/modifiers';
import { createWidget } from 'expo-widgets';

// Ana ekran ve kilit ekranı widget'ı + Damla maskotu.
// Bu fonksiyon widget eklentisinin ayrı JS runtime'ında çalışır: dışarıdaki hiçbir sabite,
// hook'a veya modüle erişemez. Her şey props'tan (uygulamanın gönderdiği snapshot) gelir.
//
// props:
//   date       'YYYY-MM-DD'  totalMl'in ait olduğu gün
//   totalMl    o günün toplamı (widget'tan eklenenler dahil)
//   goalMl     günlük hedef
//   pending    [{ d, ml }]   widget'tan eklenip henüz uygulamaya aktarılmamış miktarlar
//   amounts    [küçük, orta, büyük] hızlı ekleme miktarları
//   sleepAt    'HH:MM'       uyku saati (uykulu mod için)
//   lastAddAt  ISO tarih     son su ekleme (susuz mod için)
//   labels     { title, pctPrefix, sep, moods: { thirsty, normal, happy, celebrate, sleepy } }
const WaterWidget = (props, environment) => {
  'widget';

  const pad = (n) => (n < 10 ? '0' + n : '' + n);
  const now = new Date();
  const today = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());

  const labels = props.labels || {};
  const goal = props.goalMl > 0 ? props.goalMl : 2500;
  // Gece yarısı geçtiyse uygulama açılana kadar bugünü sıfırdan göster
  const total = props.date === today ? props.totalMl || 0 : 0;
  const ratio = Math.min(total / goal, 1);
  const pct = Math.round(ratio * 100);
  const done = total >= goal;
  // Türkçede yüzde işareti başta (%80), İngilizcede sonda (80%)
  const pctText = labels.pctPrefix ? '%' + pct : pct + '%';
  const amounts = props.amounts && props.amounts.length === 3 ? props.amounts : [200, 300, 500];
  const sep = labels.sep || '.';
  const num = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);

  // --- tema (uygulamayla aynı): koyu lacivert + camgöbeği ışık, açık beyaz + su mavisi ---
  const dark = environment.colorScheme === 'dark';
  const C = dark
    ? { bg1: '#14263A', bg2: '#08111A', ink: '#F2F6FA', ink2: '#8C9DAF', accent: '#5AD3F0', onAccent: '#06202B', track: '#1C2D3C', done: '#5FD0A8', dot: 0.5 }
    : { bg1: '#FFFFFF', bg2: '#E9F3FC', ink: '#0F2233', ink2: '#5B6B7A', accent: '#2B8FE8', onAccent: '#FFFFFF', track: '#E3F0FB', done: '#2FA37A', dot: 0.3 };
  const accent = done ? C.done : C.accent;

  // --- Damla'nın modu ---
  const moodNow = () => {
    if (done) return 'celebrate';
    const parts = String(props.sleepAt || '23:00').split(':');
    const sleepMin = Number(parts[0]) * 60 + Number(parts[1] || 0);
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const late = sleepMin >= 720 ? nowMin >= sleepMin || nowMin < 300 : nowMin >= sleepMin && nowMin < 300;
    if (late) return 'sleepy';
    const since = props.lastAddAt && props.date === today ? (now.getTime() - new Date(props.lastAddAt).getTime()) / 3600000 : 99;
    if (ratio < 0.25 || since >= 3) return 'thirsty';
    if (ratio >= 0.75) return 'happy';
    return 'normal';
  };
  const mood = moodNow();
  const moodLine = (labels.moods || {})[mood] || '';

  // Damla: uygulamayla aynı 3B karakter görselleri (widget eklentisindeki asset katalog, plugins/withWidgetMascot.js)
  const mascot = (size) => (
    <Image assetName={'damla_' + mood} modifiers={[resizable(), aspectRatio({ contentMode: 'fit' }), frame({ width: size, height: size })]} />
  );

  // Butona basınca dönen değer widget'ın yeni props'u olur (uygulama kapalıyken bile).
  const addWater = (ml) => {
    const id = 'w' + now.getTime() + '-' + Math.floor(Math.random() * 1e9);
    const pending = (props.pending || []).concat([{ d: today, ml: ml, id: id }]);
    return { date: today, totalMl: total + ml, pending: pending, lastAddAt: new Date().toISOString() };
  };

  const family = environment.widgetFamily;

  // --- Premium değilse kilitli görünüm (dokununca uygulamada Premium ekranı açılır) ---
  if (!props.premium) {
    const lockedTitle = labels.lockedTitle || 'Premium';
    const lockedBody = labels.lockedBody || '';
    if (family === 'accessoryInline') {
      return (
        <HStack spacing={4}>
          <Image systemName="lock.fill" />
          <Text>{(labels.title || 'Su Molası') + ' · Premium'}</Text>
        </HStack>
      );
    }
    if (family === 'accessoryCircular') {
      return (
        <ZStack modifiers={[widgetURL('sumolasi://premium')]}>
          <Gauge value={0} modifiers={[gaugeStyle('circularCapacity')]} />
          <Image systemName="lock.fill" size={14} />
        </ZStack>
      );
    }
    if (family === 'accessoryRectangular') {
      return (
        <VStack alignment="leading" spacing={2} modifiers={[widgetURL('sumolasi://premium')]}>
          <HStack spacing={4}>
            <Image systemName="drop.fill" size={11} />
            <Text modifiers={[font({ weight: 'semibold', size: 11 }), kerning(1)]}>{(labels.title || 'Su Molası').toUpperCase()}</Text>
          </HStack>
          <HStack spacing={4}>
            <Image systemName="lock.fill" size={12} />
            <Text modifiers={[font({ weight: 'bold', size: 15 })]}>{lockedTitle}</Text>
          </HStack>
          <Text modifiers={[font({ weight: 'medium', size: 12 }), opacity(0.7)]}>{lockedBody}</Text>
        </VStack>
      );
    }
    const lockedBg = containerBackground(
      { type: 'linearGradient', colors: [C.bg1, C.bg2], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } },
      'widget'
    );
    return (
      <VStack alignment="leading" spacing={6} modifiers={[lockedBg, widgetURL('sumolasi://premium')]}>
        <Text modifiers={[font({ weight: 'semibold', size: 10 }), kerning(1.6), foregroundStyle(C.accent)]}>{(labels.title || 'Su Molası').toUpperCase()}</Text>
        <Spacer />
        <ZStack modifiers={[frame({ width: 40, height: 40 })]}>
          <Circle modifiers={[foregroundStyle(C.accent), opacity(0.16)]} />
          <Image systemName="lock.fill" color={C.accent} size={17} />
        </ZStack>
        <Text modifiers={[font({ weight: 'bold', size: 17 }), foregroundStyle(C.ink), minimumScaleFactor(0.7)]}>{lockedTitle}</Text>
        <Text modifiers={[font({ weight: 'medium', size: 13 }), foregroundStyle(C.ink2), minimumScaleFactor(0.7)]}>{lockedBody}</Text>
      </VStack>
    );
  }

  // --- Kilit ekranı araç takımları (sistem bunları tek renkli/saydam çizer) ---
  if (family === 'accessoryInline') {
    return (
      <HStack spacing={4}>
        <Image systemName="drop.fill" />
        <Text>{pctText + ' · ' + num(total) + ' ml'}</Text>
      </HStack>
    );
  }

  if (family === 'accessoryCircular') {
    // Halka + ortada yüzde (Gauge etiketleri widget'ta çizilmediği için üstüne bindirilir)
    return (
      <ZStack modifiers={[widgetURL('sumolasi://')]}>
        <Gauge value={ratio} modifiers={[gaugeStyle('circularCapacity')]} />
        <VStack spacing={0}>
          <Image systemName={done ? 'checkmark' : 'drop.fill'} size={10} />
          {!done && <Text modifiers={[font({ weight: 'bold', size: 14 }), monospacedDigit(), minimumScaleFactor(0.6)]}>{String(pct)}</Text>}
        </VStack>
      </ZStack>
    );
  }

  if (family === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={3} modifiers={[widgetURL('sumolasi://')]}>
        <HStack spacing={4}>
          <Image systemName="drop.fill" size={11} />
          <Text modifiers={[font({ weight: 'semibold', size: 11 }), kerning(1)]}>{(labels.title || 'Su Molası').toUpperCase()}</Text>
          <Spacer />
          <Text modifiers={[font({ weight: 'bold', size: 12 }), monospacedDigit()]}>{done ? '✓' : pctText}</Text>
        </HStack>
        <HStack alignment="lastTextBaseline" spacing={3}>
          <Text modifiers={[font({ weight: 'bold', size: 19 }), monospacedDigit(), minimumScaleFactor(0.7)]}>{num(total)}</Text>
          <Text modifiers={[font({ weight: 'medium', size: 12 }), opacity(0.7), minimumScaleFactor(0.7)]}>{'/ ' + num(goal) + ' ml'}</Text>
        </HStack>
        <Gauge value={ratio} modifiers={[gaugeStyle('linearCapacity')]} />
      </VStack>
    );
  }

  // --- Ana ekran ---
  const background = containerBackground(
    { type: 'linearGradient', colors: [C.bg1, C.bg2], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } },
    'widget'
  );
  const addButton = (i, target, width) => (
    <Button target={target} onPress={() => addWater(amounts[i])} modifiers={[buttonStyle('borderedProminent'), buttonBorderShape('capsule'), tint(C.accent)]}>
      <Text modifiers={[font({ weight: 'semibold', size: 14 }), foregroundStyle(C.onAccent), monospacedDigit(), frame(width ? { width: width } : { maxWidth: 200 })]}>
        {'+' + num(amounts[i]) + ' ml'}
      </Text>
    </Button>
  );
  const amountLine = (size) => (
    <HStack alignment="lastTextBaseline" spacing={4}>
      <Text modifiers={[font({ weight: 'bold', size: size }), kerning(-0.8), foregroundStyle(C.ink), monospacedDigit(), minimumScaleFactor(0.6), contentTransition('numericText')]}>
        {num(total)}
      </Text>
      <Text modifiers={[font({ weight: 'medium', size: 12 }), foregroundStyle(C.ink2), minimumScaleFactor(0.7)]}>{'/ ' + num(goal) + ' ml'}</Text>
    </HStack>
  );
  const overline = (
    <Text modifiers={[font({ weight: 'semibold', size: 10 }), kerning(1.6), foregroundStyle(C.accent), minimumScaleFactor(0.8)]}>
      {(labels.title || 'Su Molası').toUpperCase()}
    </Text>
  );
  // Arka planda uygulamanın parçacık dilinden sabit, soluk ışık noktaları
  const dots = (W, H) => (
    <ZStack alignment="topLeading" modifiers={[frame({ width: W, height: H })]}>
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15].map((i) => {
        const sz = 1.6 + ((i * 7) % 5) * 0.45;
        return (
          <Circle
            key={i}
            modifiers={[
              foregroundStyle(C.accent),
              opacity(C.dot * (0.35 + ((i * 13) % 7) / 10)),
              frame({ width: sz, height: sz }),
              offset({ x: (((i * 47 + 13) % 97) / 97) * W, y: (((i * 29 + 31) % 89) / 89) * H }),
            ]}
          />
        );
      })}
    </ZStack>
  );

  if (family === 'systemMedium') {
    return (
      <ZStack alignment="topLeading" modifiers={[background, widgetURL('sumolasi://')]}>
        {dots(320, 140)}
        <HStack spacing={12}>
          <VStack alignment="leading" spacing={4}>
            <HStack>
              {overline}
              <Spacer />
              <Text modifiers={[font({ weight: 'bold', size: 12 }), foregroundStyle(accent), monospacedDigit()]}>{pctText}</Text>
            </HStack>
            <HStack spacing={8}>
              {mascot(56)}
              <Text modifiers={[font({ weight: 'medium', size: 13 }), foregroundStyle(C.ink2), minimumScaleFactor(0.8)]}>{moodLine}</Text>
            </HStack>
            <Spacer />
            {amountLine(26)}
            <ProgressView value={ratio} modifiers={[tint(accent)]} />
          </VStack>
          <VStack spacing={7}>
            {addButton(0, 'add-small', 92)}
            {addButton(1, 'add-medium', 92)}
            {addButton(2, 'add-large', 92)}
          </VStack>
        </HStack>
      </ZStack>
    );
  }

  // systemSmall (varsayılan)
  return (
    <ZStack alignment="topLeading" modifiers={[background, widgetURL('sumolasi://')]}>
      {dots(140, 140)}
      <VStack alignment="leading" spacing={4}>
        <HStack>
          {overline}
          <Spacer />
          <Text modifiers={[font({ weight: 'bold', size: 12 }), foregroundStyle(accent), monospacedDigit()]}>{pctText}</Text>
        </HStack>
        {mascot(46)}
        <Spacer />
        {amountLine(24)}
        <ProgressView value={ratio} modifiers={[tint(accent)]} />
        {addButton(0, 'add-small')}
      </VStack>
    </ZStack>
  );
};

export default createWidget('WaterWidget', WaterWidget, {
  date: '',
  totalMl: 0,
  goalMl: 2500,
  pending: [],
  amounts: [200, 300, 500],
  sleepAt: '23:00',
  lastAddAt: '',
  premium: false,
  labels: { title: 'Su Molası', pctPrefix: true, sep: '.', moods: {}, lockedTitle: 'Premium', lockedBody: '' },
});
