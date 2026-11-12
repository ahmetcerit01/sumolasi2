import { parseHHMM } from './reminders';

export function getHydrationPace({ now = new Date(), waterDayKey, wakeAt, sleepAt, startAt, goalMl, totalMl }) {
  if (!waterDayKey || !goalMl) return null;
  const [year, month, day] = waterDayKey.split('-').map(Number);
  const wake = parseHHMM(wakeAt, { h: 8, m: 0 });
  const sleep = parseHHMM(sleepAt, { h: 23, m: 0 });
  const start = startAt || new Date(year, month - 1, day, wake.h, wake.m);
  const end = new Date(year, month - 1, day, sleep.h, sleep.m);
  if (end <= start) end.setDate(end.getDate() + 1);
  const fraction = Math.max(0, Math.min(1, (now - start) / (end - start)));
  const plannedMl = Math.min(goalMl, Math.round((goalMl * fraction) / 50) * 50);
  return {
    plannedMl,
    plannedFraction: fraction,
    actualFraction: Math.min(1, Math.max(0, (totalMl || 0) / goalMl)),
    phase: now < start ? 'before' : now >= end ? 'after' : 'active',
  };
}
