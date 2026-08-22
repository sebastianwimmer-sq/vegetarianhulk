# Berg-Portal T0 + T1 — Fundament und Logbuch (Implementierungsplan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ein neuer Worker `vh-portal` mit Datenbank und Testgerüst steht, und Sebis Apple-Watch-Workouts landen automatisch in einem öffentlich sichtbaren Logbuch-Band.

**Architecture:** Cloudflare Worker (ESM, kein Build-Schritt) mit D1 als Speicher. Eine iOS-Kurzbefehl-Automation schickt beim Workout-Ende eine JSON-Nutzlast an einen secret-geschützten Endpunkt. Der Worker rendert `/gipfelbuch/` selbst als HTML, damit später teilbare Seiten mit OG-Tags aus derselben Maschinerie kommen. `vh-forms` bleibt unangetastet.

**Tech Stack:** Cloudflare Workers · D1 · Wrangler 4.90 · Vitest mit `@cloudflare/vitest-pool-workers` · Playwright · Node 26

**Spec:** `docs/superpowers/specs/2026-08-23-berg-portal-stufe-1-design.md`

## Global Constraints

- **Trennung PEAKING ↔ VH:** `workers_dev = false`. Keine `*.peaking.workers.dev`-Adresse im VH-Kontext. (Spec 6.2)
- **Dateigröße:** jede Datei unter 400 Zeilen, Funktionen unter 50 Zeilen, Verschachtelung unter 4 Ebenen.
- **Fail fast, fail closed:** Fehlt ein Secret, wird abgewiesen, nie durchgelassen. Fehler nie stillschweigend schlucken.
- **Immutabilität:** neue Objekte statt Mutation.
- **Namensgebung:** camelCase für Funktionen und Variablen, `is`/`has`/`should` für Booleans, UPPER_SNAKE für Konstanten. Keine Magic Numbers.
- **Keine IP-Speicherung.** Kein Klartext-Secret in D1 oder Logs.
- **Datenattribute im HTML namespacen:** `data-gb…`, **niemals** `data-hm` (die geteilte `v3.js` überschreibt jedes `[data-hm]`).
- **Keine Deko-Emoji** im ausgelieferten HTML. Trenner ist die Berg-Silhouette, nicht `·`.
- **Kein `upgrade-insecure-requests`** in irgendeiner CSP (bricht Safari auf localhost).
- **Commit-Format:** `<type>: <description>` mit type aus feat/fix/refactor/docs/test/chore/perf/ci.
- **Branch:** alles auf `feat/berg-portal-t0-t1`, abgezweigt von `origin/main`. Kein Merge, kein Deploy ohne Sebis Freigabe.

**Bewusst auf T2 verschoben:** KV-basierte Rate-Limits. Der einzige Schreibpfad in diesem Plan ist secret-geschützt und wird nur von Sebis iPhone bedient — dort greift die Idempotenz-Regel aus Task 2. Sobald mit T2 offene Formulare dazukommen, wird das KV-Binding nachgezogen und dieser Endpunkt mit abgesichert.

---

## Dateistruktur

| Datei | Verantwortung |
|---|---|
| `workers/vh-portal/package.json` | Nur Dev-Abhängigkeiten und Test-Skripte. Die statische Seite bleibt build-frei |
| `workers/vh-portal/wrangler.toml` | Worker-Konfiguration, Bindings, Routen |
| `workers/vh-portal/vitest.config.js` | Test-Pool mit D1 und Migrationen |
| `workers/vh-portal/worker.js` | Einstieg, Router, zentrale Fehlerbehandlung |
| `workers/vh-portal/lib/http.js` | Antwort-Helfer (JSON, HTML, Fehler), Sicherheits-Header |
| `workers/vh-portal/lib/db.js` | D1-Zugriff für Aktivitäten |
| `workers/vh-portal/lib/validate.js` | Schema-Validierung der Logbuch-Nutzlast, Sportart-Zuordnung |
| `workers/vh-portal/lib/secret.js` | Zeitkonstanter Secret-Vergleich |
| `workers/vh-portal/lib/totals.js` | Jahressummen und Streak |
| `workers/vh-portal/routes/logbook.js` | Aufnahme-Endpunkt und öffentliche JSON-Ausgabe |
| `workers/vh-portal/routes/page.js` | Server-gerendertes `/gipfelbuch/` mit Instrument-Band |
| `workers/vh-portal/migrations/0001_activities.sql` | Tabelle `activities` |
| `workers/vh-portal/test/*.test.js` | Unit- und Integrationstests |
| `workers/vh-portal/e2e/logbuch.spec.js` | Playwright gegen `wrangler dev` |
| `docs/logbuch-kurzbefehl.md` | Klickanleitung für Sebis iPhone |
| `scripts/dns-abgleich.sh` | Exportiert die aktuellen DNS-Records als Abgleichliste vor dem Zonen-Umzug |

---

## Task 1: Worker-Skelett und Testgerüst

**Files:**
- Create: `workers/vh-portal/package.json`
- Create: `workers/vh-portal/wrangler.toml`
- Create: `workers/vh-portal/vitest.config.js`
- Create: `workers/vh-portal/worker.js`
- Create: `workers/vh-portal/lib/http.js`
- Create: `workers/vh-portal/.gitignore`
- Test: `workers/vh-portal/test/router.test.js`

**Interfaces:**
- Consumes: nichts
- Produces: `jsonResponse(data, init)` → `Response`; `errorResponse(status, code, message)` → `Response`; Default-Export mit `fetch(request, env, ctx)`; Route-Präfix `/gipfelbuch`

- [ ] **Step 1: Projektgerüst anlegen**

`workers/vh-portal/package.json`:

```json
{
  "name": "vh-portal",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "dev": "wrangler dev",
    "e2e": "playwright test"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "^0.9.0",
    "@playwright/test": "^1.50.0",
    "vitest": "^3.0.0",
    "wrangler": "^4.90.0"
  }
}
```

`workers/vh-portal/.gitignore`:

```
node_modules/
.wrangler/
test-results/
playwright-report/
```

`workers/vh-portal/wrangler.toml`:

```toml
# vh-portal — Berg-Portal (Gipfelbuch + Logbuch) fuer vegetarianhulk.de
# Bewusst OHNE workers.dev: PEAKING und VH bleiben getrennt (Spec 6.2).
# Deploy nur ueber die Zonen-Route, erst nach dem Cloudflare-Umzug.
name = "vh-portal"
main = "worker.js"
compatibility_date = "2026-06-01"
workers_dev = false

[[d1_databases]]
binding = "DB"
database_name = "vh-portal"
database_id = "PLACEHOLDER_WIRD_IN_TASK_10_GESETZT"
migrations_dir = "migrations"

[vars]
PORTAL_WRITES = "on"
```

> Der `database_id`-Platzhalter ist Absicht: die echte Datenbank wird erst in Task 10 angelegt, weil dafür der Cloudflare-Account feststehen muss. Die Tests laufen gegen eine lokale D1 und brauchen die ID nicht.

`workers/vh-portal/vitest.config.js`:

```js
import { defineWorkersConfig, readD1Migrations } from "@cloudflare/vitest-pool-workers/config";

const migrations = await readD1Migrations("./migrations");

export default defineWorkersConfig({
  test: {
    setupFiles: ["./test/setup.js"],
    poolOptions: {
      workers: {
        singleWorker: true,
        wrangler: { configPath: "./wrangler.toml" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            LOG_SECRET: "test-log-secret-0123456789",
          },
        },
      },
    },
  },
});
```

`workers/vh-portal/test/setup.js`:

```js
import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll } from "vitest";

beforeAll(async () => {
  await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
});
```

- [ ] **Step 2: Den fehlschlagenden Test schreiben**

`workers/vh-portal/test/router.test.js`:

```js
import { SELF } from "cloudflare:test";
import { describe, expect, it } from "vitest";

describe("Router", () => {
  it("beantwortet den Health-Check", async () => {
    const response = await SELF.fetch("https://vegetarianhulk.de/gipfelbuch/api/health");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, service: "vh-portal" });
  });

  it("liefert 404 fuer unbekannte Pfade unter /gipfelbuch", async () => {
    const response = await SELF.fetch("https://vegetarianhulk.de/gipfelbuch/api/gibtsnicht");

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ error: "not_found" });
  });

  it("setzt nosniff auf jede Antwort", async () => {
    const response = await SELF.fetch("https://vegetarianhulk.de/gipfelbuch/api/health");

    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
```

- [ ] **Step 3: Test laufen lassen und Fehlschlag bestaetigen**

```bash
cd workers/vh-portal && npm install && npm test
```

