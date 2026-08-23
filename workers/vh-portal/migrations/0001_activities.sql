-- Logbuch: Sebis Aktivitaeten von der Apple Watch.
-- Bewusst ohne GPS und ohne IP-Adressen (Spec 13).
CREATE TABLE activities (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  raw_kind    TEXT NOT NULL,
  started_at  TEXT NOT NULL,
  duration_s  INTEGER NOT NULL,
  distance_m  INTEGER,
  elevation_m INTEGER,
  kcal        INTEGER,
  avg_hr      INTEGER,
  created_at  TEXT NOT NULL
);

-- Der Kurzbefehl kann bei Netzproblemen erneut senden.
-- Sportart plus Startzeit identifiziert ein Workout eindeutig.
CREATE UNIQUE INDEX idx_activities_dedupe ON activities (kind, started_at);
CREATE INDEX idx_activities_started ON activities (started_at DESC);
