# Sicherheit & Recht — der Loop

**Ein Befehl:**

```bash
node scripts/sicherheits-loop.mjs              # gegen den Arbeitsbaum
node scripts/sicherheits-loop.mjs --live       # gegen vegetarianhulk.de
node scripts/sicherheits-loop.mjs --selbsttest # prüft das Werkzeug selbst
python3 scripts/fremdhosts-check.py            # schnell, ohne Browser (im premium-check)
```

Jede Seite wird **einzeln** geladen und gemessen. Kein Sammelurteil.

---

## Warum VH eine eigene Runde braucht

Zwei Eigenheiten des Stacks verschieben die Prüfung dorthin, wo sie sonst niemand macht:

1. **GitHub Pages liefert den ganzen Branch aus.** Was im Repo liegt, ist im Netz —
   auch was niemand verlinkt hat. Genau dort lagen alle Funde des ersten Laufs.
2. **Es gibt keine HTTP-Header.** HSTS, `X-Frame-Options`, `nosniff` sind auf Pages
   nicht setzbar. Was geht, muss ins Dokument (CSP als `<meta>`).

---

## Was geprüft wird

| | Prüfung | Latte |
|---|---|---|
| **Sicherheit** | lädt nur von erlaubten Hosts (Liste mit Begründung) | 🔴 |
| | kein Mixed Content (`http://`) | 🔴 |
| | keine Cookies, kein localStorage ohne Einwilligung | 🔴 |
| | kein CSP-Verstoß in der Browser-Konsole | 🔴 |
| | CSP im Dokument vorhanden | 🟡 |
| | `target="_blank"` mit `rel="noopener"` | 🟡 |
| **Recht** | Impressum von jeder Seite erreichbar (§ 5 DDG) | 🔴 |
| | Datenschutz von jeder Seite erreichbar | 🔴 |
| | Werbekennzeichnung, wo Partnerlinks stehen (§ 5a Abs. 4 UWG) | 🔴 |
| | keine zweite Fassung eines Rechtstexts im Netz | 🔴 |
| **Fläche** | Waisen: abrufbar, aber von nichts verlinkt | 🟡 |
| | interne Dateien, die Pages trotzdem ausliefert | 🟡 |

**Erlaubte Fremd-Hosts** — jeder mit Grund, und **jeder muss in `datenschutz.html` stehen**:

| Host | wofür |
|---|---|
| `challenges.cloudflare.com` | Turnstile, Spam-Schutz der Formulare |
| `vh-forms.peaking.workers.dev` | eigener Formular-Endpoint |
| `api.open-meteo.com` | Live-Wetter auf den Tourseiten |

Turnstile antwortet von wechselnden Unterdomains (`hagen.challenges…`) — der Eintrag
gilt für die Domain. `blob:` und `data:` entstehen im Browser und zählen nicht.

---

## Erster Lauf, 18.09.2026 — was er fand

Alles davon war **von keiner Seite verlinkt** und deshalb von keinem bestehenden Tor
je besucht worden.

