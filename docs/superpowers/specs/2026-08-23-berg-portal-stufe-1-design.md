# Berg-Portal Stufe 1 — Digitales Tourenbuch (Design-Spec)

Datum: 2026-08-23 · Repo: `vegetarianhulk` · Status: abgestimmt mit Sebi, wartet auf Spec-Review

Vorgänger-Kontext: `touren/HUB-WORKFLOW.md` (SSoT für kuratierte Touren, bleibt gültig).

---

## 1. Problem

`/touren/` lebt heute von Sebis eigenen Touren. Sebi kommt selten dazu, neue Touren zu gehen — der
Hub stagniert zwischen den Touren. Zwei Lücken:

1. **Zwischen den Touren passiert sichtbar nichts**, obwohl Sebi mehrmals pro Woche trainiert.
2. **Besucher können nur lesen.** Es gibt keinen Grund wiederzukommen und nichts, was sie teilen.

## 2. Ziel

Das analoge Gipfelbuch digital: Jeder Besucher legt ein **eigenes Tourenbuch** an und trägt seine
Touren ein. Jede Tour wird eine **echte Seite im Ristfeuchthorn-Format**, die er teilen kann.
Parallel hält ein **Logbuch** von Sebis Apple Watch die Seite zwischen den Touren am Leben.

---

## 3. Verbindliche Entscheidungen (Brainstorm 23.08.2026)

| Thema | Entscheidung |
|---|---|
| Zugang | Konto per **E-Mail-Bestätigung** (DOI-Mechanik), kein Passwort. Newsletter = **freiwilliges Häkchen** auf demselben Formular |
| Tourseite | **Fotos ja, GPX nein.** Kein Höhenprofil, keine Karte in Stufe 1 |
| Freigabe | Eigene Seite **sofort öffentlich** und teilbar. Haupt-Feed und `/touren/` sind **von Sebi kuratiert** |
| Identität | **Frei wählbarer Anzeigename + Handle**, optional verlinktes Instagram. E-Mail nie öffentlich |
| Privatsphäre | **Schalter pro Tour**, Standard öffentlich |
| Sebis Aktivitäten | **Apple-Watch-Kurzbefehl** → Logbuch. Kein Strava-API |
| Release | **Nicht einzeln deployen.** Geht gebündelt mit dem nächsten Website-Release aus `origin/main` raus |

## 4. Nicht-Ziele in Stufe 1

Bewusst draußen, damit Stufe 1 lieferbar bleibt:

- GPX-Upload, Höhenprofil, Karte für User-Touren
- Badges, Bestenlisten, Höhenmeter-Jahresziele, Gipfel-Sammlung
- Kommentare, Likes, Folgen, Benachrichtigungen
- Strava-Embed (siehe 5.3 — nach Stufe 1 nachrüstbar)
- Passwörter, OAuth-Logins, native App

---

## 5. Rechtlicher Rahmen

### 5.1 Strava — geprüft und verworfen

Strava API Policy, geprüft am 23.08.2026:

- **§2.3 / §6.1** — Strava-Daten dürfen nur **dem Athleten selbst** angezeigt werden, nicht Dritten.
- **§5.4** — gilt ausdrücklich auch **aggregiert, de-identifiziert oder anonymisiert**. Ein
  „nicht 1:1"-Umbau ist kein Ausweg.
- **§6.2** — Strava-Daten dürfen **max. 7 Tage** zwischengespeichert werden. Ein Archiv wäre selbst
  intern unzulässig.
- **§5.5** — Scraping als Umgehung ebenfalls untersagt.

Attribution oder ein „Partner"-Hinweis ändert daran nichts; die Policy kennt keine
Attributions-Ausnahme und verlangt selbst keine.

**Folge:** Kein Strava-API-Feed. Die Daten stammen ohnehin von Sebis Apple Watch — wir greifen eine
Station früher ab und verlieren dabei nur die GPS-Route, die in Stufe 1 nicht gebraucht wird.

**Später zulässig, falls gewünscht:** offizieller Strava-Embed pro Highlight-Tour (Strava-eigene
Sharing-Funktion, sichtbar Strava-gebrandet) — braucht ein Consent-Gate wegen Drittanbieter-Cookies
und US-Transfer. Und der Strava-Datenexport aus den Kontoeinstellungen (Datenportabilität, kein
API-Vertrag) als Quelle für Handarbeit an kuratierten Touren.

