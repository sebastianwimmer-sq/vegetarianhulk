const SELECT_COLUMNS = `
  id, kind, raw_kind, started_at, duration_s,
  distance_m, elevation_m, kcal, avg_hr
`;

function toActivity(row) {
  return {
    id: row.id,
    kind: row.kind,
    rawKind: row.raw_kind,
    startedAt: row.started_at,
    durationS: row.duration_s,
    distanceM: row.distance_m,
    elevationM: row.elevation_m,
    kcal: row.kcal,
    avgHr: row.avg_hr,
  };
}

export async function insertActivity(db, activity) {
  const existing = await db
    .prepare("SELECT id FROM activities WHERE kind = ? AND started_at = ?")
    .bind(activity.kind, activity.startedAt)
    .first();

  if (existing) {
    return { id: existing.id, isNew: false };
  }

  const id = crypto.randomUUID();

  await db
    .prepare(
      `INSERT INTO activities
         (id, kind, raw_kind, started_at, duration_s, distance_m, elevation_m, kcal, avg_hr, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      id,
      activity.kind,
      activity.rawKind,
      activity.startedAt,
      activity.durationS,
      activity.distanceM ?? null,
      activity.elevationM ?? null,
      activity.kcal ?? null,
      activity.avgHr ?? null,
      new Date().toISOString()
    )
    .run();

  return { id, isNew: true };
}

export async function listRecentActivities(db, limit) {
  const { results } = await db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM activities ORDER BY started_at DESC LIMIT ?`)
    .bind(limit)
    .all();

  return results.map(toActivity);
}

export async function listActivitiesSince(db, isoDate) {
  const { results } = await db
    .prepare(`SELECT ${SELECT_COLUMNS} FROM activities WHERE started_at >= ? ORDER BY started_at DESC`)
    .bind(isoDate)
    .all();

  return results.map(toActivity);
}