| Fund | warum es zählte |
|---|---|
| `legal-slim/datenschutz.html` | zweite, **veraltete** Datenschutzerklärung (Stand 16.06., ohne Turnstile) — öffentlich abrufbar |
| `legal-slim/impressum.html` | zweite Fassung des Impressums |
| `admin/lieblingsprodukte/` | interne Pflegeoberfläche im Netz (speichert nur lokal, keine Token — aber gehört nicht dorthin) |
| `archive/lieblingsprodukte.html` | alte Seite ohne Rechtslinks |
| vier Prototyp-Ordner | 20 Dateien luden **Google Fonts direkt von Google** (davor, PR #51) |

Alle entfernt, archiviert unter `~/vh-design-archiv`, in der git-Historie erhalten.
Danach: **0 🔴**.

### Was der Lauf ausdrücklich NICHT fand

Damit niemand später danach sucht — das ist geprüft und in Ordnung:

- **Keine Seite setzt Cookies oder schreibt in localStorage.** Damit ist auch kein
  Einwilligungsbanner nötig.
- **Werbekennzeichnung stimmt.** Nur `partner-picks/` hat Partnerlinks, und es nennt
  Affiliate, Provision und Werbung. `index.html` und `lieblingsprodukte*` haben
  **null** Partnerlinks — ein früherer Zähler hatte unbeteiligte Wörter getroffen.
- **Kein Geheimnis im Worker-Quelltext.**
- **Kein Mixed Content**, kein `http://` irgendwo.

---

## Bewusst geduldet

Diese liegen im Repo, weil Bau-Skripte sie brauchen, und werden von Pages
mitausgeliefert. Solange sie kein Geheimnis tragen, ist das hinnehmbar:

| Pfad | warum |
|---|---|
| `workers/` | Worker-Quelltext, per wrangler deployt. Enthält keine Geheimnisse — **das ist die Bedingung**, nicht eine Beobachtung. |
| `email-templates/` | Vorlagen für den Tour-Newsletter, vom Bau-Skript gelesen |
| `mail-templates/` | Vorlagen der Willkommensstrecke |

---

## Nicht abgedeckt — damit die Liste ehrlich bleibt

- **HTTP-Header** (HSTS, `X-Frame-Options`, `nosniff`, `frame-ancestors`): GitHub Pages
  lässt keine zu. Clickjacking-Schutz ist damit strukturell offen.
- **Rate-Limits der Worker-Endpunkte:** nur durch echtes Hämmern prüfbar, und das
  verbrennt das eigene Fenster. Der Code steht in `workers/vh-forms/worker.js`.
- **Konten:** 2FA bei GitHub, Cloudflare und Brevo ist kein API-Thema. Das ist
  zugleich der **größte reale Angriffsweg** — fällt der GitHub-Account, ist die Seite
  offen. Einmal im Jahr nachhalten.
- **Turnstile-Widget-Modus:** nur im Cloudflare-Dashboard sichtbar.

---

## Lauf 23.09.2026 — 0 🔴 · 25 🟡

Alle Kundenflächen grün. Zwei Klarstellungen aus diesem Lauf:

- **Turnstile-Konsolenrauschen zählt nicht mehr als Befund.** Das Widget schreibt aus
  seinem eigenen Skript auf jeder Konsolen-Ebene eine getarnte Zeile
  (`%c%d font-size:0;color:transparent NaN`). Das ist Anbieter-Verhalten, kein Fehler
  bei uns — und ein Tor, das es bei jedem Lauf meldet, wird nach einer Woche ignoriert.
  `ERLAUBT_KONSOLE` nimmt **nur die Konsole** aus: was der Host LÄDT, wird weiter geprüft,
  und ein CSP-Verstoß zählt auch von dort.
- Ein einmaliges 503 auf `/3-tage-reset/` war bei der Gegenprüfung nicht reproduzierbar —
  transienter Aussetzer, kein Befund.

---

## Backlog

- 🟡 **23 gelbe Punkte** aus dem ersten Lauf — überwiegend Waisen (`coming-soon.html`,
  Weiterleitungs-Stummel) und fehlende CSP auf Nebenseiten. Keiner davon ist ein
  Verstoß; abarbeiten, wenn die betroffene Seite ohnehin angefasst wird.
- **CSP auf die Nebenseiten ziehen.** Die Tourseiten haben sie, viele Nebenseiten nicht.
- **Rate-Limit-Verhalten einmal bewusst messen** (eigenes Zeitfenster einplanen).

---

## Wann laufen lassen

Vor jedem Release, nach jeder neuen Seite, und wenn ein Drittanbieter dazukommt.
Kein Dauer-Cron: die Runde kostet Zeit, und ihre Funde entstehen durch Änderungen,
nicht durch Zeitablauf.