### 5.2 Kopplungsverbot

Newsletter-Pflicht als Zugangsvoraussetzung wäre nach DSGVO Art. 7 Abs. 4 angreifbar: Die
Einwilligung gilt nicht als freiwillig, wenn ein Dienst davon abhängt, und Werbung ist für ein
Tourenbuch nicht erforderlich. Deshalb getrennt:

- **Registrierung = E-Mail bestätigen.** Liefert die gewünschte Sicherheit (verifizierte Identität,
  kein anonymes Reinschreiben, kein Bot). Rechtsgrundlage Art. 6 Abs. 1 lit. b.
- **Newsletter = optionales Häkchen** auf demselben Formular, ungesetzt vorbelegt.
  Rechtsgrundlage Art. 6 Abs. 1 lit. a, eigene DOI-Strecke wie bisher.

### 5.3 Nutzergenerierte Inhalte

Nutzungsbedingungen mit Versionsstand, die der User beim Anlegen bestätigt: Rechteeinräumung an
den hochgeladenen Fotos, Zusicherung eigener Bildrechte, Mindestalter 16, Verbot rechtswidriger
Inhalte. Dazu Melde-Funktion und Sebi-Kill-Switch (siehe 11).

---

## 6. Architektur

### 6.1 Hosting-Voraussetzung (Sebi-Aktion, blockierend)

Ist-Zustand: DNS bei united-domains, Site auf GitHub Pages, `vh-forms` auf
`vh-forms.peaking.workers.dev`.

Ein Login über Domaingrenzen hinweg scheitert: ein Session-Cookie von `*.workers.dev` ist auf
`vegetarianhulk.de` ein Third-Party-Cookie und wird von Safari verworfen. Außerdem brauchen
teilbare Tourseiten server-gerenderte OG-Tags — WhatsApp und Instagram führen kein JavaScript aus.

**Lösung:** Zone `vegetarianhulk.de` zu Cloudflare (Free), Apex und `www` proxied, Worker-Route
`vegetarianhulk.de/gipfelbuch/*` → `vh-portal`. Alles andere läuft unverändert auf GitHub Pages.

Damit: gleiche Origin → echtes `__Host-`-Session-Cookie, keine CORS-Sonderfälle, saubere URLs
`vegetarianhulk.de/gipfelbuch/<handle>/<slug>`, server-gerenderte OG-Tags, Fotos aus R2 unter
eigener Domain.

Cloudflare bietet Teil-Setup per CNAME erst ab Business — die Zone muss also vollständig umziehen.
Vor dem Umzug wird die vorhandene Zonendatei bei united-domains 1:1 als Abgleichliste exportiert
(A/AAAA für GitHub Pages, `www`-CNAME, MX, SPF/DKIM/DMARC von Brevo, TXT-Verifizierungen).

> ⚠️ `feedback_github_pages_cname_trap` beachten: die `CNAME`-Datei im Repo bleibt unangetastet, und
> nach dem Umzug wird GitHub Pages „Enforce HTTPS" verifiziert, bevor irgendetwas anderes passiert.

**Fallback, falls Sebi den Umzug nicht will:** Worker bleibt auf `workers.dev`, Session per Token im
`localStorage` mit `Authorization`-Header und CORS. Funktioniert, ist aber XSS-anfälliger, hat
hässliche URLs und schwächeres Teilen. Nicht empfohlen.

### 6.2 Komponenten

Neuer Worker **`vh-portal`** unter `workers/vh-portal/`. `vh-forms` bleibt unangetastet — saubere
Grenze: Formulare verschicken Mails, Portal hält Daten. (`vh-forms` liegt mit 369 Zeilen ohnehin nah
an der Datei-Obergrenze.)

```
workers/vh-portal/
  worker.js        Einstieg + Router
  routes/auth.js   Registrierung, Bestätigung, Magic Link, Session, Konto-Löschung
  routes/tours.js  Tour anlegen/ändern/löschen, Sichtbarkeit
  routes/photos.js Upload, Auslieferung aus R2
  routes/public.js Buch-Seiten, Tourseiten, Feed (server-gerendertes HTML)
  routes/logbook.js Aufnahme vom Kurzbefehl, öffentliche Ausgabe
  routes/admin.js  Hervorheben, Sperren, Meldungen
  lib/db.js        D1-Zugriff
  lib/validate.js  Schema-Validierung an der Systemgrenze
  lib/auth.js      Token, Session, HMAC
  lib/turnstile.js Verify, fail-closed
  lib/render.js    HTML-Bausteine in v3-Sprache
  lib/mail.js      Brevo transaktional
  migrations/
```

