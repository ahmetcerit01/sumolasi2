import {
  Button,
  Capsule,
  Circle,
  Ellipse,
  Gauge,
  HStack,
  Image,
  ProgressView,
  Spacer,
  Text,
  UnevenRoundedRectangle,
  VStack,
  ZStack,
} from '@expo/ui/swift-ui';
import {
  buttonStyle,
  clipped,
  containerBackground,
  contentTransition,
  font,
  foregroundStyle,
  frame,
  gaugeStyle,
  minimumScaleFactor,
  monospacedDigit,
  offset,
  opacity,
  rotationEffect,
  scaleEffect,
  strokeBorder,
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

  // --- tema ---
  const dark = environment.colorScheme === 'dark';
  const C = dark
    ? { bg1: '#122230', bg2: '#0E1C28', ink: '#EAF3FA', ink2: '#9DB0C0', accent: '#5AB2FF', onAccent: '#0B1620', track: '#16324A', done: '#4CC79A' }
    : { bg1: '#FFFFFF', bg2: '#EEF6FC', ink: '#0F2233', ink2: '#5B6B7A', accent: '#2B8FE8', onAccent: '#FFFFFF', track: '#E3F0FB', done: '#2FA37A' };
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

  // Damla: 160pt'lik tuvalde şekiller, `size` ile ölçeklenir (uygulamadaki Mascot ile aynı geometri)
  const mascot = (size) => {
    const INK = '#0F2233';
    const BODY = { thirsty: '#AFCFEA', normal: '#4FA9F0', happy: '#3A9BF2', celebrate: '#2B8FE8', sleepy: '#4A79A8' };
    const at = (x, y, w, h) => [frame({ width: w, height: h }), offset({ x: x, y: y })];
    // yay (gülümseme / kapalı göz): halkanın yarısı görünür
    const arc = (x, y, w, up) => (
      <ZStack alignment="top" modifiers={[frame({ width: w, height: w / 2 }), clipped(), offset({ x: x, y: y })]}>
        <Circle
          modifiers={[
            foregroundStyle('#00000000'),
            strokeBorder({ color: INK, style: { lineWidth: 3 }, shape: 'circle' }),
            frame({ width: w, height: w }),
            offset({ x: 0, y: up ? 0 : -w / 2 }),
          ]}
        />
      </ZStack>
    );
    const eyesHappy = mood === 'happy' || mood === 'celebrate';
    return (
      <ZStack modifiers={[frame({ width: size, height: size })]}>
        <ZStack alignment="topLeading" modifiers={[frame({ width: 160, height: 160 }), scaleEffect(size / 160)]}>
          <UnevenRoundedRectangle
            topLeadingRadius={0}
            topTrailingRadius={54}
            bottomLeadingRadius={54}
            bottomTrailingRadius={54}
            modifiers={[foregroundStyle(BODY[mood]), frame({ width: 108, height: 108 }), rotationEffect(45), offset({ x: 26, y: 40 })]}
          />
          <Ellipse modifiers={[foregroundStyle('#FFFFFF'), opacity(0.55), frame({ width: 16, height: 26 }), rotationEffect(-22), offset({ x: 50, y: 66 })]} />

          {eyesHappy && <Ellipse modifiers={[foregroundStyle('#FF9DB5'), opacity(0.75), ...at(44, 112, 15, 8)]} />}
          {eyesHappy && <Ellipse modifiers={[foregroundStyle('#FF9DB5'), opacity(0.75), ...at(101, 112, 15, 8)]} />}

          {mood === 'normal' && <Ellipse modifiers={[foregroundStyle(INK), ...at(60, 92, 10, 14)]} />}
          {mood === 'normal' && <Ellipse modifiers={[foregroundStyle(INK), ...at(90, 92, 10, 14)]} />}
          {mood === 'normal' && <Circle modifiers={[foregroundStyle('#FFFFFF'), ...at(62, 94, 3, 3)]} />}
          {mood === 'normal' && <Circle modifiers={[foregroundStyle('#FFFFFF'), ...at(92, 94, 3, 3)]} />}
          {eyesHappy && arc(57, 95, 14, true)}
          {eyesHappy && arc(88, 95, 14, true)}
          {mood === 'thirsty' && <UnevenRoundedRectangle bottomLeadingRadius={7} bottomTrailingRadius={7} modifiers={[foregroundStyle(INK), ...at(59, 97, 12, 7)]} />}
          {mood === 'thirsty' && <UnevenRoundedRectangle bottomLeadingRadius={7} bottomTrailingRadius={7} modifiers={[foregroundStyle(INK), ...at(89, 97, 12, 7)]} />}
          {mood === 'thirsty' && <Capsule modifiers={[foregroundStyle(INK), frame({ width: 15, height: 3 }), rotationEffect(-14), offset({ x: 56, y: 90 })]} />}
          {mood === 'thirsty' && <Capsule modifiers={[foregroundStyle(INK), frame({ width: 15, height: 3 }), rotationEffect(14), offset({ x: 89, y: 90 })]} />}
          {mood === 'sleepy' && arc(57, 94, 15, false)}
          {mood === 'sleepy' && arc(87, 94, 15, false)}

          {(mood === 'normal' || mood === 'happy') && arc(mood === 'happy' ? 68 : 71, 110, mood === 'happy' ? 22 : 16, false)}
          {mood === 'celebrate' && <UnevenRoundedRectangle bottomLeadingRadius={13} bottomTrailingRadius={13} modifiers={[foregroundStyle(INK), ...at(67, 110, 26, 14)]} />}
          {mood === 'celebrate' && <Ellipse modifiers={[foregroundStyle('#FF8FA8'), ...at(74, 117, 12, 6)]} />}
          {mood === 'thirsty' && <Ellipse modifiers={[foregroundStyle(INK), ...at(75, 112, 9, 11)]} />}
          {mood === 'sleepy' && <Capsule modifiers={[foregroundStyle(INK), ...at(74, 114, 12, 3)]} />}

          {mood === 'thirsty' && (
            <UnevenRoundedRectangle
              topLeadingRadius={0}
              topTrailingRadius={7}
              bottomLeadingRadius={7}
              bottomTrailingRadius={7}
              modifiers={[foregroundStyle('#CFE8FB'), frame({ width: 13, height: 13 }), rotationEffect(45), offset({ x: 116, y: 62 })]}
            />
          )}
          {mood === 'celebrate' && <Image systemName="sparkle" color="#F6B73C" size={20} modifiers={[offset({ x: 12, y: 44 })]} />}
          {mood === 'celebrate' && <Image systemName="sparkle" color="#F6B73C" size={15} modifiers={[offset({ x: 128, y: 26 })]} />}
          {mood === 'celebrate' && <Image systemName="sparkle" color="#5CC8F0" size={13} modifiers={[offset({ x: 132, y: 96 })]} />}
          {mood === 'sleepy' && <Text modifiers={[font({ weight: 'black', size: 18, design: 'rounded' }), foregroundStyle('#7B93AA'), offset({ x: 112, y: 26 })]}>z</Text>}
          {mood === 'sleepy' && <Text modifiers={[font({ weight: 'black', size: 13, design: 'rounded' }), foregroundStyle('#9DB0C0'), offset({ x: 126, y: 10 })]}>z</Text>}
        </ZStack>
      </ZStack>
    );
  };

  // Butona basınca dönen değer widget'ın yeni props'u olur (uygulama kapalıyken bile).
  const addWater = (ml) => {
    const pending = (props.pending || []).concat([{ d: today, ml: ml }]);
    return { date: today, totalMl: total + ml, pending: pending, lastAddAt: new Date().toISOString() };
  };

  const family = environment.widgetFamily;

  // --- Kilit ekranı ---
  if (family === 'accessoryInline') {
    return <Text>{num(total) + ' / ' + num(goal) + ' ml'}</Text>;
  }

  if (family === 'accessoryCircular') {
    return (
      <Gauge value={ratio} modifiers={[gaugeStyle('circularCapacity'), widgetURL('sumolasi://')]}>
        <Image systemName="drop.fill" />
      </Gauge>
    );
  }

  if (family === 'accessoryRectangular') {
    return (
      <VStack alignment="leading" spacing={2} modifiers={[widgetURL('sumolasi://')]}>
        <HStack spacing={4}>
          <Image systemName="drop.fill" />
          <Text modifiers={[font({ weight: 'semibold', size: 13 })]}>{labels.title || 'Su Molası'}</Text>
        </HStack>
        <Text modifiers={[font({ weight: 'bold', size: 15, design: 'rounded' }), monospacedDigit()]}>{num(total) + ' / ' + num(goal) + ' ml'}</Text>
        <ProgressView value={ratio} />
      </VStack>
    );
  }

  // --- Ana ekran ---
  const background = containerBackground(
    { type: 'linearGradient', colors: [C.bg1, C.bg2], startPoint: { x: 0, y: 0 }, endPoint: { x: 1, y: 1 } },
    'widget'
  );
  const addButton = (i, target, width) => (
    <Button target={target} onPress={() => addWater(amounts[i])} modifiers={[buttonStyle('borderedProminent'), tint(C.accent)]}>
      <Text modifiers={[font({ weight: 'heavy', size: 14, design: 'rounded' }), foregroundStyle(C.onAccent), frame(width ? { width: width } : { maxWidth: 200 })]}>
        {'+' + num(amounts[i]) + ' ml'}
      </Text>
    </Button>
  );
  const amountLine = (size) => (
    <HStack alignment="lastTextBaseline" spacing={4}>
      <Text modifiers={[font({ weight: 'black', size: size, design: 'rounded' }), foregroundStyle(C.ink), monospacedDigit(), minimumScaleFactor(0.6), contentTransition('numericText')]}>
        {num(total)}
      </Text>
      <Text modifiers={[font({ weight: 'bold', size: 12, design: 'rounded' }), foregroundStyle(C.ink2), minimumScaleFactor(0.7)]}>{'/ ' + num(goal) + ' ml'}</Text>
    </HStack>
  );

  if (family === 'systemMedium') {
    return (
      <HStack spacing={10} modifiers={[background, widgetURL('sumolasi://')]}>
        <VStack alignment="leading" spacing={6}>
          <HStack spacing={6}>
            {mascot(70)}
            <Text modifiers={[font({ weight: 'bold', size: 14, design: 'rounded' }), foregroundStyle(C.ink2), minimumScaleFactor(0.8)]}>{moodLine}</Text>
          </HStack>
          <Spacer />
          {amountLine(24)}
          <ProgressView value={ratio} modifiers={[tint(accent)]} />
        </VStack>
        <VStack spacing={7}>
          {addButton(0, 'add-small', 92)}
          {addButton(1, 'add-medium', 92)}
          {addButton(2, 'add-large', 92)}
        </VStack>
      </HStack>
    );
  }

  // systemSmall (varsayılan)
  return (
    <VStack alignment="leading" spacing={4} modifiers={[background, widgetURL('sumolasi://')]}>
      <HStack alignment="top">
        {mascot(54)}
        <Spacer />
        <Text modifiers={[font({ weight: 'black', size: 14, design: 'rounded' }), foregroundStyle(accent), monospacedDigit()]}>{pctText}</Text>
      </HStack>
      <Spacer />
      {amountLine(22)}
      <ProgressView value={ratio} modifiers={[tint(accent)]} />
      {addButton(0, 'add-small')}
    </VStack>
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
  labels: { title: 'Su Molası', pctPrefix: true, sep: '.', moods: {} },
});