Erwartet: FAIL — `worker.js` existiert noch nicht beziehungsweise exportiert kein `fetch`.

- [ ] **Step 4: Minimale Implementierung**

`workers/vh-portal/lib/http.js`:

```js
const BASE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

export function jsonResponse(data, init = {}) {
  return new Response(JSON.stringify(data), {
    status: init.status ?? 200,
    headers: { ...BASE_HEADERS, "Content-Type": "application/json; charset=utf-8", ...init.headers },
  });
}

export function htmlResponse(markup, init = {}) {
  return new Response(markup, {
    status: init.status ?? 200,
    headers: { ...BASE_HEADERS, "Content-Type": "text/html; charset=utf-8", ...init.headers },
  });
}

export function errorResponse(status, code, message) {
  return jsonResponse({ error: code, message }, { status });
}
```

`workers/vh-portal/worker.js`:

```js
import { errorResponse, jsonResponse } from "./lib/http.js";

const PREFIX = "/gipfelbuch";

export default {
  async fetch(request, env, ctx) {
    try {
      return await route(request, env, ctx);
    } catch (error) {
      console.error("unhandled", error?.stack ?? String(error));
      return errorResponse(500, "internal_error", "Da ist etwas schiefgelaufen.");
    }
  },
};

async function route(request, env, ctx) {
  const url = new URL(request.url);

  if (!url.pathname.startsWith(PREFIX)) {
    return errorResponse(404, "not_found", "Diese Seite gibt es hier nicht.");
  }

  const path = url.pathname.slice(PREFIX.length) || "/";

  if (request.method === "GET" && path === "/api/health") {
    return jsonResponse({ ok: true, service: "vh-portal" });
  }

  return errorResponse(404, "not_found", "Diese Seite gibt es hier nicht.");
}
```

- [ ] **Step 5: Test laufen lassen und Erfolg bestaetigen**

```bash
cd workers/vh-portal && npm test
```

Erwartet: 3 Tests grün.

- [ ] **Step 6: Commit**

```bash
git add workers/vh-portal
git commit -m "feat(portal): Worker-Skelett mit Router, Health-Check und Testgeruest"
```

---

## Task 2: Tabelle `activities` und Datenbankzugriff

**Files:**
- Create: `workers/vh-portal/migrations/0001_activities.sql`
- Create: `workers/vh-portal/lib/db.js`
- Test: `workers/vh-portal/test/db.test.js`

**Interfaces:**
- Consumes: `env.DB` aus Task 1
- Produces: `insertActivity(db, activity)` → `Promise<{ id: string, isNew: boolean }>`; `listRecentActivities(db, limit)` → `Promise<Activity[]>`; `listActivitiesSince(db, isoDate)` → `Promise<Activity[]>`. `Activity` = `{ id, kind, rawKind, startedAt, durationS, distanceM, elevationM, kcal, avgHr }`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`workers/vh-portal/test/db.test.js`:

```js
import { env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { insertActivity, listActivitiesSince, listRecentActivities } from "../lib/db.js";

const BASE = {
  kind: "wandern",
  rawKind: "Hiking",
  startedAt: "2026-08-20T06:30:00.000Z",
  durationS: 7200,
  distanceM: 12520,
  elevationM: 1071,
  kcal: 2085,
  avgHr: 117,
};

describe("Aktivitaeten-Speicher", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM activities").run();
  });

  it("legt eine Aktivitaet an und liest sie zurueck", async () => {
    const { id, isNew } = await insertActivity(env.DB, BASE);

    expect(isNew).toBe(true);
    expect(id).toMatch(/^[0-9a-f-]{36}$/);

    const [stored] = await listRecentActivities(env.DB, 10);
    expect(stored).toMatchObject({ kind: "wandern", elevationM: 1071, avgHr: 117 });
  });

  it("ist idempotent bei gleicher Sportart und Startzeit", async () => {
    const first = await insertActivity(env.DB, BASE);
    const second = await insertActivity(env.DB, BASE);

    expect(second.isNew).toBe(false);
    expect(second.id).toBe(first.id);
    expect(await listRecentActivities(env.DB, 10)).toHaveLength(1);
  });

  it("sortiert die neueste Aktivitaet nach vorne und begrenzt die Menge", async () => {
    await insertActivity(env.DB, { ...BASE, startedAt: "2026-08-18T06:00:00.000Z" });
    await insertActivity(env.DB, { ...BASE, startedAt: "2026-08-21T06:00:00.000Z" });
    await insertActivity(env.DB, { ...BASE, startedAt: "2026-08-19T06:00:00.000Z" });

    const rows = await listRecentActivities(env.DB, 2);

    expect(rows.map((row) => row.startedAt)).toEqual([
      "2026-08-21T06:00:00.000Z",
      "2026-08-19T06:00:00.000Z",
    ]);
  });

  it("liefert nur Aktivitaeten ab dem Stichtag", async () => {
    await insertActivity(env.DB, { ...BASE, startedAt: "2025-12-31T10:00:00.000Z" });
    await insertActivity(env.DB, { ...BASE, startedAt: "2026-01-02T10:00:00.000Z" });

    const rows = await listActivitiesSince(env.DB, "2026-01-01T00:00:00.000Z");

    expect(rows).toHaveLength(1);
    expect(rows[0].startedAt).toBe("2026-01-02T10:00:00.000Z");
  });

  it("erlaubt fehlende optionale Werte", async () => {
    await insertActivity(env.DB, {
      kind: "kraft",
      rawKind: "Traditional Strength Training",
      startedAt: "2026-08-22T17:00:00.000Z",
      durationS: 3600,
      distanceM: null,
      elevationM: null,
      kcal: null,
      avgHr: null,
    });

    const [stored] = await listRecentActivities(env.DB, 1);
    expect(stored.distanceM).toBeNull();
    expect(stored.kcal).toBeNull();
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestaetigen**

```bash
cd workers/vh-portal && npm test -- db.test.js
```

Erwartet: FAIL — `lib/db.js` existiert nicht, Tabelle `activities` fehlt.

- [ ] **Step 3: Migration schreiben**

`workers/vh-portal/migrations/0001_activities.sql`:

```sql
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
```

- [ ] **Step 4: Datenbankmodul schreiben**

`workers/vh-portal/lib/db.js`:

```js
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
```

- [ ] **Step 5: Test laufen lassen und Erfolg bestaetigen**

```bash
cd workers/vh-portal && npm test -- db.test.js
```

Erwartet: 5 Tests grün.

- [ ] **Step 6: Commit**

```bash
git add workers/vh-portal/migrations workers/vh-portal/lib/db.js workers/vh-portal/test/db.test.js
git commit -m "feat(portal): Tabelle activities mit idempotentem Insert"
```

---

## Task 3: Validierung der Logbuch-Nutzlast

**Files:**
- Create: `workers/vh-portal/lib/validate.js`
- Test: `workers/vh-portal/test/validate.test.js`

**Interfaces:**
- Consumes: nichts
- Produces: `parseActivityPayload(payload)` → `{ ok: true, value: Activity } | { ok: false, errors: string[] }`. `Activity` hat dieselbe Form wie in Task 2.

**Warum eine eigene Zuordnung:** Der Kurzbefehl liefert Apples englische Workout-Namen und je nach Feldtyp Zahlen oder Zahlen als Text. Beides wird hier explizit normalisiert, statt sich später im Speicher zu verstecken. Unbekannte Sportarten landen als `sonstiges` und behalten ihren Originalnamen in `rawKind` — so geht nie ein Workout verloren, nur weil Apple einen neuen Typ einführt.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`workers/vh-portal/test/validate.test.js`:

```js
import { describe, expect, it } from "vitest";
import { parseActivityPayload } from "../lib/validate.js";

const VALID = {
  workout: "Hiking",
  started_at: "2026-08-20T06:30:00Z",
  duration_s: 7200,
  distance_m: 12520,
  elevation_m: 1071,
  kcal: 2085,
  avg_hr: 117,
};