Alle Dateien unter 400 Zeilen. Bindings: D1 `vh-portal`, R2 `vh-portal-fotos`, KV `vh-portal-rl`
(Rate-Limits mit TTL). Alles Cloudflare Free Tier.

### 6.3 Datenmodell (D1)

```sql
accounts(
  id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, handle TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL, instagram TEXT, role TEXT NOT NULL DEFAULT 'user',
  status TEXT NOT NULL DEFAULT 'pending',        -- pending | active | blocked
  newsletter_opt_in INTEGER NOT NULL DEFAULT 0, terms_version TEXT NOT NULL,
  created_at TEXT NOT NULL, confirmed_at TEXT, last_login_at TEXT)

auth_tokens(
  token_hash TEXT PRIMARY KEY,                    -- SHA-256, nie Klartext
  account_id TEXT NOT NULL, purpose TEXT NOT NULL,-- confirm | login
  expires_at TEXT NOT NULL, used_at TEXT)

sessions(id TEXT PRIMARY KEY, account_id TEXT NOT NULL,
  created_at TEXT NOT NULL, expires_at TEXT NOT NULL, revoked_at TEXT)

tours(
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL, slug TEXT NOT NULL,
  title TEXT NOT NULL, summit_name TEXT, region TEXT, summit_m INTEGER,
  hiked_on TEXT NOT NULL, distance_km REAL, elevation_m INTEGER,
  duration_min INTEGER, sac TEXT, note TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',      -- public | private
  featured INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'published',       -- published | blocked
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE(account_id, slug))

tour_photos(id TEXT PRIMARY KEY, tour_id TEXT NOT NULL, r2_key TEXT NOT NULL,
  mime TEXT NOT NULL, width INTEGER, height INTEGER, bytes INTEGER,
  position INTEGER NOT NULL, alt TEXT, created_at TEXT NOT NULL)

activities(id TEXT PRIMARY KEY, kind TEXT NOT NULL, started_at TEXT NOT NULL,
  duration_s INTEGER, distance_m INTEGER, elevation_m INTEGER,
  kcal INTEGER, avg_hr INTEGER, created_at TEXT NOT NULL)

reports(id TEXT PRIMARY KEY, tour_id TEXT NOT NULL, reason TEXT,
  created_at TEXT NOT NULL, handled_at TEXT)
```

Kein Feld für IP-Adressen. Rate-Limiting nutzt einen gehashten Kurzzeit-Schlüssel in KV mit TTL.

### 6.4 Endpunkte

Alle unter `/gipfelbuch/`.

**Öffentlich (HTML, server-gerendert):**
`GET /gipfelbuch/` · `GET /gipfelbuch/<handle>/` · `GET /gipfelbuch/<handle>/<slug>`

**Öffentlich (JSON, für die statischen Seiten):**
`GET /gipfelbuch/api/feed` (nur `featured`) · `GET /gipfelbuch/api/logbook`

**Zugang:** `POST api/auth/register` · `GET api/auth/confirm` · `POST api/auth/login` ·
`GET api/auth/callback` · `POST api/auth/logout` · `GET|PATCH|DELETE api/me` · `GET api/me/export`

**Tourenbuch (Session nötig):** `POST|PATCH|DELETE api/tours[/:id]` ·
`POST api/tours/:id/photos` · `DELETE api/photos/:id`

**Sonstiges:** `GET foto/:key` (R2, `immutable`) · `POST api/reports` ·
`POST api/logbook/activity` (Header `X-VH-Log-Secret`) · `api/admin/*` (Rolle `admin`)

---

## 7. Subsystem A — Zugang

Registrierung: E-Mail, Anzeigename, Handle, Pflicht-Häkchen Nutzungsbedingungen und
Datenschutz, optionales Häkchen Newsletter, Turnstile. Antwort ist immer identisch, egal ob die
Mail schon existiert (keine Konto-Aufzählung). Bestätigungsmail über Brevo mit Einmal-Token,
24 Stunden gültig. Klick aktiviert das Konto und setzt die Session.

