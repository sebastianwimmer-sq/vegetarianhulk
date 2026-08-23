const MS_PER_DAY = 86400000;

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

// Zaehlt zusammenhaengende Tage rueckwaerts. Startet heute, wenn heute schon
// etwas passiert ist — sonst gestern, damit der Streak nicht jeden Morgen auf
// null faellt, bevor trainiert wurde.
function countStreak(dayKeys, today) {
  if (dayKeys.size === 0) return 0;

  const startOffset = dayKeys.has(dayKey(today)) ? 0 : 1;
  const yesterday = new Date(today.getTime() - MS_PER_DAY);

  if (startOffset === 1 && !dayKeys.has(dayKey(yesterday))) return 0;

  let streak = 0;
  let cursor = new Date(today.getTime() - startOffset * MS_PER_DAY);

  while (dayKeys.has(dayKey(cursor))) {
    streak += 1;
    cursor = new Date(cursor.getTime() - MS_PER_DAY);
  }

  return streak;
}

export function summarise(activities, today) {
  const elevationM = activities.reduce((sum, item) => sum + (item.elevationM ?? 0), 0);
  const distanceM = activities.reduce((sum, item) => sum + (item.distanceM ?? 0), 0);
  const dayKeys = new Set(activities.map((item) => item.startedAt.slice(0, 10)));

  return {
    elevationM,
    distanceKm: Math.round(distanceM / 100) / 10,
    activityCount: activities.length,
    streakDays: countStreak(dayKeys, today),
  };
}