describe("parseActivityPayload", () => {
  it("nimmt eine vollstaendige Nutzlast an", () => {
    const result = parseActivityPayload(VALID);

    expect(result.ok).toBe(true);
    expect(result.value).toEqual({
      kind: "wandern",
      rawKind: "Hiking",
      startedAt: "2026-08-20T06:30:00.000Z",
      durationS: 7200,
      distanceM: 12520,
      elevationM: 1071,
      kcal: 2085,
      avgHr: 117,
    });
  });

  it("ordnet Apples Sportarten zu", () => {
    const cases = [
      ["Running", "laufen"],
      ["Outdoor Run", "laufen"],
      ["Cycling", "radfahren"],
      ["Outdoor Cycle", "radfahren"],
      ["Hiking", "wandern"],
      ["Traditional Strength Training", "kraft"],
      ["Functional Strength Training", "kraft"],
      ["Walking", "gehen"],
    ];

    for (const [workout, expected] of cases) {
      expect(parseActivityPayload({ ...VALID, workout }).value.kind).toBe(expected);
    }
  });

  it("faellt bei unbekannter Sportart auf sonstiges zurueck und behaelt das Original", () => {
    const result = parseActivityPayload({ ...VALID, workout: "Underwater Basket Weaving" });

    expect(result.value.kind).toBe("sonstiges");
    expect(result.value.rawKind).toBe("Underwater Basket Weaving");
  });

  it("nimmt Zahlen auch als Text an, weil Kurzbefehle so senden", () => {
    const result = parseActivityPayload({ ...VALID, duration_s: "7200", elevation_m: "1071" });

    expect(result.value.durationS).toBe(7200);
    expect(result.value.elevationM).toBe(1071);
  });

  it("laesst optionale Felder weg", () => {
    const result = parseActivityPayload({
      workout: "Traditional Strength Training",
      started_at: "2026-08-22T17:00:00Z",
      duration_s: 3600,
    });

    expect(result.ok).toBe(true);
    expect(result.value.distanceM).toBeNull();
    expect(result.value.avgHr).toBeNull();
  });

  it("weist eine fehlende Sportart ab", () => {
    const { workout, ...rest } = VALID;
    const result = parseActivityPayload(rest);

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("workout fehlt");
  });

  it("weist ein unlesbares Datum ab", () => {
    const result = parseActivityPayload({ ...VALID, started_at: "gestern frueh" });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("started_at ist kein gueltiger Zeitpunkt");
  });

  it("weist eine nicht positive Dauer ab", () => {
    expect(parseActivityPayload({ ...VALID, duration_s: 0 }).ok).toBe(false);
    expect(parseActivityPayload({ ...VALID, duration_s: -5 }).ok).toBe(false);
  });

  it("weist negative Messwerte ab", () => {
    const result = parseActivityPayload({ ...VALID, distance_m: -1 });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("distance_m darf nicht negativ sein");
  });

  it("weist unsinnig hohe Pulswerte ab", () => {
    const result = parseActivityPayload({ ...VALID, avg_hr: 400 });

    expect(result.ok).toBe(false);
    expect(result.errors).toContain("avg_hr liegt ausserhalb des plausiblen Bereichs");
  });

  it("weist etwas ab, das kein Objekt ist", () => {
    expect(parseActivityPayload(null).ok).toBe(false);
    expect(parseActivityPayload("Hiking").ok).toBe(false);
  });

  it("sammelt mehrere Fehler auf einmal", () => {
    const result = parseActivityPayload({ started_at: "kaputt", duration_s: -1 });

    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestaetigen**

```bash
cd workers/vh-portal && npm test -- validate.test.js
```

Erwartet: FAIL — `lib/validate.js` existiert nicht.

- [ ] **Step 3: Validierung schreiben**

`workers/vh-portal/lib/validate.js`:

```js
const MAX_HEART_RATE = 250;
const MIN_HEART_RATE = 25;
const MAX_DURATION_S = 86400;

// Apples Workout-Namen -> unsere Sportarten. Kleingeschrieben verglichen.
const KIND_BY_KEYWORD = [
  ["hik", "wandern"],
  ["walk", "gehen"],
  ["run", "laufen"],
  ["cycl", "radfahren"],
  ["bike", "radfahren"],
  ["strength", "kraft"],
  ["swim", "schwimmen"],
];

function mapKind(rawKind) {
  const needle = rawKind.toLowerCase();
  const hit = KIND_BY_KEYWORD.find(([keyword]) => needle.includes(keyword));
  return hit ? hit[1] : "sonstiges";
}

function readInteger(value, field, errors, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) {
  if (value === undefined || value === null || value === "") return null;

  const parsed = typeof value === "number" ? value : Number(String(value).trim());

  if (!Number.isFinite(parsed)) {
    errors.push(`${field} ist keine Zahl`);
    return null;
  }
  if (parsed < 0) {
    errors.push(`${field} darf nicht negativ sein`);
    return null;
  }
  if (parsed < min || parsed > max) {
    errors.push(`${field} liegt ausserhalb des plausiblen Bereichs`);
    return null;
  }
  return Math.round(parsed);
}

export function parseActivityPayload(payload) {
  const errors = [];

  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    return { ok: false, errors: ["Nutzlast ist kein Objekt"] };
  }

  const rawKind = typeof payload.workout === "string" ? payload.workout.trim() : "";
  if (!rawKind) errors.push("workout fehlt");

  const startedAt = new Date(payload.started_at ?? "");
  if (Number.isNaN(startedAt.getTime())) errors.push("started_at ist kein gueltiger Zeitpunkt");

  const durationS = readInteger(payload.duration_s, "duration_s", errors, { min: 1, max: MAX_DURATION_S });
  if (durationS === null && !errors.some((e) => e.startsWith("duration_s"))) {
    errors.push("duration_s fehlt");
  }

  const distanceM = readInteger(payload.distance_m, "distance_m", errors);
  const elevationM = readInteger(payload.elevation_m, "elevation_m", errors);
  const kcal = readInteger(payload.kcal, "kcal", errors);
  const avgHr = readInteger(payload.avg_hr, "avg_hr", errors, { min: MIN_HEART_RATE, max: MAX_HEART_RATE });

  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      kind: mapKind(rawKind),
      rawKind,
      startedAt: startedAt.toISOString(),
      durationS,
      distanceM,
      elevationM,
      kcal,
      avgHr,
    },
  };
}
```

- [ ] **Step 4: Test laufen lassen und Erfolg bestaetigen**

```bash
cd workers/vh-portal && npm test -- validate.test.js
```

Erwartet: 12 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add workers/vh-portal/lib/validate.js workers/vh-portal/test/validate.test.js
git commit -m "feat(portal): Schema-Validierung und Sportart-Zuordnung fuer das Logbuch"
```

---

## Task 4: Aufnahme-Endpunkt mit Secret und Kill-Switch

**Files:**
- Create: `workers/vh-portal/lib/secret.js`
- Create: `workers/vh-portal/routes/logbook.js`
- Modify: `workers/vh-portal/worker.js`
- Test: `workers/vh-portal/test/ingest.test.js`

**Interfaces:**
- Consumes: `parseActivityPayload` (Task 3), `insertActivity` (Task 2), `jsonResponse`/`errorResponse` (Task 1)
- Produces: `matchesSecret(provided, expected)` → `Promise<boolean>`; `handleActivityIngest(request, env)` → `Promise<Response>`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`workers/vh-portal/test/ingest.test.js`:

```js
import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";

const URL_INGEST = "https://vegetarianhulk.de/gipfelbuch/api/logbook/activity";
const SECRET = "test-log-secret-0123456789";

const PAYLOAD = {
  workout: "Hiking",
  started_at: "2026-08-20T06:30:00Z",
  duration_s: 7200,
  distance_m: 12520,
  elevation_m: 1071,
};

function post(body, headers = {}) {
  return SELF.fetch(URL_INGEST, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("Logbuch-Aufnahme", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM activities").run();
  });

  it("nimmt eine gueltige Aktivitaet mit korrektem Secret an", async () => {
    const response = await post(PAYLOAD, { "X-VH-Log-Secret": SECRET });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ ok: true, created: true });
  });

  it("antwortet beim zweiten identischen Senden mit 200 statt Dublette", async () => {
    await post(PAYLOAD, { "X-VH-Log-Secret": SECRET });
    const response = await post(PAYLOAD, { "X-VH-Log-Secret": SECRET });

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ created: false });

    const { results } = await env.DB.prepare("SELECT id FROM activities").all();
    expect(results).toHaveLength(1);
  });

  it("weist eine Anfrage ohne Secret ab", async () => {
    const response = await post(PAYLOAD);

    expect(response.status).toBe(401);
    const { results } = await env.DB.prepare("SELECT id FROM activities").all();
    expect(results).toHaveLength(0);
  });

  it("weist ein falsches Secret ab", async () => {
    const response = await post(PAYLOAD, { "X-VH-Log-Secret": "falsch" });

    expect(response.status).toBe(401);
  });

  it("verraet im Fehlertext nichts ueber das Secret", async () => {
    const response = await post(PAYLOAD, { "X-VH-Log-Secret": "falsch" });
    const text = await response.text();

    expect(text).not.toContain(SECRET);
  });

  it("weist eine unvollstaendige Nutzlast mit 422 ab", async () => {
    const response = await post({ workout: "Hiking" }, { "X-VH-Log-Secret": SECRET });

    expect(response.status).toBe(422);
    expect((await response.json()).errors.length).toBeGreaterThan(0);
  });

  it("weist unlesbares JSON mit 400 ab", async () => {
    const response = await SELF.fetch(URL_INGEST, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-VH-Log-Secret": SECRET },
      body: "{kaputt",
    });

    expect(response.status).toBe(400);
  });

  it("lehnt GET auf den Aufnahme-Endpunkt ab", async () => {
    const response = await SELF.fetch(URL_INGEST);

    expect(response.status).toBe(404);
  });
});
```

Zweite Testdatei für die beiden Umgebungs-Sonderfälle, `workers/vh-portal/test/ingest-env.test.js`:

```js
import { SELF, env } from "cloudflare:test";
import { describe, expect, it } from "vitest";