Ist das Newsletter-Häkchen gesetzt, läuft dafür die **bestehende Brevo-DOI-Strecke getrennt** —
zwei Mails, eine fürs Konto, eine für den Newsletter. Das ist der Preis der Entkopplung und
zugleich der Beleg, dass die Werbeeinwilligung eigenständig erteilt wurde. Zusammenlegen würde
genau die Kopplung wiederherstellen, die 5.2 vermeidet.

Späterer Login: E-Mail eingeben, Magic Link, 30 Minuten gültig, einmalig verwendbar.

Handle: `[a-z0-9-]{3,24}`, gegen eine Sperrliste geprüft (`api`, `admin`, `foto`, `feed`, `sebi`,
`vegetarianhulk`, `neu`, `login` …), nach Vergabe unveränderlich, weil er in geteilten Links steckt.

Konto-Löschung: `DELETE api/me` löscht Konto, Touren, Fotos aus R2 und Sessions, bestätigt per Mail.
Newsletter-Abmeldung läuft getrennt über Brevo — Konto löschen meldet nicht automatisch ab und
umgekehrt.

## 8. Subsystem B — Tourenbuch und Tourseite

Formular in Sebis Sprache, nicht als Datenbank-Maske. Pflicht: Titel, Datum. Optional: Gipfel,
Region, Gipfelhöhe, Distanz, Höhenmeter, Gehzeit, SAC-Skala, Notiz, bis zu **3 Fotos**.
Sichtbarkeitsschalter, Standard öffentlich.

