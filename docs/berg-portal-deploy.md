# Berg-Portal — Bereitstellung

Gilt für den Worker `vh-portal` (`workers/vh-portal/`).

## Voraussetzung, einmalig

Der Worker läuft bewusst **ohne** `workers.dev` — die workers.dev-Subdomain
dieses Cloudflare-Accounts heißt „peaking", und PEAKING bleibt von VH getrennt.
Erreichbar ist er deshalb ausschließlich über die Zonen-Route. Das setzt den
Cloudflare-Umzug voraus: `docs/dns-umzug-cloudflare.md`.

Danach einmalig:

```bash
cd workers/vh-portal
wrangler d1 create vh-portal          # database_id in wrangler.toml eintragen
wrangler secret put LOG_SECRET        # derselbe Wert wie im iPhone-Kurzbefehl
```

Und in `wrangler.toml` die Route ergänzen:

```toml
[[routes]]
pattern = "vegetarianhulk.de/gipfelbuch/*"
zone_name = "vegetarianhulk.de"
```

## Vor jedem Deploy

```bash
cd workers/vh-portal
npm test          # muss vollstaendig gruen sein
npm run e2e       # Chromium und WebKit
```

Screenshots unter `test-results/` **ansehen**, nicht nur auf grün vertrauen.
Zusätzlich der Leerzustand, wenn an der Gestaltung etwas geändert wurde:

```bash
npx wrangler d1 execute vh-portal --local --command "DELETE FROM activities"
VH_EMPTY_CHECK=1 npx playwright test e2e/leerzustand.spec.js --project=chromium
```

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
curl -sI https://vegetarianhulk.de/ | head -3          # weiter GitHub Pages
curl -sI https://vegetarianhulk.de/touren/ | head -3   # ebenso
```

Erwartet: `/gipfelbuch/` kommt vom Worker, alles andere unverändert von GitHub
Pages. Zusätzlich die Seite im Browser öffnen — lädt `/v3.css` und
`/fonts.css`? Ohne die Shell ist die Seite ungestylt, und genau das fällt in
einem `curl` nicht auf.

## Rollback

Route in `wrangler.toml` auskommentieren, `wrangler deploy`. `/gipfelbuch/*`
fällt an GitHub Pages zurück (404), die Datenbank bleibt unberührt. Kein
Datenverlust, jederzeit wieder einschaltbar.

## Kill-Switch

```bash
cd workers/vh-portal
wrangler deploy --var PORTAL_WRITES:off
```

Lesen bleibt möglich, Schreibzugriffe antworten mit 503. Der Kurzbefehl auf dem
iPhone bekommt dann einen Fehler, verliert aber nichts — beim nächsten Senden
greift die Idempotenz.

## Wenn `/gipfelbuch/` öffentlich beworben wird

Aktuell trägt die Seite `noindex`. Sobald sie beworben wird, in **einem Zug**:
Eintrag in `sitemap.xml`, Verlinkung in der Navigation, Aufnahme in die
Zähl-Whitelist, `noindex` entfernen und die CSP abgleichen. Eine neue Fläche
halb einzuhängen ist die Falle aus
`learning_fix_erreicht_die_auslieferung_nicht`.

## Cache-Verhalten

`/v3.css` und `/fonts.css` werden **ohne** `?v=`-Hash verlinkt:
`scripts/bump-asset-versions.sh` schließt `workers/` bewusst aus. GitHub Pages
liefert `max-age=600`, ein veraltetes Stylesheet hält also höchstens zehn
Minuten. Die Seite selbst antwortet mit `max-age=120`.
