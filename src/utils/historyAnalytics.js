const average = (days) => days.length ? Math.round(days.reduce((sum, day) => sum + (day.ml || 0), 0) / days.length) : 0;

export function summarizeHistory(days, previousDays = []) {
  const tracked = days.filter((day) => day.isTracked);
  const completed = tracked.filter((day) => !day.isToday);
  const previous = previousDays.filter((day) => day.isTracked && !day.isToday);
  const total = tracked.reduce((sum, day) => sum + (day.ml || 0), 0);
  const goalDays = completed.filter((day) => day.ml > 0 && day.ml >= day.goal).length;
  const closeDays = completed.filter((day) => day.ml > 0 && day.ml < day.goal && day.ml >= day.goal * 0.8).length;
  const lowDays = completed.filter((day) => day.ml > 0 && day.ml < day.goal * 0.8).length;
  const emptyDays = completed.filter((day) => !day.ml).length;
  const currentAverage = average(completed);
  const previousAverage = average(previous);
  const trendPercent = completed.length && previous.length && previousAverage
    ? Math.round(((currentAverage - previousAverage) / previousAverage) * 100)
    : null;
  const shifts = ['day', 'night', 'off'].map((mode) => {
    const matching = completed.filter((day) => day.shiftMode === mode);
    return { mode, days: matching.length, average: average(matching), goalDays: matching.filter((day) => day.ml > 0 && day.ml >= day.goal).length };
  }).filter((item) => item.days);
  return {
    total, currentAverage, previousAverage, trendPercent,
    goalDays, closeDays, lowDays, emptyDays,
    completedCount: completed.length, trackedCount: tracked.length, shifts,
  };
}
