-- Beispieldaten fuer die lokale Ansicht. Nur fuer --local, nie --remote.
-- Die Zeitpunkte sind relativ zu heute, damit der Streak echt aussieht und
-- die Zahlen ins laufende Jahr fallen.
DELETE FROM activities;

INSERT INTO activities (id, kind, raw_kind, started_at, duration_s, distance_m, elevation_m, kcal, avg_hr, created_at) VALUES
  ('demo-1', 'wandern',   'Hiking',                        strftime('%Y-%m-%dT06:30:00.000Z', 'now'),            24780, 12520, 1071, 2085, 117, strftime('%Y-%m-%dT%H:%M:%S.000Z','now')),
  ('demo-2', 'kraft',     'Traditional Strength Training', strftime('%Y-%m-%dT17:10:00.000Z', 'now', '-1 day'),   4500,  NULL, NULL,  480, 121, strftime('%Y-%m-%dT%H:%M:%S.000Z','now')),
  ('demo-3', 'laufen',    'Outdoor Run',                   strftime('%Y-%m-%dT06:05:00.000Z', 'now', '-2 day'),   2760,  8200,  120,  610, 152, strftime('%Y-%m-%dT%H:%M:%S.000Z','now')),
  ('demo-4', 'radfahren', 'Cycling',                       strftime('%Y-%m-%dT15:20:00.000Z', 'now', '-3 day'),   6300, 42100,  430, 1180, 138, strftime('%Y-%m-%dT%H:%M:%S.000Z','now')),
  ('demo-5', 'kraft',     'Functional Strength Training',  strftime('%Y-%m-%dT18:00:00.000Z', 'now', '-4 day'),   3900,  NULL, NULL,  420, 118, strftime('%Y-%m-%dT%H:%M:%S.000Z','now')),
  ('demo-6', 'gehen',     'Walking',                       strftime('%Y-%m-%dT12:40:00.000Z', 'now', '-5 day'),   1800,  3100,   40,  190,  99, strftime('%Y-%m-%dT%H:%M:%S.000Z','now')),
  ('demo-7', 'wandern',   'Hiking',                        strftime('%Y-%m-%dT07:15:00.000Z', 'now', '-9 day'),  18000,  9400,  760, 1490, 124, strftime('%Y-%m-%dT%H:%M:%S.000Z','now'));