const URL_INGEST = "https://vegetarianhulk.de/gipfelbuch/api/logbook/activity";

const PAYLOAD = {
  workout: "Hiking",
  started_at: "2026-08-24T06:30:00Z",
  duration_s: 3600,
};

function post(headers) {
  return SELF.fetch(URL_INGEST, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(PAYLOAD),
  });
}

describe("Logbuch-Aufnahme unter besonderen Umgebungen", () => {
  it("schliesst zu, wenn das Secret in der Umgebung fehlt", async () => {
    const original = env.LOG_SECRET;
    env.LOG_SECRET = undefined;

    try {
      const response = await post({ "X-VH-Log-Secret": "irgendwas" });
      expect(response.status).toBe(503);
    } finally {
      env.LOG_SECRET = original;
    }
  });

  it("schreibt nichts, wenn der Kill-Switch aus ist", async () => {
    const original = env.PORTAL_WRITES;
    env.PORTAL_WRITES = "off";

    try {
      const response = await post({ "X-VH-Log-Secret": env.LOG_SECRET });
      expect(response.status).toBe(503);
      expect((await response.json()).error).toBe("writes_disabled");
    } finally {
      env.PORTAL_WRITES = original;
    }
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestaetigen**

```bash
cd workers/vh-portal && npm test -- ingest
```

Erwartet: FAIL — die Route gibt noch 404.

- [ ] **Step 3: Zeitkonstanten Vergleich schreiben**

`workers/vh-portal/lib/secret.js`:

```js
// Beide Seiten werden erst gehasht, damit der Vergleich immer gleich lange
// Puffer bekommt und die Laenge des Secrets nicht ueber die Laufzeit durchsickert.
async function digest(value) {
  return crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
}

export async function matchesSecret(provided, expected) {
  if (typeof provided !== "string" || typeof expected !== "string" || expected.length === 0) {
    return false;
  }

  const [a, b] = await Promise.all([digest(provided), digest(expected)]);
  return crypto.subtle.timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Route schreiben**

`workers/vh-portal/routes/logbook.js`:

```js
import { insertActivity } from "../lib/db.js";
import { errorResponse, jsonResponse } from "../lib/http.js";
import { matchesSecret } from "../lib/secret.js";
import { parseActivityPayload } from "../lib/validate.js";

export async function handleActivityIngest(request, env) {
  if (!env.LOG_SECRET) {
    console.error("LOG_SECRET fehlt — Aufnahme abgewiesen");
    return errorResponse(503, "not_configured", "Der Endpunkt ist nicht eingerichtet.");
  }

  const isAuthorised = await matchesSecret(request.headers.get("X-VH-Log-Secret"), env.LOG_SECRET);
  if (!isAuthorised) {
    return errorResponse(401, "unauthorized", "Zugang verweigert.");
  }

  if (env.PORTAL_WRITES === "off") {
    return errorResponse(503, "writes_disabled", "Schreibzugriffe sind gerade abgeschaltet.");
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return errorResponse(400, "bad_json", "Die Nutzlast ist kein gueltiges JSON.");
  }

  const parsed = parseActivityPayload(payload);
  if (!parsed.ok) {
    return jsonResponse({ error: "invalid_payload", errors: parsed.errors }, { status: 422 });
  }

  const { id, isNew } = await insertActivity(env.DB, parsed.value);

  return jsonResponse({ ok: true, id, created: isNew }, { status: isNew ? 201 : 200 });
}
```

- [ ] **Step 5: Route im Router verdrahten**

In `workers/vh-portal/worker.js` den Import ergänzen und vor dem abschließenden 404 einhängen:

```js
import { handleActivityIngest } from "./routes/logbook.js";
```

```js
  if (request.method === "POST" && path === "/api/logbook/activity") {
    return handleActivityIngest(request, env);
  }
```

- [ ] **Step 6: Test laufen lassen und Erfolg bestaetigen**

```bash
cd workers/vh-portal && npm test
```

Erwartet: alle Tests grün, davon 10 neue.

- [ ] **Step 7: Commit**

```bash
git add workers/vh-portal
git commit -m "feat(portal): Logbuch-Aufnahme mit zeitkonstantem Secret-Check und Kill-Switch"
```

---

## Task 5: Jahressummen und Streak

**Files:**
- Create: `workers/vh-portal/lib/totals.js`
- Test: `workers/vh-portal/test/totals.test.js`

**Interfaces:**
- Consumes: `Activity` aus Task 2
- Produces: `summarise(activities, today)` → `{ elevationM: number, distanceKm: number, activityCount: number, streakDays: number }`. `today` ist ein `Date`, damit die Funktion ohne Uhrzeit-Abhängigkeit testbar bleibt.

**Streak-Regel:** Zusammenhängende Tage mit mindestens einer Aktivität, rückwärts gezählt. Zählt ab heute, wenn heute etwas passiert ist, sonst ab gestern — sonst würde der Streak jeden Morgen auf null fallen, bevor Sebi trainiert hat. Liegt auch gestern nichts vor, ist der Streak null.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`workers/vh-portal/test/totals.test.js`:

```js
import { describe, expect, it } from "vitest";
import { summarise } from "../lib/totals.js";

const TODAY = new Date("2026-08-23T19:00:00.000Z");

function activity(startedAt, extra = {}) {
  return {
    id: startedAt,
    kind: "laufen",
    rawKind: "Running",
    startedAt,
    durationS: 3600,
    distanceM: 10000,
    elevationM: 100,
    kcal: null,
    avgHr: null,
    ...extra,
  };
}

describe("summarise", () => {
  it("liefert Nullwerte ohne Aktivitaeten", () => {
    expect(summarise([], TODAY)).toEqual({
      elevationM: 0,
      distanceKm: 0,
      activityCount: 0,
      streakDays: 0,
    });
  });

  it("summiert Hoehenmeter und Distanz", () => {
    const result = summarise(
      [activity("2026-08-23T06:00:00.000Z"), activity("2026-08-22T06:00:00.000Z", { elevationM: 250 })],
      TODAY
    );

    expect(result.elevationM).toBe(350);
    expect(result.distanceKm).toBe(20);
    expect(result.activityCount).toBe(2);
  });

  it("rundet die Distanz auf eine Nachkommastelle", () => {
    const result = summarise([activity("2026-08-23T06:00:00.000Z", { distanceM: 12520 })], TODAY);

    expect(result.distanceKm).toBe(12.5);
  });

  it("behandelt fehlende Messwerte als null Beitrag", () => {
    const result = summarise(
      [activity("2026-08-23T06:00:00.000Z", { distanceM: null, elevationM: null })],
      TODAY
    );

    expect(result.elevationM).toBe(0);
    expect(result.distanceKm).toBe(0);
  });

  it("zaehlt aufeinanderfolgende Tage als Streak", () => {
    const result = summarise(
      [
        activity("2026-08-23T06:00:00.000Z"),
        activity("2026-08-22T06:00:00.000Z"),
        activity("2026-08-21T06:00:00.000Z"),
      ],
      TODAY
    );

    expect(result.streakDays).toBe(3);
  });

  it("zaehlt mehrere Aktivitaeten am selben Tag nur einmal", () => {
    const result = summarise(
      [
        activity("2026-08-23T06:00:00.000Z"),
        activity("2026-08-23T18:00:00.000Z"),
        activity("2026-08-22T06:00:00.000Z"),
      ],
      TODAY
    );

    expect(result.streakDays).toBe(2);
  });

  it("laeuft weiter, wenn heute noch nichts passiert ist", () => {
    const result = summarise(
      [activity("2026-08-22T06:00:00.000Z"), activity("2026-08-21T06:00:00.000Z")],
      TODAY
    );

    expect(result.streakDays).toBe(2);
  });

  it("bricht den Streak bei einer Luecke ab", () => {
    const result = summarise(
      [activity("2026-08-23T06:00:00.000Z"), activity("2026-08-20T06:00:00.000Z")],
      TODAY
    );

    expect(result.streakDays).toBe(1);
  });

  it("liefert null, wenn die letzte Aktivitaet laenger her ist als gestern", () => {
    const result = summarise([activity("2026-08-19T06:00:00.000Z")], TODAY);

    expect(result.streakDays).toBe(0);
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestaetigen**

```bash
cd workers/vh-portal && npm test -- totals.test.js
```

Erwartet: FAIL — `lib/totals.js` existiert nicht.

- [ ] **Step 3: Implementierung schreiben**

`workers/vh-portal/lib/totals.js`:

```js
const MS_PER_DAY = 86400000;

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

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
```

- [ ] **Step 4: Test laufen lassen und Erfolg bestaetigen**

```bash
cd workers/vh-portal && npm test -- totals.test.js
```

Erwartet: 9 Tests grün.

- [ ] **Step 5: Commit**

```bash
git add workers/vh-portal/lib/totals.js workers/vh-portal/test/totals.test.js
git commit -m "feat(portal): Jahressummen und Streak-Berechnung"
```

---

## Task 6: Öffentliche JSON-Ausgabe des Logbuchs

**Files:**
- Modify: `workers/vh-portal/routes/logbook.js`
- Modify: `workers/vh-portal/worker.js`
- Test: `workers/vh-portal/test/logbook-public.test.js`

**Interfaces:**
- Consumes: `listRecentActivities`, `listActivitiesSince` (Task 2), `summarise` (Task 5)
- Produces: `handleLogbookRead(request, env)` → `Promise<Response>`. Antwortform: `{ activities: Activity[], totals: { elevationM, distanceKm, activityCount, streakDays }, year: number }`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`workers/vh-portal/test/logbook-public.test.js`:

```js
import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { insertActivity } from "../lib/db.js";

const URL_READ = "https://vegetarianhulk.de/gipfelbuch/api/logbook";

function activity(startedAt, extra = {}) {
  return {
    kind: "wandern",
    rawKind: "Hiking",
    startedAt,
    durationS: 7200,
    distanceM: 10000,
    elevationM: 500,
    kcal: null,
    avgHr: null,
    ...extra,
  };
}

describe("Oeffentliches Logbuch", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM activities").run();
  });

  it("liefert eine leere, aber vollstaendige Struktur ohne Daten", async () => {
    const response = await SELF.fetch(URL_READ);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      activities: [],
      totals: { elevationM: 0, distanceKm: 0, activityCount: 0, streakDays: 0 },
    });
  });

  it("liefert die neuesten Aktivitaeten zuerst", async () => {
    await insertActivity(env.DB, activity("2026-08-20T06:00:00.000Z"));
    await insertActivity(env.DB, activity("2026-08-22T06:00:00.000Z", { kind: "laufen" }));

    const { activities } = await (await SELF.fetch(URL_READ)).json();

    expect(activities[0].startedAt).toBe("2026-08-22T06:00:00.000Z");
  });

  it("zaehlt fuer die Summen nur das laufende Jahr", async () => {
    await insertActivity(env.DB, activity(`${new Date().getUTCFullYear() - 1}-06-01T06:00:00.000Z`));
    await insertActivity(env.DB, activity(`${new Date().getUTCFullYear()}-06-01T06:00:00.000Z`));

    const { totals } = await (await SELF.fetch(URL_READ)).json();

    expect(totals.activityCount).toBe(1);
    expect(totals.elevationM).toBe(500);
  });

  it("gibt hoechstens zehn Aktivitaeten aus", async () => {
    for (let day = 1; day <= 12; day += 1) {
      const padded = String(day).padStart(2, "0");
      await insertActivity(env.DB, activity(`2026-07-${padded}T06:00:00.000Z`));
    }

    const { activities } = await (await SELF.fetch(URL_READ)).json();

    expect(activities).toHaveLength(10);
  });

  it("erlaubt kurzes Zwischenspeichern", async () => {
    const response = await SELF.fetch(URL_READ);

    expect(response.headers.get("Cache-Control")).toContain("max-age");
  });

  it("gibt keine internen Spalten preis", async () => {
    await insertActivity(env.DB, activity("2026-08-22T06:00:00.000Z"));

    const body = await (await SELF.fetch(URL_READ)).text();

    expect(body).not.toContain("created_at");
    expect(body).not.toContain("raw_kind");
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestaetigen**

```bash
cd workers/vh-portal && npm test -- logbook-public.test.js
```

Erwartet: FAIL — die Route gibt 404.

- [ ] **Step 3: Implementierung ergaenzen**

In `workers/vh-portal/routes/logbook.js` **zuerst die bestehende Import-Zeile für `../lib/db.js` erweitern** — nicht ein zweites Mal aus demselben Modul importieren:

```js
import { insertActivity, listActivitiesSince, listRecentActivities } from "../lib/db.js";
import { summarise } from "../lib/totals.js";
```

`jsonResponse` und `errorResponse` sind aus Task 4 bereits importiert und bleiben unverändert. Danach **unten in derselben Datei** anfügen:

```js
const RECENT_LIMIT = 10;
const CACHE_SECONDS = 120;

function toPublicActivity(item) {
  return {
    kind: item.kind,
    startedAt: item.startedAt,
    durationS: item.durationS,
    distanceM: item.distanceM,
    elevationM: item.elevationM,
    kcal: item.kcal,
    avgHr: item.avgHr,
  };
}

export async function handleLogbookRead(request, env) {
  const now = new Date();
  const year = now.getUTCFullYear();

  const [recent, thisYear] = await Promise.all([
    listRecentActivities(env.DB, RECENT_LIMIT),
    listActivitiesSince(env.DB, `${year}-01-01T00:00:00.000Z`),
  ]);

  return jsonResponse(
    { activities: recent.map(toPublicActivity), totals: summarise(thisYear, now), year },
    { headers: { "Cache-Control": `public, max-age=${CACHE_SECONDS}` } }
  );
}
```

In `workers/vh-portal/worker.js`:

```js
import { handleActivityIngest, handleLogbookRead } from "./routes/logbook.js";
```

```js
  if (request.method === "GET" && path === "/api/logbook") {
    return handleLogbookRead(request, env);
  }
```

- [ ] **Step 4: Test laufen lassen und Erfolg bestaetigen**

```bash
cd workers/vh-portal && npm test
```

Erwartet: alle Tests grün, davon 6 neue.

- [ ] **Step 5: Commit**

```bash
git add workers/vh-portal
git commit -m "feat(portal): oeffentliche Logbuch-Ausgabe mit Jahressummen"
```

---

## Task 7: Das Instrument-Band auf `/gipfelbuch/`

**Files:**
- Create: `workers/vh-portal/lib/render.js`
- Create: `workers/vh-portal/routes/page.js`
- Modify: `workers/vh-portal/worker.js`
- Test: `workers/vh-portal/test/page.test.js`

**Interfaces:**
- Consumes: `handleLogbookRead`-Datenquellen (Task 6), `htmlResponse` (Task 1)
- Produces: `escapeHtml(value)` → `string`; `formatDuration(seconds)` → `string` (z. B. `"2:00 h"`); `renderGipfelbuchPage(data)` → `string`; `handleGipfelbuchPage(request, env)` → `Promise<Response>`

**Gestaltung:** Instrument-Sprache der bestehenden Wetter-HUDs — Mono-Zahlen, Hairlines, DAV-Gelb als einziger Akzent, atmender Punkt als Live-Marker. Die Seite lädt `/v3.css` von derselben Origin (nach dem Zonen-Umzug). Keine Deko-Emoji, Trenner ist die Berg-Silhouette.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`workers/vh-portal/test/page.test.js`:

```js
import { SELF, env } from "cloudflare:test";
import { beforeEach, describe, expect, it } from "vitest";
import { insertActivity } from "../lib/db.js";
import { escapeHtml, formatDuration } from "../lib/render.js";

const URL_PAGE = "https://vegetarianhulk.de/gipfelbuch/";

describe("escapeHtml", () => {
  it("entschaerft spitze Klammern und Anfuehrungszeichen", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;"
    );
  });

  it("laesst harmlosen Text unveraendert", () => {
    expect(escapeHtml("Ristfeuchthorn")).toBe("Ristfeuchthorn");
  });
});

describe("formatDuration", () => {
  it("formatiert Stunden und Minuten", () => {
    expect(formatDuration(7200)).toBe("2:00 h");
    expect(formatDuration(4500)).toBe("1:15 h");
  });

  it("formatiert weniger als eine Stunde als Minuten", () => {
    expect(formatDuration(1800)).toBe("30 min");
  });
});

describe("Gipfelbuch-Seite", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM activities").run();
  });

  it("liefert HTML aus", async () => {
    const response = await SELF.fetch(URL_PAGE);

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toContain("text/html");
  });

  it("zeigt einen Leerzustand ohne Aktivitaeten", async () => {
    const html = await (await SELF.fetch(URL_PAGE)).text();

    expect(html).toContain("Noch nichts eingetragen");
  });

  it("zeigt die Summen des Jahres", async () => {
    await insertActivity(env.DB, {
      kind: "wandern",
      rawKind: "Hiking",
      startedAt: `${new Date().getUTCFullYear()}-08-20T06:00:00.000Z`,
      durationS: 7200,
      distanceM: 12520,
      elevationM: 1071,
      kcal: null,
      avgHr: null,
    });

    const html = await (await SELF.fetch(URL_PAGE)).text();

    expect(html).toContain("1.071");
    expect(html).toContain("12,5");
  });

  it("benutzt niemals data-hm, weil v3.js das ueberschreibt", async () => {
    const html = await (await SELF.fetch(URL_PAGE)).text();

    expect(html).not.toMatch(/data-hm[=\s]/);
  });

  it("bringt keine unsichere CSP-Direktive mit", async () => {
    const html = await (await SELF.fetch(URL_PAGE)).text();

    expect(html).not.toContain("upgrade-insecure-requests");
  });

  it("setzt Titel und Beschreibung", async () => {
    const html = await (await SELF.fetch(URL_PAGE)).text();

    expect(html).toMatch(/<title>[^<]+<\/title>/);
    expect(html).toContain('name="description"');
  });
});
```

- [ ] **Step 2: Test laufen lassen und Fehlschlag bestaetigen**

```bash
cd workers/vh-portal && npm test -- page.test.js
```

Erwartet: FAIL — `lib/render.js` existiert nicht.

- [ ] **Step 3: Render-Helfer schreiben**

`workers/vh-portal/lib/render.js`:

```js
const HTML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

const KIND_LABELS = {
  wandern: "Wandern",
  laufen: "Laufen",
  radfahren: "Radfahren",
  gehen: "Gehen",
  kraft: "Krafttraining",
  schwimmen: "Schwimmen",
  sonstiges: "Training",
};

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);
}

export function formatDuration(seconds) {
  if (seconds < SECONDS_PER_HOUR) {
    return `${Math.round(seconds / SECONDS_PER_MINUTE)} min`;
  }
  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.round((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  return `${hours}:${String(minutes).padStart(2, "0")} h`;
}

export function formatNumber(value, fractionDigits = 0) {
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(value);
}

export function formatDate(isoString) {
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "short",
    timeZone: "Europe/Berlin",
  }).format(new Date(isoString));
}

export function kindLabel(kind) {
  return KIND_LABELS[kind] ?? KIND_LABELS.sonstiges;
}
```

- [ ] **Step 4: Seite schreiben**

`workers/vh-portal/routes/page.js`:

```js
import { listActivitiesSince, listRecentActivities } from "../lib/db.js";
import { htmlResponse } from "../lib/http.js";
import { escapeHtml, formatDate, formatDuration, formatNumber, kindLabel } from "../lib/render.js";
import { summarise } from "../lib/totals.js";

const RECENT_LIMIT = 10;

function renderRow(item) {
  const facts = [
    item.elevationM ? `${formatNumber(item.elevationM)} hm` : null,
    item.distanceM ? `${formatNumber(item.distanceM / 1000, 1)} km` : null,
    formatDuration(item.durationS),
  ].filter(Boolean);

  return `
    <li class="gb-row">
      <span class="gb-row__date">${escapeHtml(formatDate(item.startedAt))}</span>
      <span class="gb-row__kind">${escapeHtml(kindLabel(item.kind))}</span>
      <span class="gb-row__facts">${facts.map((fact) => `<b>${escapeHtml(fact)}</b>`).join("<i></i>")}</span>
    </li>`;
}

function renderBand(activities, totals, year) {
  if (activities.length === 0) {
    return `<p class="gb-empty">Noch nichts eingetragen. Das erste Workout landet hier automatisch.</p>`;
  }

  return `
    <dl class="gb-totals">
      <div><dt>Höhenmeter ${year}</dt><dd data-gbhm>${formatNumber(totals.elevationM)}</dd></div>
      <div><dt>Kilometer ${year}</dt><dd>${formatNumber(totals.distanceKm, 1)}</dd></div>
      <div><dt>Einheiten</dt><dd>${formatNumber(totals.activityCount)}</dd></div>
      <div><dt>Streak</dt><dd>${formatNumber(totals.streakDays)} Tage</dd></div>
    </dl>
    <ul class="gb-rows">${activities.map(renderRow).join("")}</ul>`;
}

export function renderGipfelbuchPage({ activities, totals, year }) {
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Gipfelbuch — vegetarianhulk</title>
<meta name="description" content="Das Logbuch: was zwischen den Touren passiert. Höhenmeter, Kilometer und Einheiten, direkt von der Uhr.">
<link rel="stylesheet" href="/v3.css">
<style>
  .gb-band{--gb-gold:#E8BF25;padding:clamp(28px,6vw,56px) 0;border-top:1px solid var(--earth,#cfbf9d);border-bottom:1px solid var(--earth,#cfbf9d)}
  .gb-totals{display:grid;gap:1px;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));margin:0 0 28px;padding:0}
  .gb-totals div{padding:14px 0}
  .gb-totals dt{font:500 11px/1.4 var(--ff-mono,ui-monospace,monospace);letter-spacing:.14em;text-transform:uppercase;opacity:.68}
  .gb-totals dd{margin:4px 0 0;font:600 clamp(1.6rem,4vw,2.3rem)/1 var(--ff-mono,ui-monospace,monospace);font-variant-numeric:tabular-nums}
  .gb-rows{list-style:none;margin:0;padding:0}
  .gb-row{display:grid;grid-template-columns:64px 1fr auto;gap:14px;align-items:baseline;padding:12px 0;border-top:1px solid color-mix(in srgb,var(--earth,#cfbf9d) 55%,transparent)}
  .gb-row__date,.gb-row__facts{font:500 12.5px/1.5 var(--ff-mono,ui-monospace,monospace);font-variant-numeric:tabular-nums}
  .gb-row__date{opacity:.62}
  .gb-row__facts b{font-weight:600}
  .gb-row__facts i{display:inline-block;width:1px;height:11px;margin:0 10px;vertical-align:-1px;background:currentColor;opacity:.28}
  .gb-empty{font-style:italic;opacity:.72}
  @media (prefers-reduced-motion: reduce){.gb-band *{animation:none!important;transition:none!important}}
</style>
</head>
<body>
<main class="gb-band">
  <h1>Gipfelbuch</h1>
  <p>Was zwischen den Touren passiert — direkt von der Uhr, ohne Zutun.</p>
  ${renderBand(activities, totals, year)}
</main>
</body>
</html>`;
}

export async function handleGipfelbuchPage(request, env) {
  const now = new Date();
  const year = now.getUTCFullYear();

  const [activities, thisYear] = await Promise.all([
    listRecentActivities(env.DB, RECENT_LIMIT),
    listActivitiesSince(env.DB, `${year}-01-01T00:00:00.000Z`),
  ]);

  return htmlResponse(renderGipfelbuchPage({ activities, totals: summarise(thisYear, now), year }));
}
```

In `workers/vh-portal/worker.js`:

```js
import { handleGipfelbuchPage } from "./routes/page.js";
```

```js
  if (request.method === "GET" && (path === "/" || path === "")) {
    return handleGipfelbuchPage(request, env);
  }
```

- [ ] **Step 5: Test laufen lassen und Erfolg bestaetigen**

```bash
cd workers/vh-portal && npm test
```

Erwartet: alle Tests grün, davon 11 neue.

- [ ] **Step 6: Commit**

```bash
git add workers/vh-portal
git commit -m "feat(portal): server-gerendertes Gipfelbuch mit Logbuch-Instrumentband"
```

---

## Task 8: Sichtprüfung im Browser

**Files:**
- Create: `workers/vh-portal/playwright.config.js`
- Create: `workers/vh-portal/e2e/logbuch.spec.js`
- Create: `workers/vh-portal/e2e/seed.js`

**Interfaces:**
- Consumes: laufender `wrangler dev` auf Port 8787
- Produces: Screenshots unter `workers/vh-portal/test-results/`

- [ ] **Step 1: Playwright einrichten**

`workers/vh-portal/playwright.config.js`:

```js
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://127.0.0.1:8787" },
  webServer: {
    command: "wrangler dev --port 8787 --local",
    url: "http://127.0.0.1:8787/gipfelbuch/api/health",
    reuseExistingServer: true,
    timeout: 60000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
});
```

`workers/vh-portal/e2e/seed.js`:

```js
export const SEED_SECRET = "dev-log-secret";

export async function seedActivity(request, overrides = {}) {
  const year = new Date().getUTCFullYear();

  const response = await request.post("/gipfelbuch/api/logbook/activity", {
    headers: { "X-VH-Log-Secret": SEED_SECRET },
    data: {
      workout: "Hiking",
      started_at: `${year}-08-20T06:30:00Z`,
      duration_s: 7200,
      distance_m: 12520,
      elevation_m: 1071,
      ...overrides,
    },
  });

  if (!response.ok()) {
    throw new Error(`Seed fehlgeschlagen: ${response.status()} ${await response.text()}`);
  }
}
```

> Vor dem Lauf einmalig `wrangler secret put LOG_SECRET` überspringen und stattdessen in `.dev.vars` (nicht committen, steht in `.gitignore`) `LOG_SECRET="dev-log-secret"` setzen.

- [ ] **Step 2: E2E-Test schreiben**

`workers/vh-portal/e2e/logbuch.spec.js`:

```js
import { expect, test } from "@playwright/test";
import { seedActivity } from "./seed.js";

const VIEWPORTS = [
  { name: "320", width: 320, height: 720 },
  { name: "768", width: 768, height: 1024 },
  { name: "1024", width: 1024, height: 768 },
  { name: "1440", width: 1440, height: 900 },
];

test.beforeEach(async ({ request }) => {
  await seedActivity(request);
  await seedActivity(request, { workout: "Running", started_at: `${new Date().getUTCFullYear()}-08-21T17:00:00Z`, distance_m: 8200, elevation_m: 120 });
});

for (const viewport of VIEWPORTS) {
  test(`Gipfelbuch bei ${viewport.name}px ohne Seitwaertsscrollen`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/gipfelbuch/");

    await expect(page.locator("h1")).toHaveText("Gipfelbuch");

    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1
    );
    expect(hasOverflow).toBe(false);

    await page.screenshot({ path: `test-results/gipfelbuch-${viewport.name}.png`, fullPage: true });
  });
}

test("zeigt Summen und Zeilen", async ({ page }) => {
  await page.goto("/gipfelbuch/");

  await expect(page.locator(".gb-totals dd").first()).toContainText("1.191");
  await expect(page.locator(".gb-row")).toHaveCount(2);
});

test("laeuft ohne Konsolenfehler", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });

  await page.goto("/gipfelbuch/");
  expect(errors).toEqual([]);
});

test("ist mit reduzierter Bewegung bedienbar", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/gipfelbuch/");

  await expect(page.locator(".gb-totals")).toBeVisible();
});
```

- [ ] **Step 3: Lauf ausfuehren**

```bash
cd workers/vh-portal && npx playwright install chromium webkit && npm run e2e
```

Erwartet: alle Tests grün in Chromium und WebKit.

- [ ] **Step 4: Screenshots selbst ansehen**

Die vier Screenshots unter `workers/vh-portal/test-results/` öffnen und prüfen: Stimmen Hierarchie und Rhythmus, sitzen die Zahlen tabellarisch untereinander, gibt es keine abgeschnittenen Zeilen bei 320 px? Grüne Tests sind kein Qualitätsnachweis — hier wird hingeschaut. Auffälligkeiten vor dem Commit beheben.

- [ ] **Step 5: Commit**

```bash
git add workers/vh-portal/playwright.config.js workers/vh-portal/e2e
git commit -m "test(portal): Playwright-Sichtpruefung ueber vier Viewports in Chromium und WebKit"
```

---

## Task 9: Kurzbefehl-Anleitung für Sebi

**Files:**
- Create: `docs/logbuch-kurzbefehl.md`

**Interfaces:**
- Consumes: den Endpunkt aus Task 4
- Produces: eine Anleitung, die ohne Rückfragen ausführbar ist

- [ ] **Step 1: Anleitung schreiben**

`docs/logbuch-kurzbefehl.md`:

```markdown
# Logbuch — Kurzbefehl auf dem iPhone einrichten

Einmal einrichten, danach passiert alles von allein: Sobald ein Workout endet,
landen die Zahlen im Logbuch auf vegetarianhulk.de.

## Was du brauchst
- Das Secret (bekommst du separat, nie in einer Nachricht mit Link zusammen)
- Zwei Minuten

## Kurzbefehl anlegen
1. App **Kurzbefehle** öffnen, Reiter **Kurzbefehle**, oben rechts **+**.
2. Aktion suchen: **Gesundheitsdaten finden**. Hinzufügen.
   - **Art:** Workouts
   - **Sortieren nach:** Enddatum, absteigend
   - **Limit:** 1 Element
3. Aktion **Inhalte von URL abrufen** hinzufügen.
   - **URL:** `https://vegetarianhulk.de/gipfelbuch/api/logbook/activity`
   - **Methode:** POST
   - **Header:** `X-VH-Log-Secret` = dein Secret
   - **Anfragetext:** JSON, mit diesen Feldern:

   | Schlüssel | Typ | Wert |
   |---|---|---|
   | `workout` | Text | Trainingsart des Workouts |
   | `started_at` | Text | Startdatum, Format ISO 8601 |
   | `duration_s` | Zahl | Dauer in Sekunden |
   | `distance_m` | Zahl | Distanz in Metern (leer lassen, wenn keine) |
   | `elevation_m` | Zahl | Höhenmeter (leer lassen, wenn keine) |
   | `kcal` | Zahl | Aktive Energie |
   | `avg_hr` | Zahl | Durchschnittliche Herzfrequenz |

4. Kurzbefehl **Logbuch senden** nennen, sichern.

## Automation anlegen
1. Reiter **Automation**, **+**, **Workout** wählen.
2. **Wenn:** Beliebiges Workout · **Endet**.
3. **Sofort ausführen** einschalten, **Vor dem Ausführen fragen** ausschalten.
4. Als Aktion den Kurzbefehl **Logbuch senden** wählen. Fertig.

## Prüfen ob es läuft
Nach dem nächsten Workout `https://vegetarianhulk.de/gipfelbuch/` öffnen —
die Einheit steht oben.

## Wenn nichts ankommt
- **Nichts passiert:** In der Automation prüfen, ob „Vor dem Ausführen fragen" wirklich aus ist.
- **Fehler 401:** Das Secret im Header stimmt nicht. Groß- und Kleinschreibung beachten.
- **Fehler 422:** Ein Pflichtfeld ist leer. `workout`, `started_at` und `duration_s` müssen belegt sein.
- **Fehler 503:** Schreibzugriffe sind abgeschaltet oder das Secret ist serverseitig nicht gesetzt.
- **Doppelte Einträge:** Kann nicht passieren — gleiche Sportart plus gleiche Startzeit wird erkannt und nicht doppelt gespeichert.
```

- [ ] **Step 2: Commit**

```bash
git add docs/logbuch-kurzbefehl.md
git commit -m "docs: Klickanleitung fuer die Logbuch-Automation auf dem iPhone"
```

---

## Task 10: Bereitstellung vorbereiten (wartet auf Sebi)

**Files:**
- Create: `scripts/dns-abgleich.sh`
- Modify: `workers/vh-portal/wrangler.toml`
- Create: `docs/berg-portal-deploy.md`

**Interfaces:**
- Consumes: alles Bisherige
- Produces: eine abhakbare Bereitstellungsliste

> **Gate:** Dieser Task wird erst ausgeführt, wenn Sebi entschieden hat, ob vegetarianhulk einen **eigenen Cloudflare-Account** bekommt, und die Nameserver umgestellt sind. Bis dahin bleibt alles Vorherige lokal lauffähig.

- [ ] **Step 1: Abgleichliste der DNS-Records erzeugen**

`scripts/dns-abgleich.sh`:

```bash
#!/usr/bin/env bash
# Liest die aktuell aktiven DNS-Records von vegetarianhulk.de aus, damit nach
# dem Cloudflare-Umzug Eintrag fuer Eintrag verglichen werden kann.
# Aufruf:  ./scripts/dns-abgleich.sh > dns-vorher.txt
set -euo pipefail

DOMAIN="vegetarianhulk.de"

echo "# DNS-Abgleich ${DOMAIN} — $(date -u +%Y-%m-%dT%H:%M:%SZ)"
for record in NS A AAAA MX TXT CAA; do
  echo
  echo "## ${record}"
  dig +short "${record}" "${DOMAIN}" || true
done

for name in www _dmarc; do
  echo
  echo "## ${name}.${DOMAIN}"
  dig +short ANY "${name}.${DOMAIN}" || true
done

echo
echo "## Brevo DKIM"
dig +short TXT "mail._domainkey.${DOMAIN}" || true
```

Ausführbar machen und laufen lassen:

```bash
chmod +x scripts/dns-abgleich.sh
./scripts/dns-abgleich.sh > /tmp/dns-vorher.txt && cat /tmp/dns-vorher.txt
```

- [ ] **Step 2: Datenbank anlegen und ID eintragen**

```bash
cd workers/vh-portal
wrangler d1 create vh-portal
```

Die ausgegebene `database_id` ersetzt den Platzhalter in `wrangler.toml`.

- [ ] **Step 3: Route eintragen**

In `workers/vh-portal/wrangler.toml` ergänzen:

```toml
[[routes]]
pattern = "vegetarianhulk.de/gipfelbuch/*"
zone_name = "vegetarianhulk.de"
```

- [ ] **Step 4: Secret setzen und ausrollen**

```bash
cd workers/vh-portal
wrangler secret put LOG_SECRET
wrangler d1 migrations apply vh-portal --remote
wrangler deploy
```

- [ ] **Step 5: Auslieferung gegen die echte Domain pruefen**

```bash
curl -sI https://vegetarianhulk.de/gipfelbuch/ | head -5
curl -s  https://vegetarianhulk.de/gipfelbuch/api/health
curl -sI https://vegetarianhulk.de/ | head -3          # GitHub Pages muss unveraendert antworten
curl -sI https://vegetarianhulk.de/touren/ | head -3   # ebenso
dig +short NS vegetarianhulk.de
```

Erwartet: `/gipfelbuch/` kommt vom Worker, alles andere weiterhin von GitHub Pages, Nameserver zeigen auf Cloudflare.

- [ ] **Step 6: Bereitstellungsliste festhalten**

`docs/berg-portal-deploy.md`:

```markdown
# Berg-Portal — Bereitstellung

## Vor jedem Deploy
1. `cd workers/vh-portal && npm test` — muss vollständig grün sein.
2. `npm run e2e` — Chromium und WebKit, Screenshots angesehen.
3. Migrationen geprüft: `wrangler d1 migrations list vh-portal --remote`.

## Deploy
```bash
cd workers/vh-portal
wrangler d1 migrations apply vh-portal --remote
wrangler deploy
```

## Danach immer prüfen
```bash
curl -sI https://vegetarianhulk.de/gipfelbuch/ | head -5
curl -s  https://vegetarianhulk.de/gipfelbuch/api/health
curl -sI https://vegetarianhulk.de/ | head -3
curl -sI https://vegetarianhulk.de/touren/ | head -3
```
`/gipfelbuch/` kommt vom Worker, alles andere unverändert von GitHub Pages.

## Rollback
Route in `wrangler.toml` auskommentieren und `wrangler deploy`. Der Pfad
`/gipfelbuch/*` fällt damit an GitHub Pages zurück (404), die Datenbank bleibt
unberührt. Kein Datenverlust.

## Wenn `/gipfelbuch/` öffentlich beworben wird
Erst dann, und dann in einem Zug: Eintrag in `sitemap.xml`, Verlinkung in der
Navigation, Aufnahme in die Zähl-Whitelist und Abgleich der CSP. Eine neue
Fläche halb einzuhängen ist die Falle aus `learning_fix_erreicht_die_auslieferung_nicht`.

## Kill-Switch
```bash
wrangler deploy --var PORTAL_WRITES:off
```
Lesen bleibt möglich, Schreibzugriffe antworten mit 503.
```

- [ ] **Step 7: Commit**

```bash
git add scripts/dns-abgleich.sh workers/vh-portal/wrangler.toml docs/berg-portal-deploy.md
git commit -m "chore(portal): Bereitstellung vorbereitet — DNS-Abgleich, Route, Deploy-Liste"
```

---

## Task 11: `vh-forms` von PEAKING lösen (wartet auf Task 10)

**Files:**
- Modify: `workers/vh-forms/wrangler.toml`
- Modify: `newsletter-form.js:20`
- Modify: `anfrage.html:360`
- Modify: `launch-gate.js:20`

**Interfaces:**
- Consumes: die Cloudflare-Zone aus Task 10
- Produces: `vh-forms` erreichbar unter `vegetarianhulk.de/api/forms/*`, keine `peaking.workers.dev`-Adresse mehr im VH-Repo

> **Gate:** Erst nach erfolgreichem Task 10. Diese Änderung berührt zwei live genutzte Formulare — Newsletter und Brand-Anfrage. Reihenfolge strikt einhalten: erst neue Route zusätzlich aufschalten, dann Frontend umstellen, dann prüfen, erst danach die alte Adresse abschalten.

- [ ] **Step 1: Neue Route zusaetzlich aufschalten**

In `workers/vh-forms/wrangler.toml` ergänzen, `workers_dev` vorerst auf `true` lassen:

```toml
[[routes]]
pattern = "vegetarianhulk.de/api/forms/*"
zone_name = "vegetarianhulk.de"
```

In `workers/vh-forms/worker.js` direkt nach dem Anlegen von `url` das Präfix abschneiden, damit beide Adressen dieselben Routen treffen. Der Rest der Datei bleibt unverändert, weil danach weiter gegen `url.pathname` verglichen wird:

```js
const FORMS_PREFIX = "/api/forms";

// Beide Adressen bedienen: die alte workers.dev-Form und die neue Zonen-Route.
// Wird nach Task 11 Step 6 nicht mehr gebraucht, schadet aber auch dann nicht.
if (url.pathname.startsWith(FORMS_PREFIX)) {
  url.pathname = url.pathname.slice(FORMS_PREFIX.length) || "/";
}
```

Deployen mit `cd workers/vh-forms && wrangler deploy`.

- [ ] **Step 2: Beide Adressen pruefen**

```bash
curl -si https://vegetarianhulk.de/api/forms/newsletter/confirm | head -3
curl -si https://vh-forms.peaking.workers.dev/newsletter/confirm | head -3
```

Erwartet: beide antworten identisch.

- [ ] **Step 3: Frontend umstellen**

In `newsletter-form.js:20`, `launch-gate.js:20` und `anfrage.html:360` jeweils
`https://vh-forms.peaking.workers.dev` durch `https://vegetarianhulk.de/api/forms` ersetzen.
Anschließend die `preconnect`-Zeile in `newsletter/index.html` mitziehen.

- [ ] **Step 4: Cache-Bust ziehen**

```bash
./scripts/bump-asset-versions.sh
```

Diff mitcommitten — sonst hält der Instagram-In-App-Browser die alte Datei fest.

- [ ] **Step 5: Beide Formulare von Hand durchklicken**

Newsletter-Anmeldung mit einer Wegwerf-Adresse und die Brand-Anfrage einmal komplett absenden, jeweils bis zur Bestätigungsmail. Ohne diesen Schritt geht nichts weiter.

- [ ] **Step 6: Alte Adresse abschalten**

Erst jetzt in `workers/vh-forms/wrangler.toml` `workers_dev = false` setzen und erneut deployen. Danach prüfen, dass `vh-forms.peaking.workers.dev` nicht mehr antwortet und die Formulare weiterhin funktionieren.

- [ ] **Step 7: Commit**

```bash
git add workers/vh-forms newsletter-form.js launch-gate.js anfrage.html newsletter/index.html
git commit -m "refactor(forms): vh-forms auf eigene VH-Route, peaking.workers.dev abgeschaltet"
```

---

## Abschluss dieses Plans

Nach Task 11 läuft das Logbuch live, die Trennung von PEAKING ist vollzogen, und das Fundament für die restlichen Pakete steht. Die nächsten Pläne entstehen einzeln, wenn dieser durch ist:

- **T2 Zugang** — Registrierung, Bestätigung, Magic Link, Konto, Export, Löschung
- **T3 Tourenbuch** — Tour anlegen, Fotos, eigene Seite, Sichtbarkeit, Teilen
- **T4 Kuration** — Admin-Liste, Hervorheben, Feed auf `/touren/`, Startseiten-CTA, Melden
- **T5 Abschluss** — Datenschutz, Nutzungsbedingungen, Security-Sweep, QA-Gate, Release