Die Tourseite erbt die fixierte Reihenfolge aus `touren/HUB-WORKFLOW.md`, reduziert auf das, was
ohne GPX trägt: Foto-Hero mit Overlay → Fakten-Strip → handschriftliche Notiz mit Signatur →
Teilen-Zeile → Rückweg ins Buch. **Kein Höhenprofil**, weil es ohne echte Daten erfunden wäre
(Standing Rule „nichts erfinden"). Ohne Foto komponiert sich die Seite typografisch, ohne Lücke.

Der Hub baut auf ein Foto pro Tour — drei sind die Obergrenze, nicht die Erwartung.

### Foto-Pipeline

**Im Browser vor dem Upload:** `createImageBitmap(file, {imageOrientation: 'from-image'})` → Canvas
→ lange Kante max. 2000 px → `toBlob('image/webp', 0.82)`, Rückfall auf JPEG. Das dreht das Bild
korrekt **und entfernt sämtliche EXIF-Daten — inklusive der GPS-Koordinaten**, die iPhone-Fotos
mitbringen. Ein Wohnort im Bild-Metadatum wäre sonst genau die Art Datenleck, die keiner erwartet.

HEIC kann Chrome nicht dekodieren. Schlägt das Dekodieren fehl, kommt ein klarer Hinweis statt eines
stillen Fehlers: „iPhone: Einstellungen → Kamera → Formate → Maximale Kompatibilität."

**Im Worker:** Magic Bytes prüfen (nicht den Dateinamen), max. 2 MB, max. 3 pro Tour, Zufallsschlüssel
in R2, Auslieferung mit `nosniff` und langem `immutable`-Cache.

## 9. Subsystem C — Logbuch

Kurzbefehl-Automation auf dem iPhone, Auslöser „Workout endet": `Find Health Samples` →
`Get Contents of URL` POST mit `X-VH-Log-Secret`. Felder: Sportart, Start, Dauer, Distanz,
Höhenmeter, kcal, Ø-Puls. Kein GPS. Sebi bekommt eine klickgenaue Anleitung.

Öffentlich als Instrument-Band in der Sprache der bestehenden Wetter-HUDs und Altimeter-Rails:
Mono-Zahlen, Hairlines, DAV-Gelb, atmender Smashy als Live-Marker. Dazu laufende Summen —
Höhenmeter dieses Jahr, Kilometer, Streak.

Wird **zuerst** gebaut: kleinster Umfang, hängt an niemandem außer Sebi, und testet die komplette
Kette (Route, D1, Ausgabe, CSP, Cache) bevor Nutzerdaten im Spiel sind.

## 10. Subsystem D — Kuration und Teilen

Jede öffentliche Tour ist sofort unter ihrem Link erreichbar, erscheint aber **nicht automatisch**
im Haupt-Feed oder auf `/touren/`. Sebi hebt aus einer Admin-Liste hervor, was er zeigen will.
Damit ist er nicht der Flaschenhals und behält trotzdem die Kuration.

Nicht hervorgehobene Seiten tragen `noindex` — schützt die investierte SEO-Arbeit vor dünnen
Duplikaten und begrenzt die Angriffsfläche. Beim Hervorheben fällt `noindex` weg und die Seite
wandert in Sitemap und Feed.

Teilen: server-gerenderte OG- und Twitter-Tags pro Tour, dazu eine OG-Grafik aus Foto, Titel und
Zahlen. „Link kopieren" per `navigator.clipboard`.

## 11. Flächen

| Fläche | Inhalt |
|---|---|
| `/gipfelbuch/` | Logbuch-Band oben, darunter kuratierter Feed, daneben „Eigenes Buch anlegen" |
| `/gipfelbuch/<handle>/` | Persönliches Tourenbuch, öffentliche Touren, optional Instagram-Link |
| `/gipfelbuch/<handle>/<slug>` | Tourseite im Ristfeuchthorn-Format |
| `/touren/` | Verdichteter Feed hervorgehobener User-Touren, deutlich abgesetzt von Sebis kuratierten |
| `/touren/<slug>/` | Block „Wer war auch oben" mit hervorgehobenen Touren zum selben Gipfel |
| Startseite | Der bestehende CTA „Deine Zeile ist noch frei" zeigt endlich aufs echte Buch statt auf `/newsletter` |

Gestaltung erbt v3 vollständig: Buch-Doppelseite, Caveat-Handschrift, liniertes Papier, Falz, Grain,
geprägte Emaille-Buttons, `.hsep` als Trenner, keine Deko-Emoji, keine schwebenden Bubbles. Neue
Klassen seitenlokal mit `.gb-`.

> ⚠️ Daten-Attribute **namespacen** (`data-gbhm`, nicht `data-hm`). Die geteilte `v3.js`
> überschreibt jedes `[data-hm]` mit dem Altimeter-Wert und hat damit schon einmal eine ganze
> Tourenliste zerstört.

---

## 12. Sicherheit

- Turnstile fail-closed bei Registrierung, Login und Meldung — wie im bestehenden Worker.
- Tokens: 32 Zufallsbytes, gespeichert als SHA-256, einmalig, mit Ablauf. Nie im Klartext in D1,
  nie in Logs.
- Session: `__Host-vhp`, HttpOnly, Secure, SameSite=Lax, 90 Tage, bei Login rotierend, serverseitig
  widerrufbar.
- CSRF: SameSite plus Origin-Prüfung plus Pflicht-Header bei allen schreibenden Anfragen.
- Alle Ausgaben escaped. Notiztext ist Klartext, kein HTML, nirgends `innerHTML`.
- Autorisierung pro Objekt: fremde `tour_id` ergibt 403, private Tour für Fremde 404 (nicht 403 —
  sonst verrät die Antwort ihre Existenz).
- Rate-Limits in KV: Registrierung 5/h pro IP-Hash, Login 5/h pro Mail, 10 Touren/Tag und
  30 Fotos/Tag pro Konto.
- Secrets nur über `wrangler secret`. Kill-Switch `PORTAL_WRITES=off` friert alle Schreibpfade ein.
- CSP für die Portal-Seiten mit `sha256`-Hashes wie auf dem Rest der Site, ohne
  `upgrade-insecure-requests` (bricht Safari auf localhost).
- Security-Sweep vor dem Merge, `CRITICAL` blockt.

## 13. DSGVO

- **Rechtsgrundlagen:** Konto und Tourenbuch Art. 6 Abs. 1 lit. b · Newsletter lit. a ·
  Spam-Schutz und Missbrauchsabwehr lit. f.
- **Datenschutzerklärung** ergänzen: Konto, Touren, Fotos, Speicherdauern, Cloudflare als
  Auftragsverarbeiter inkl. AVV. Brevo-AVV besteht bereits.
- **Auskunft:** `GET api/me/export` liefert alles als JSON.
- **Löschung:** vollständig inklusive R2-Objekte, mit Bestätigungsmail.
- **Aufbewahrung:** unbestätigte Registrierungen nach 7 Tagen automatisch weg, abgelaufene Tokens
  täglich, Sessions nach 90 Tagen.
- **Keine IP-Speicherung.** Kein Analytics-Cookie. Keine Drittanbieter-Einbindung — deshalb ist im
  Portal kein Consent-Banner nötig.
- **Foto-EXIF** wird clientseitig entfernt; der Worker verlässt sich nicht darauf.
- **Meldeweg** und Kill-Switch für rechtswidrige Inhalte, Impressum besteht.

## 14. Tests

**Unit** (Vitest + Workers-Pool): Validierung, Handle- und Slug-Regeln, Token-Hashing und Ablauf,
Sichtbarkeitslogik, Logbuch-Summen.

**Integration** gegen lokale D1 — mit Negativtests, weil genau die in diesem Repo schon zweimal
gefehlt haben:

- private Tour ist für Fremde **404**, für den Eigentümer 200
- nicht hervorgehobene Tour taucht **nicht** in `api/feed` auf
- unbestätigtes Konto kann **nicht** schreiben
- abgelaufener und bereits benutzter Token werden abgewiesen
- fehlendes Turnstile-Secret → **fail-closed**, nicht offen
- fremde `tour_id` → 403 · Upload mit falschen Magic Bytes → 415 · viertes Foto → 409

**E2E** (Playwright): Registrieren → Token → Tour anlegen → Foto → öffentliche Seite → OG-Tags →
privat schalten → 404 für Fremde → Konto löschen → Seite weg. Viewports 320/768/1024/1440,
reduced-motion, Tastatur-Navigation.

**Visuell:** Screenshots werden selbst angesehen, mindestens 390 px und Desktop. Grüne Tests sind
kein Qualitätsnachweis.

Zielabdeckung 80 %.

## 15. Fallen aus dem Repo-Gedächtnis

1. `data-hm` niemals wiederverwenden (`v3.js` überschreibt es) → `data-gbhm`.
2. Kein `upgrade-insecure-requests` in der CSP — Safari wendet es auch auf localhost an.
3. `connect-src` und die CSP-Hashes nachziehen, sonst ist der Feed still leer und sieht aus wie ein
   Datenbank-Bug.
4. Breakout-Sektionen per `margin-left` zentrieren, nie per `transform` und nie mit
   `margin`-Shorthand.
5. Cache-Buster bei jeder JS-Änderung ziehen.
6. Nach dem Bauen `curl -sI` und `dig` gegen die echte Auslieferung — nicht nur lokal prüfen.
7. Neue Fläche heißt: Sitemap, Navigation, Zähl-Whitelist und CSP in einem Zug mitziehen.
8. WebKit gehört in jede QA-Runde, nicht nur Chromium.

## 16. Reihenfolge

Alles wird gebaut und geprüft, aber **nichts geht einzeln live** — der Merge nach `main` passiert
gebündelt mit dem nächsten Website-Release. Gearbeitet wird auf einem frischen Branch ab
`origin/main` (der lokale `main` ist tote Historie).

| # | Paket | Inhalt |
|---|---|---|
| T0 | Fundament | Zone-Umzug, Worker-Skelett, D1, R2, KV, Migrationen, Testaufbau |
| T1 | Logbuch | Kurzbefehl-Aufnahme, öffentliches Band, Summen. Erster sichtbarer Wert |
| T2 | Zugang | Registrierung, Bestätigung, Magic Link, Konto, Export, Löschung |
| T3 | Tourenbuch | Tour anlegen, Fotos, eigene Seite, Sichtbarkeit, Teilen und OG |
| T4 | Kuration | Admin-Liste, Hervorheben, Feed auf `/touren/`, Startseiten-CTA, Melden |
| T5 | Abschluss | Datenschutz und Nutzungsbedingungen, Security-Sweep, QA-Gate, Release |

## 17. Sebi-Aktionen

1. **Nameserver bei united-domains auf Cloudflare umstellen.** Blockiert T0. Abgleichliste aller
   bestehenden Records liefere ich vorher.
2. **Kurzbefehl auf dem iPhone einrichten.** Blockiert T1. Anleitung kommt von mir.
3. **Nutzungsbedingungen absegnen.** Blockiert T5. Entwurf kommt von mir.
4. **Entscheiden, ob der Strava-Embed** auf einzelnen Highlight-Touren noch in Stufe 1 soll oder in
   Stufe 2 bleibt.

## 18. Stufe 2 (geparkt)

GPX-Upload mit echtem Höhenprofil und Karte · Gipfel-Sammlung und Höhenmeter-Jahresziel mit
Smashie-Badges · „Diese Tour nachgehen" als Gipfelbuch-Mechanik auf Sebis kuratierten Touren ·
Strava-Embed mit Consent-Gate · Wochenrückblick per Mail an die Buchbesitzer.
