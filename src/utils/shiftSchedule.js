import AsyncStorage from '@react-native-async-storage/async-storage';

export const SHIFT_SCHEDULE_KEY = 'SUMOLASI_SHIFT_SCHEDULE_V1';

export const DEFAULT_SHIFT_SCHEDULE = {
  enabled: false,
  active: 'day',
  week: ['off', 'day', 'day', 'day', 'day', 'day', 'off'],
  shifts: {
    day: { wakeAt: '07:00', sleepAt: '22:30' },
    night: { wakeAt: '15:00', sleepAt: '08:00' },
    off: { wakeAt: '09:00', sleepAt: '23:00' },
  },
};

export function getShiftForDate(schedule, date = new Date()) {
  const dayMode = schedule?.enabled
    ? schedule.week?.[date.getDay()] || schedule.active || 'day'
    : schedule?.active || 'day';
  return {
    mode: dayMode,
    ...(schedule?.shifts?.[dayMode] || DEFAULT_SHIFT_SCHEDULE.shifts[dayMode]),
  };
}

const atTime = (date, hhmm) => {
  const [hour = 8, minute = 0] = String(hhmm || '08:00').split(':').map(Number);
  const result = new Date(date);
  result.setHours(hour, minute, 0, 0);
  return result;
};

// Ardışık vardiyalarda önceki gece vardiyası bitmeden yeni su günü açılmaz.
export function getEffectiveShiftStart(schedule, date = new Date()) {
  const current = getShiftForDate(schedule, date);
  const start = atTime(date, current.wakeAt);
  const previousDate = new Date(date);
  previousDate.setDate(previousDate.getDate() - 1);
  const previous = getShiftForDate(schedule, previousDate);
  const previousStart = atTime(previousDate, previous.wakeAt);
  const previousEnd = atTime(previousDate, previous.sleepAt);
  if (previousEnd <= previousStart) previousEnd.setDate(previousEnd.getDate() + 1);
  return previousEnd > start ? previousEnd : start;
}

export function normalizeShiftSchedule(saved = {}) {
  const active = ['day', 'night', 'off'].includes(saved.active) ? saved.active : DEFAULT_SHIFT_SCHEDULE.active;
  const fallbackWeek = saved.enabled ? Array(7).fill(active) : [...DEFAULT_SHIFT_SCHEDULE.week];
  return {
    ...DEFAULT_SHIFT_SCHEDULE,
    ...saved,
    active,
    shifts: { ...DEFAULT_SHIFT_SCHEDULE.shifts, ...(saved.shifts || {}) },
    week: Array.isArray(saved.week) && saved.week.length === 7
      ? saved.week.map((mode) => (['day', 'night', 'off'].includes(mode) ? mode : 'day'))
      : fallbackWeek,
  };
}

export async function getShiftSchedule() {
  try {
    const raw = await AsyncStorage.getItem(SHIFT_SCHEDULE_KEY);
    const saved = raw ? JSON.parse(raw) : {};
    return normalizeShiftSchedule(saved);
  } catch {
    return DEFAULT_SHIFT_SCHEDULE;
  }
}

export async function saveShiftSchedule(schedule) {
  const next = normalizeShiftSchedule(schedule);
  await AsyncStorage.setItem(SHIFT_SCHEDULE_KEY, JSON.stringify(next));
  return next;
}
