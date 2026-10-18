import { Gauge, HStack, Image, ProgressView, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { activityBackgroundTint, font, foregroundStyle, gaugeStyle, monospacedDigit, padding, tint } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity } from 'expo-widgets';

// Kilit ekranı + Dynamic Island: günün su ilerlemesi.
// Widget gibi ayrı bir runtime'da çalışır; her şey props'tan gelir.
//
// props:
//   totalMl, goalMl
//   next     sıradaki hatırlatma 'HH:MM' ('' = yok)
//   labels   { title, pctPrefix, sep, nextLabel, doneLabel }
const WaterActivity = (props, environment) => {
  'widget';

  const labels = props.labels || {};
  const goal = props.goalMl > 0 ? props.goalMl : 2500;
  const total = props.totalMl || 0;
  const ratio = Math.min(total / goal, 1);
  const pct = Math.round(ratio * 100);
  const done = total >= goal;
  const pctText = labels.pctPrefix ? '%' + pct : pct + '%';
  const sep = labels.sep || '.';
  const num = (n) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);

  const dimmed = environment.isLuminanceReduced;
  const accent = dimmed ? '#FFFFFF' : done ? '#5FD0A8' : '#5AD3F0';
  const ink2 = '#B7C7D6';
  const status = done ? labels.doneLabel || '' : props.next ? (labels.nextLabel || '') + ' ' + props.next : '';

  const drop = (size) => <Image systemName={done ? 'checkmark.circle.fill' : 'drop.fill'} color={accent} size={size} />;

  return {
    banner: (
      <VStack alignment="leading" spacing={8} modifiers={[padding({ all: 16 }), activityBackgroundTint('#0A131D')]}>
        <HStack spacing={8}>
          {drop(18)}
          <Text modifiers={[font({ weight: 'bold', size: 15, design: 'rounded' }), foregroundStyle('#FFFFFF')]}>{labels.title || 'Su Molası'}</Text>
          <Spacer />
          <Text modifiers={[font({ weight: 'heavy', size: 15, design: 'rounded' }), foregroundStyle(accent), monospacedDigit()]}>{pctText}</Text>
        </HStack>
        <HStack alignment="lastTextBaseline" spacing={4}>
          <Text modifiers={[font({ weight: 'black', size: 30, design: 'rounded' }), foregroundStyle('#FFFFFF'), monospacedDigit()]}>{num(total)}</Text>
          <Text modifiers={[font({ weight: 'bold', size: 14, design: 'rounded' }), foregroundStyle(ink2)]}>{'/ ' + num(goal) + ' ml'}</Text>
          <Spacer />
          <Text modifiers={[font({ weight: 'semibold', size: 13, design: 'rounded' }), foregroundStyle(ink2)]}>{status}</Text>
        </HStack>
        <ProgressView value={ratio} modifiers={[tint(accent)]} />
      </VStack>
    ),
    compactLeading: drop(16),
    compactTrailing: (
      <Text modifiers={[font({ weight: 'heavy', size: 14, design: 'rounded' }), foregroundStyle(accent), monospacedDigit()]}>{pctText}</Text>
    ),
    minimal: (
      <Gauge value={ratio} modifiers={[gaugeStyle('circularCapacity'), tint(accent)]}>
        <Image systemName="drop.fill" color={accent} size={10} />
      </Gauge>
    ),
    expandedLeading: (
      <HStack spacing={6} modifiers={[padding({ leading: 6 })]}>
        {drop(20)}
        <Text modifiers={[font({ weight: 'heavy', size: 18, design: 'rounded' }), foregroundStyle(accent), monospacedDigit()]}>{pctText}</Text>
      </HStack>
    ),
    expandedTrailing: (
      <Text modifiers={[font({ weight: 'semibold', size: 14, design: 'rounded' }), foregroundStyle(ink2), padding({ trailing: 6 })]}>{status}</Text>
    ),
    expandedBottom: (
      <VStack alignment="leading" spacing={6} modifiers={[padding({ horizontal: 8 })]}>
        <HStack alignment="lastTextBaseline" spacing={4}>
          <Text modifiers={[font({ weight: 'black', size: 24, design: 'rounded' }), foregroundStyle('#FFFFFF'), monospacedDigit()]}>{num(total)}</Text>
          <Text modifiers={[font({ weight: 'bold', size: 13, design: 'rounded' }), foregroundStyle(ink2)]}>{'/ ' + num(goal) + ' ml'}</Text>
        </HStack>
        <ProgressView value={ratio} modifiers={[tint(accent)]} />
      </VStack>
    ),
  };
};

export default createLiveActivity('WaterActivity', WaterActivity);
