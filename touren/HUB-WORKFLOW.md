# Hulk Hikes — Hub-Workflow & Daten-Spec (SSoT)

Verbindliche Vorlage für alle künftigen Touren + den Ausbau des Hulk-Hikes-Hubs.
Stand fixiert 21.07.2026. Referenz-Instanz: `touren/ristfeuchthorn/index.html`.
**Neue Tour = diese Datei kopieren, Daten tauschen, Build-Schritte abarbeiten, verifizieren.** Nichts an der Struktur ändern.

---

## 1. System-Überblick

Zwei Seitentypen, beide im v3-Editorial-Dark-Look (shared `/v3.css`, `/v3.js`, `/fonts.css`;
Tour-Detailseiten zusätzlich `/touren/tour.css` + `/touren/tour.js`; Shell = bg-wrap, rails, topbar, `.nav`, footer):

| Seite | Datei | Zweck |
|---|---|---|
| **Hub / Liste** | `touren/index.html` | Forum-Liste: Pinned-Highlight (zuletzt gegangen) + Toolbar (Suche/Filter/Sort) + expandierbare Zeilen. |
| **Tour-Detail** | `touren/<slug>/index.html` | Volle Tour: Foto-Hero → Split (Praxis \| Meinung) → Höhenprofil → CTA. Nur für **selbst gegangene** Touren. |

**Regel:** Empfehlungen (nicht selbst gegangen) leben nur als Zeile/Karte in der Liste. Sobald Sebi eine geht → Detailseite + Umschalten auf „gegangen".

---

## 2. Tour-Detail — FIXIERTE Reihenfolge (nicht ändern)

1. **Foto-Hero** (`.tour-hero`) — full-bleed Foto (78vh, Zoom-in beim Laden), Overlay: Crumb, DAV-Badge, Playfair-H1, Untertitel, Lead, **Fakten-Strip** (Playfair-Zahlen auf Hairline) inkl. **Live-„Jetzt"-Fakt** (Smashy-Dot + Temp am Gipfel).
2. **Split** (`.tour-split` → `.tour-split__grid`, 2 symmetrische Panels, ab 820px gestapelt):
   - Links `.tour-panel.flaeche-wald`: Kicker „Vorm Start" + Playfair-Titel + **Info-Tafel** (`.tour-rows` → `.tour-row` = `<dt>`Label | `<dd>`Text, Hairline-Divider; KEINE Einzel-Bubbles!) + Foot (Video/Maps-Links).
   - Rechts `.tour-panel.flaeche-papier` (`data-light`): Kicker „Gegangen ⌃ Datum" + Playfair-Titel „Meine Meinung" + handschriftliche Notiz (`.tour-note__body`, Caveat) + Signatur (`.tour-note__sig`) + **Aktivitäts-Beweise** (`.tour-proof`, unten bündig).
3. **Höhenprofil** (`.tour-profil`) — Wald-Fläche, SVG zeichnet sich beim Reveal (draw-on).
   Beschriftung als HTML-Marken über dem Diagramm, mit `data-punkte` zusätzlich ablesbar.
4. **CTA** (`.tour-cta`, `data-light`) — Newsletter, geprägter `.tour-btn`.
5. Zurück-Link `.tour-back` → `/touren/`.

Header beider Split-Panels IMMER gleich (Mono-Kicker + Playfair-Titel), `align-items: stretch` → gleiche Höhe.

### 2a. Sonnenaufgang-Variante (seit Kneifelspitze, 30.08.2026)

Additiv — bestehende Touren bleiben unverändert. Nur einsetzen, wenn die **Uhrzeit die
Geschichte der Tour ist** (nachts los, oben auf das Licht warten). Referenz:
`touren/kneifelspitze/index.html`.

| Baustein | Was es tut |
|---|---|
| `.tour-arc` | Zeitachse zwischen Split und Höhenprofil. 4 Punkte: los · oben · Sonnenaufgang · zurück, der Sonnenaufgang ist markiert. **Die Fläche ist Wald wie überall** (Kodex Regel 1) — der Tagesanbruch lebt in der 1px-Datenspur und den Punkten, nicht in einer dritten Hintergrundfarbe. Der erste Entwurf hatte einen Nacht→Orange-Verlauf als Fläche; genau das las sich als Template-Optik. |
| `.tour-fakt--live[data-sonnenaufgang]` | Zweiter Live-Fakt im Hero-Strip: nächster Sonnenaufgang am Gipfel. **Gleiche Zahlenskala wie alle anderen Fakten** — der Unterschied ist die Farbe, nicht die Größe; vorher brachen kleinere Live-Zahlen den Rhythmus. Nutzt `daily=sunrise` aus demselben Open-Meteo-Call. |
| `.tour-strecke` | **Bildstrecke** — die Fotos stehen senkrecht untereinander und kommen beim Scrollen herein (`animation-timeline: view()`, Rückfallweg per IntersectionObserver in `tour.js`). Erzeugt von `scripts/galerie-einbauen.py`; von Hand wird hier nichts gesetzt. **Drei Anatomien**, und welche ein Foto bekommt, entscheidet sein Seitenverhältnis: Querformat → `--voll` (volle Breite, das Durchatmen), Hochformat → `--links`/`--rechts` (versetzt, Text in der Randspalte) oder `--paar` (zwei nebeneinander). Zwei Paare nie hintereinander — das Paar wäre sonst die neue Monotonie. **Kein horizontaler Streifen**: die Fassung davor war auf dem Handy 304 px klein („sieht richtig doof aus", 22.09.2026). |
| `.tour-kreuze` | **Kreuz-Reihe** für Touren mit mehreren Gipfeln. Vier Tafeln nebeneinander (Handy 2×2), je Kreuz Name, Höhe, Ankunft und **Standzeit als Balken im Verhältnis** — der Balken trägt die Aussage, nicht die Zahl. Quelle ist `<slug>/gipfel.json`, erzeugt von `scripts/gipfelreihe-einbauen.py`. Ohne die Datei passiert für eine Tour nichts. |

Die fixierte Reihenfolge aus §2 bleibt: Hero → Split → *(Nacht-Achse)* → Höhenprofil →
*(Fotos)* → CTA → Zurück-Link.

### 2b. Das Bento-Raster (seit 02.09.2026)

Die Flächen stapeln **nicht** mehr als gleich breite Karten untereinander. Alles zwischen
Hero und CTA läuft durch **ein** 12-Spalten-Raster (`.tour-bento`), und die Breite wechselt
von Zeile zu Zeile, damit Text, Daten und Bilder ineinandergreifen:

| Zeile | Kneifelspitze | Ristfeuchthorn |
|---|---|---|
| 1 | Vorm Start `--span:5` · Meinung `--span:7` | Vorm Start `5` · Meinung `7` |
| 2 | Foto `4` **`.spannt-2`** · Zeitachse `8` | Höhenprofil `12` |
| 3 | *(Foto läuft weiter)* · Höhenprofil `8` | — |
| 4 | Foto `7` · Foto `5` | — |

Die Kachel mit `.spannt-2` läuft über zwei Zeilen und **bindet die Flächen rechts davon
zusammen** — das ist der Unterschied zwischen „verwoben" und „gestapelt". Sie braucht ein
Hochformat, sonst wird der Beschnitt hässlich.

Breite kommt immer über `style="--span: N"`, nie über eigene Grid-Regeln. Ab 860px klappt
alles auf eine Spalte. Kodex Regel 8 gilt weiter: Gap bleibt 14px, keine Rotation, kein
Overlap außer Foto→Karte im Hero.

---

## 3. Daten-Schema pro Tour (das brauche ich von Sebi)

Pro Tour dieses Set. **Fett = Pflicht**, Rest optional/ableitbar.

| Feld | Beispiel (Ristfeuchthorn) | Wo verwendet |
|---|---|---|
| **slug** | `ristfeuchthorn` | Ordner `touren/<slug>/`, URLs, Dateinamen |
| **Name** | Ristfeuchthorn | H1, Titel, Crumb, Liste |
| **Gipfelhöhe** | 1.569 m | H1-Untertitel, Liste |
| **Region** | Berchtesgadener Land / Chiemgau | Crumb, Filter (`bgl`/`chiemgau`), Liste-Pill |
| **Startort** | über Schneizlreuth | Untertitel |
| **ehrlicher Einzeiler** | „Ein ehrlicher Kondi-Tag: 1.071 hm am Stück…" | Hero-Lead |
| **Distanz** | 12,52 km (Rundtour) | Fakten-Strip, Liste, `data-thm` n/a |
| **Höhenmeter** | 1.071 hm | Fakten, Liste, Sortierung (`data-thm`) |
| **Max-Höhe** | 1.567 m | Fakten |
| **Gehzeit** | ~5 h | Fakten |
| **Schwierigkeit** | T2–T3 (SAC) → Punkte ●●● | Fakten, Liste-Dots, Filter (`data-diff` 2=mittel/3=schwer) |
| **Datum gegangen** | 17.07. (2026-07-17) | Badge, Liste (`data-date` YYYYMMDD; Empfehlungen: -1..-6) |
| **Startpunkt (Praxis)** | Wurzenwirt, kostenlos | Vorm-Start-Zeile „Parken", Maps-Link |
| **Maps-Suchstring** | `Wurzenwirt+Schneizlreuth` | `google.com/maps/search/<string>` |
| **Einkehr** | Wurzenwirt am Parkplatz | Vorm-Start-Zeile „Einkehr" |
| **Charakter/Hinweis** | wild, T3, feste Schuhe | Vorm-Start-Zeile „Charakter" |
| **für wen** | Kondi-Tage ja / Feierabend-Gipfel nein | Vorm-Start-Zeile „Für wen" |
| **persönliche Notiz** | Sebis O-Ton (2–3 Sätze) | Cream-Panel (Caveat) — **muss Sebis echte Worte sein** |
| **Aktivitäts-Beweise** | 07:27 · 19.354 Schritte · 117 bpm · 6:53 h · 2.085 kcal | `.tour-proof` (Apple Watch + Bergfex) |
| **Wetter-Koordinaten** | lat 47.65 · lon 12.79 · **elevation = Gipfelhöhe** | Live-„Jetzt"-Fakt (Open-Meteo) |
| **Höhenprofil-Verlauf** | Form aus Bergfex-Profil | SVG-Pfad (Punkte nachzeichnen) |
| **Foto** | `ausblick.jpg` (1 reicht) | Hero-Hintergrund |
| **Kupferstich** (nur Liste-Empfehlung) | `touren/assets/eng-<slug>.jpg` | Liste-Zeile-Thumb |

**Sebis Liefer-Checkliste je Tour (minimal):** Bergfex-Screenshots (Stats + Höhenprofil) · Apple-Watch-Stats · 1 Foto · Startpunkt/Parken/Einkehr in Stichworten · 2–3 Sätze O-Ton („für wen lohnt's"). GPX optional (→ echte Routenkarte, s. §6).

---

## 4. Build-Schritte (technisch, in Reihenfolge)

1. **Ordner:** `mkdir touren/<slug>` · die passendste bestehende Tour als Basis kopieren
   (Tagestour → `ristfeuchthorn`, Sonnenaufgang/Nacht → `kneifelspitze`).
   Die Gestaltung kommt aus **`touren/tour.css`**, das Verhalten aus **`touren/tour.js`** —
   beide werden nur eingebunden, nie kopiert. Eine Tour-Datei traegt DATEN, kein Design:
   erlaubt ist ein `<style>`-Block mit dem Bildausschnitt des Heros (`--hero-fokus`),
   sonst nichts. `tour-check.mjs` blockt eigene Radien und eigene Flaechen-Verlaeufe.
2. **Foto (HEIC → Web):** `python3 scripts/tour-foto.py IN.heic touren/<slug>/<name>.jpg --breite 1500 --q 82`
   Gibt die fertigen `width="…" height="…"` fürs HTML aus.
   **Nicht mehr von Hand mit `sips -r <winkel>` drehen.** Das alte Rezept hatte eine feste
   90°-Drehung, die nur für Ristfeuchthorn zufällig passte: bei der Kneifelspitze trugen drei
   Fotos Orientation 6 und eins Orientation 3, die feste Drehung kippte sie nach links — und
   `sips -r` lässt den EXIF-Tag stehen, sodass der Browser ein zweites Mal dreht. Das Skript
   liest den Tag, dreht die Pixel genau einmal und speichert **ohne exif**.
   Danach das Bild **ansehen**, nicht nur die Ausgabe lesen.
3. **Daten tauschen** (§3) in Hero, Fakten, Split-Zeilen, Notiz, Proof, Datum, Badge.
4. **Höhenprofil:** Die Messwerte stehen in **`data-punkte="km,höhe km,höhe …"`** am SVG.
   **Die beiden `<path class="fill">` und `<path class="line">` MÜSSEN im HTML stehen bleiben** —
   `tour.js` überschreibt nur ihr `d`, es legt keine Pfade an. Wer sie beim Neuaufsetzen einer
   Tour weglässt, bekommt ein leeres Diagramm ohne jede Fehlermeldung (Fall Drachenwand, 07.09.).
   `tour.js` zeichnet daraus Kurve, Verlaufsfüllung, beschriftete Höhenachse, Kilometerachse
   und die Gipfelmarke. Der Pfad im HTML ist nur noch der Fallback ohne JS.
   **Das ist der Grund, warum Verbesserungen am Diagramm auf ALLE Touren greifen.**
   Vorher stand der Pfad handgeschrieben pro Seite — so entstand der Zustand, dass eine Tour
   Achsen und Ablesen hatte und die andere eine nackte Linie im leeren Kasten.
   **Kein `<text>` ins SVG** — `preserveAspectRatio="none"` verzerrt es mit (11px-Schrift
   schrumpft auf gut 7px und wird horizontal gestreckt). Alle Beschriftung ist HTML.
   Stehen keine Rohdaten zur Verfügung, dürfen die Punkte aus einem nachgezeichneten Profil
   abgeleitet werden — dann auf 10 m runden und die **Herkunft in den Hinweistext schreiben**
   (Ristfeuchthorn: „Werte aus dem Bergfex-Profil nachgezeichnet, auf 10 m gerundet").
5. **Wetter — IMMER ortsspezifisch, an ZWEI Stellen:**
   a) **Tour-Seite:** `data-lat` · `data-lon` · `data-hoehe` am Fakten-Strip (`.tour-fakten`).
   **Mit FÜNF Nachkommastellen, nicht zwei.** Zwei sind bis zu 600 m unscharf; alle vier
   Touren holten dadurch ihr Wetter 1,6–5,0 km neben dem Gipfel, Ristfeuchthorn aus einem
   anderen Tal. Kein Tor konnte das sehen — das Feld war ja gefüllt. Die echten
   Koordinaten liefert `route-holen.py` (OSM-Gipfel über Name **oder** Höhe).
      `tour.js` liest sie von dort — im Skript ist nichts zu ändern.
   b) **Hub** (`touren/index.html`, der „Jetzt am Berg"-Kasten): dieselben drei Attribute
      plus **`data-ort="<Name> · <Höhe> m"`**. Der Kasten zeigt das Wetter der
      **zuletzt gegangenen** Tour, wandert also mit dem Pin mit.
   Bis 07.09.2026 stand im Hub-Skript fest `Chiemgau/BGL · ~1.200 m` — mit der
   Drachenwand im Salzkammergut war das falsch, ohne dass es irgendwo aufgefallen wäre.
   Koordinaten auf zwei Nachkommastellen reichen; `elevation` = Gipfel-/Höchsthöhe.
   Muster: WMO-Code → Fineline-Icon-Map (aus Vorlage übernehmen).
6. **Liste eintragen** (`touren/index.html`): Pinned-Highlight = neueste gegangene Tour;
   Zeile mit `data-name` (lowercase, inkl. Umlaut+ASCII-Variante und gängiger Falschschreibung
   fürs Suchen), `data-region`, `data-diff`, `data-thm` (NICHT `data-hm` — v3.js-Altimeter
   überschreibt `[data-hm]`!), `data-date`. Dazu: **`tkCount` hochzählen**, **JSON-LD ItemList
   pflegen** und prüfen, ob es für den `data-diff`-Wert überhaupt einen **Filter-Chip** gibt —
   sonst ist die Tour nur über „Alle" erreichbar (Fall Kneifelspitze: T1 = erster leichter Grad).
6b. **Newsletter — die Abonnenten erfahren von der Tour:**
   ```
   node scripts/tour-mail.mjs <slug> [--smashie="eine Zeile von dir"]
   node scripts/mail-check.mjs .mail-versand/<slug>.html
   node scripts/tour-mail.mjs <slug> [--smashie="…"] --entwurf
   ```
   Zwei Paletten, beide aus v3.css: **Wald** (dunkel, Standard) und **Papier** (hell,
   `--papier`). Hintergrund: Gmail im Dark Mode kippt eine dunkle Mail auf hell — eine
   helle dunkelt es ab, und das sieht in beiden Fällen gewollt aus statt nach Unfall.
   Die Papier-Fassung entspricht den Creme-Panels der Tour-Seiten.
   ```
   ```
   Schritt 1 **erzeugt** die Mail aus `touren/<slug>/index.html` — Name, Höhe, Region, Datum,
   Aufhänger, die vier Zahlen, O-Ton (erste zwei Sätze), Hero-Foto. Betreff und Vorschautext
   kommen auf der Konsole. Schritt 3 legt daraus eine **Brevo-Kampagne als Entwurf** an und
   gibt die Kampagnen-Nummer aus.

   **Der Versand ist bewusst NICHT Teil dieses Ablaufs.** Es gibt kein Flag dafür in
   `tour-mail.mjs`. Ausgelöst wird er nur auf ausdrückliche Ansage — eine Mail an die ganze
   Liste ist nicht zurückholbar, und ein Tippfehler erreicht dann alle gleichzeitig.

   **Wie der Schlüssel geschützt ist:** `BREVO_API_KEY` bleibt Worker-Secret und wird nie
   kopiert. Das Skript spricht mit `POST /newsletter/kampagne` und weist sich mit einem
   eigenen Token aus (`NL_ADMIN_TOKEN`, liegt in `~/.config/vh/newsletter.env`, Rechte 600,
   außerhalb des Repos). Der Endpunkt kann **nur Entwürfe anlegen**. Senden liegt auf einem
   eigenen Pfad, der zusätzlich zur Kampagnen-Nummer einen wortgleichen Bestätigungssatz
   verlangt; ohne beides antwortet er 400.

   Stand prüfen: `GET /newsletter/kampagne?id=<n>` liefert `status` — so lässt sich
   *belegen*, dass ein Entwurf ein Entwurf ist, statt es zu behaupten.

   **Niveau messen statt beurteilen:**
   ```
   node scripts/mail-loop.mjs .mail-versand/<slug>.html [--merken|--vergleich]
   ```
   `mail-check` prüft, ob etwas **kaputt** ist. `mail-loop` prüft, ob es **gut** ist, und macht
   „wirkt schwach" zählbar: Takt (verschiedene Abstände), Inhaltsbreiten, Typo-Stufen,
   Etiketten-Register, Dark-Mode-Abdeckung, Absatzlänge, Zeilenbreite und **Doppelung**
   zwischen Textblöcken. `--merken` sichert einen Stand, `--vergleich` zeigt die Differenz —
   daher „Loop": messen, ändern, wieder messen.

   Erster Durchgang am 11.09.2026: Takt 8→4 verschiedene Abstände · Typo-Stufen 14→5, davon
   0 enger als 1,25 · Dark-Mode-Abdeckung 94→100 % · Doppelung zwischen Aufhänger und O-Ton
   **75→17 %** (der O-Ton nimmt jetzt das Satzfenster mit der geringsten Überschneidung,
   statt die ersten zwei Sätze — er sagte sonst dasselbe wie der Absatz darüber).

   **Es blockiert bewusst nichts.** Ein Niveau-Wert ist eine Einschätzung, kein Defekt; wer ihn
   zum Tor macht, baut ein Tor, das bei jedem Sonderfall rot steht. Und: zwei der ersten
   „Befunde" waren Fehler im Werkzeug selbst — es zählte den Inhalt des `<style>`-Blocks als
   Schriftgröße und den unsichtbaren Vorschautext als eigene Typo-Stufe.


7. **Cache-Busting:** `./scripts/bump-asset-versions.sh`. Neue seiten-eigene Assets brauchen
   kein `?v=` (sind im Ordner).
8. **Prüfen:** `node scripts/tour-check.mjs <slug>` — muss grün sein, sonst nicht ausliefern.
   Enthält einen **Level-Paritäts-Check**: hat eine Tour einen Pflicht-Baustein nicht, den die
   anderen haben (Achsen, Messpunkte, Ablesen, Verlaufsfüllung, Live-Fakt, Bento, gemeinsames
   CSS/JS), wird das zum Fehler. Optionale Bausteine (Zeitachse, Fotos) erscheinen nur als
   Hinweis — nicht jede Tour hat Material dafür.
   Nach Änderungen AM TOR selbst: `./scripts/tour-check-fixtures.sh` (22 Negativtests + Positivtest).
9. **Verifizieren:** `node scripts/tour-visual.mjs <slug>` — startet sich seinen eigenen
   HTTP-Server, misst in 4 Engines (WebKit 390/768, Firefox 1024, Chromium 1440) und legt
   Screenshots in `.tour-visual/` ab. Prüft Überlauf, JS-Fehler, nicht geladene Bilder **und
   Bilder mit 0x0-Box**. Danach die Screenshots **selbst ansehen**.
   ⚠️ `geraete-check.mjs` misst über `file://` und ist für diese Seiten **unbrauchbar**:
   `/v3.css` zeigt dort auf die Dateisystem-Wurzel, das Stylesheet lädt nicht, und es meldete
   so 40px Überlauf, der über HTTP 0px ist. Dafür gibt es `tour-visual.mjs`.
   ⚠️ Was **kein** Tor findet, sondern nur das eigene Auge: der `<ol>`-Listmarker der
   Zeitachse („1. 2. 3. 4." vor den Uhrzeiten) und ein Foto, dessen Beschnitt das Motiv
   zerstört.
10. **CSP:** Tour-Seiten tragen `script-src 'self'` **ohne** `'unsafe-inline'` — es gibt kein
    ausführbares Inline-Script mehr, alles liegt in `tour.js`. Wer wieder ein `<script>` in eine
    Tour-Datei schreibt, bricht die Seite. `style-src` behält `'unsafe-inline'` für den
    zweizeiligen `--hero-fokus`-Block. `frame-ancestors` steht bewusst NICHT drin: per `<meta>`
    wird es ignoriert und erzeugt nur eine Konsolen-Warnung — Clickjacking-Schutz bräuchte
    einen HTTP-Header, den GitHub Pages nicht zulässt.
11. **Datenschutz:** Neue Drittanbieter-Calls (Karten-Embed etc.) IMMER in `datenschutz.html`
    §4+§5 + Quell-Link am Widget. Open-Meteo ist bereits drin.
12. **Branch:** von `origin/main` abzweigen, nicht vom aktuellen Arbeitsbranch. Sonst hängt die
    Tour an einem ungemergten Feature (Stand 09/2026: `feat/berg-portal-t0-t1` wartet auf den DNS-Umzug).

---

**Danach ist die Seite noch nicht fertig.** Karte, Gelände und Fotoformate kommen
aus dem Tour-Loop — **ein Befehl, §6**:

```bash
scripts/tour-loop.sh <slug>            # bzw. --gpx <datei>, wenn eine GPS-Spur da ist
```

Der Loop baut auch die **Bildstrecke** und die **Kreuz-Reihe**. Die Reihenfolge darin ist
bindend, weil beide auf einem Anker im Markup sitzen:

| Schritt | sucht | fehlt der Anker |
|---|---|---|
| `galerie-einbauen.py` | `<!-- /WEGVERLAUF -->` | fällt auf das Höhenprofil zurück |
| `gipfelreihe-einbauen.py` | `<!-- /BILDSTRECKE -->` | **Abbruch** statt Einbau an falscher Stelle |

Neue Fotos kommen als `<figure class="tour-shot">` ins Markup — irgendwo hinter
`<!-- /WEGVERLAUF -->` genügt, den Rest ordnet das Skript. **Die Seite ist die einzige
Quelle**, es gibt kein zweites Verzeichnis, das driften könnte. Ein zweiter Lauf ist
stabil; der Selbsttest prüft das ausdrücklich, weil genau dort am 22.09.2026 alle
Bildunterschriften verloren gingen (nach dem ersten Lauf steht der Text als Geschwister
neben der Kachel, nicht mehr darin).

---

## 4a. Level-Parität — jede Änderung gilt für ALLE gegangenen Touren

**Die Regel (Sebi, 09.09.2026):** Wird an einer Tour etwas verbessert, muss es bei allen
ankommen, für die es zählt. Sonst steht die zuletzt gebaute auf Stand N und die andere auf
N−2, und **beide sind für sich betrachtet fehlerfrei** — genau deshalb fällt es niemandem auf.

**So wird eine Verbesserung durchgereicht:**
1. Änderung an einer Tour bauen.
2. Das Merkmal in `scripts/tour-check.mjs` eintragen:
   - **`PFLICHT`** — jede Tour muss es haben. Fehlt es irgendwo, ist das Tor **rot**.
   - **`OPTIONAL`** — nur sinnvoll, wenn es zur Tour passt (Zeitachse braucht eine
     Uhrzeit-Geschichte, Sonnenaufgangs-Fakt eine Sonnenaufgangs-Tour). Ungleichstand wird
     **gemeldet, blockiert aber nicht**.
   - **`VERBOTEN`** — Formulierungen, die auf keiner Tour stehen dürfen. Auf die **Aussage**
     zielen, nicht auf den Wortlaut: ein zu enges Muster meldet grün, während die Aussage steht.
3. `node scripts/tour-check.mjs --alle` — das prüft **alle** Touren gegeneinander, nicht nur die neue.
4. Was rot wird, bei den älteren Touren nachziehen. Dann erst commiten.

**Warum die Unterscheidung wichtig ist:** Ristfeuchthorn hat keine Zeitachse — das ist kein
Rückstand, sondern richtig, es war ein Kondi-Tag ohne Uhrzeit-Dramaturgie. Ein Tor, das
„nicht vorhanden" mit „kaputt" verwechselt, steht dauerhaft rot und wird ignoriert.

**Was nur Sebi nachliefern kann:** die Bildmenge. Das Tor meldet als Hinweis, wenn eine Tour
höchstens halb so viele Fotos hat wie die reichste — nachliefern lässt sich das nur mit
Bildern von genau dieser Tour.

**Stand 09.09.2026:** alle drei gegangenen Touren in Parität, offen nur Ristfeuchthorn mit
einem Foto gegen vier.

**Parität gilt auch zwischen den beiden Renderern.** Karte und Profil werden ZWEIMAL
gezeichnet: einmal beim Bauen (Python, als Fallback ohne JS) und einmal im Browser
(`tour.js`, für Achsen und Ablesen). Was das Bau-Skript für seine Entscheidung braucht,
muss als `data-`Attribut im Markup stehen — sonst überschreibt der Browser korrektes
HTML mit einer schlechteren Annahme. Am 16.09. setzte `tour.js` das Gipfelkreuz auf den
letzten Spurpunkt; bei einer aufgezeichneten Rundtour ist das wieder der Parkplatz.

---

## 4b. Voice — bevor auch nur ein Satz geschrieben wird

**Zuerst lesen:** `~/.claude/projects/-Users-sebastianwimmer/memory/user_sebi_dna.md`,
Abschnitt 3 (Voice) und 11 (Guardrails). Für vegetarianhulk gilt dort:
**1st-person, roh, verletzlich, emotional warm.** Anti: Coach-Bro, „premium/exclusive/elite",
generische KI-Politur.

**Die Falle, in die ich am 07.09.2026 gelaufen bin:** Aus Sebis Erzählung wurden bei mir
Merksätze. Er schreibt, *was war* — ich schrieb *Regeln*:

| Sebi | ich (falsch) |
|---|---|
| „sehr geile klettertour in schwierigkeit c hauptsächlich" | „Klettersteig, überwiegend Schwierigkeit C" |
| „das erste mal mein klettersteig set ausgetestet" | „Set und Helm sind Pflicht, nicht Empfehlung" |
| „früh genug dran sein lohnt sich auf jeden fall" | „Die zwei Stunden Vorsprung sind der eigentliche Trick" |

Aus einem Anfänger, der etwas zum ersten Mal probiert, wurde eine Autorität, die Vorschriften
macht — **das Gegenteil von „vulnerable".**

**Prüffragen vor dem Commit:**
1. Steht da, was passiert ist — oder eine Lehre daraus? Ersteres.
2. Kommt „der/die eigentliche X", „X, nicht Y", „keine Floskel" vor? Raus, das ist Reflex.
3. Wird jemand ausgeschlossen? Weiche Präferenz („lieber vorher üben") statt Verbot.
4. Ist Sebis eigene Formulierung aus dem Chat verfügbar? **Dann die nehmen, nicht glätten.**
   Sein O-Ton ist die Quelle, nicht der Rohstoff.

## 5. Standing Rules (Sebi, verbindlich)

- **Ehrlichkeit:** nichts erfinden. Nur echte Daten, echte Fotos, Sebis echte Worte. Watzmann = „Schaustück", nicht „seine Tour".
- **Sprache:** locker/zielgruppig (16–34), kein Lehrbuch-Deutsch. Bsp: „Kurz fürs Rucksack-Hirn", „ist top", „Gratis parken".
- **Anti-Slop:** keine Deko-Emoji; Trenner = `.hsep` Berg-Silhouette (nicht `·`); Live-Marker = atmender Smashy (`.live-dot`/`.tk-live__dot`/`.tour-now__dot`); Buttons = geprägtes Emaille (nicht flach); keine schwebenden Einzel-Bubbles → zusammenhängende Panels.
- **Ein Foto pro Tour ist Normalfall** (Sebi macht Videos für Insta) — Format ist darauf ausgelegt.

---

## 6. Karte, Gelände und Fotoformate — der Tour-Loop

**Ein Befehl:**

```bash
scripts/tour-loop.sh <slug>                  # ganze Kette + Tore
scripts/tour-loop.sh <slug> --gpx <datei>    # mit GPS-Spur statt OSM-Weg
scripts/tour-loop.sh <slug> --pruefen        # ändert nichts, sagt nur was liefe
scripts/tour-loop.sh --alle                  # alle Touren neu bauen
```

Danach **selbst ansehen** (390 px + Desktop) und vor dem Merge
`bash scripts/premium-check.sh` (7 Tore, 4 Engines, ~5 min).

### Die Reihenfolge ist bindend

| # | Schritt | hängt ab von |
|---|---|---|
| 1 | `gpx-einlesen.py` **oder** `route-holen.py` | — |
| 2 | `hoehenkarte.py` | dem Kartenausschnitt, und der folgt der Linie |
| 3 | `satellit.py` | ebenso |
| 4 | `foto-format.py` | den Bildmaßen |
| 5 | `route-einbauen.py` | allem davor |
| 6 | `bump-asset-versions.sh` | den geschriebenen Seiten |

**Jeder Schritt hat schon einmal still das Falsche getan, wenn er außer der
Reihe lief** — und kein einziger dieser Fälle wirft einen Fehler. Sie sehen
alle aus wie eine fertige Seite. Genau dafür gibt es den Loop.

### Woher die Daten kommen — und warum ausgerechnet von dort

| Schicht | Quelle | Lizenz |
|---|---|---|
| Linie | Sebis **GPX** (Strava/Apple Health), sonst OpenStreetMap | ODbL |
| Höhenlinien | EU-DEM 25 m über **OpenTopoData** | Copernicus |
| Luftbild | **Sentinel-2 cloudless** (EOX) | CC BY 4.0 |
| Wetter | Open-Meteo | CC BY 4.0 |

**Esri, Google und Bing scheiden aus.** Die Tourseiten laufen unter
`script-src 'self'` und `img-src 'self' data:` — Kacheln müssten also ins Repo,
und genau das untersagen deren Nutzungsbedingungen. Deshalb wird **alles einmal
zur Bauzeit geholt und selbst gezeichnet**: zur Laufzeit geht kein Aufruf an
einen Kartendienst hinaus, `datenschutz.html` bleibt unberührt, und es gibt
nichts zu blocken.

**Open-Meteo taugt nicht für das Höhengitter** — es zählt jeden der 100 Punkte
einer Anfrage einzeln und läuft nach ~25 Anfragen in 429. Es bleibt als
Rückfall drin.

### Was die Karte behaupten darf

- **Ohne GPX** zeigt sie den *Weg nach OpenStreetMap*, nicht die GPS-Spur — und
  sagt das. Der Startpunkt wird nicht geraten: der Ort aus dem Maps-Link der
  Seite hat Vorrang bis 16 % Längenabweichung, darüber entscheidet die Länge
  (der Geocoder liefert für „Maria Gern" das Ortszentrum, nicht den Parkplatz).
  Über 35 % kommt **gar keine Route**.
- **Mit GPX** ist sie die Aufzeichnung. Verglichen wird **räumlich**, also mit
  dem Anstieg. Endet die Aufzeichnung am Gipfel statt am Auto, gilt sie als
  *Aufstieg* und wird gegen die Gipfelposition im Profil verglichen. Über 25 %
  wird die Datei **nicht übernommen**.
- **Uhr ≠ GPS.** Bei Drachenwand und Ristfeuchthorn misst die Spur rund 17 %
  weniger als die Uhr gezählt hat. Beides sind Sebis Zahlen — die Karte nennt
  beide, statt eine zu verschweigen.

### Kachelgrößen — wo was wie groß sinnvoll ist

12 Spalten (`--span`). Die Größen folgen dem Material, nicht dem Geschmack:

| Baustein | span | warum |
|---|---|---|
| Hero | 12 | Name, Höhe, ein Satz |
| Steckbrief-Panels | 5 + 7 | ungleich, damit es nicht nach Tabelle aussieht |
| Zeitachse | 8 | Fließtext, will keine volle Breite |
| Höhenprofil | 8 | breites Diagramm, stretcht auf jede Höhe |
| Routenkarte | 8 | höchstens quadratisch, sonst reißt sie die Zeile auf |
| Fotos | 4 · 5 · 7 | **die Kachel folgt dem Bild** |

**Die wichtigste Regel: ein Foto bestimmt seine Form selbst und erbt sie nie vom
Nachbarn.** Fast alle Fotos hier sind Handy-Hochformat (3:4). `foto-format.py`
schreibt `--shot-ar` aus `width`/`height`; `spannt-2` darf beschneiden, aber nur
mit hochkanten Bildern.

### Die Fallen — alle aus dem 16.09.2026, alle live gewesen

| Was passiert ist | Warum es niemand sah | Was jetzt greift |
|---|---|---|
| Start-Punkt saß auf dem **Gipfel**, Gipfelkreuz am Parkplatz (4 Touren) | ein `reverse()` zu viel; die Linienform war korrekt | Endpunkt-Prüfung in `route-einbauen.py`, bricht ab |
| Start lag nicht dort, wo die Seite ihn nennt (4 Touren) | rein nach Weglänge gewählt; Fellhorn startete südlich statt in Blindau | Maps-Link hat Vorrang bis 16 % |
| Wetter kam **bis zu 5 km** neben dem Gipfel | `data-lat/lon` auf 2 Nachkommastellen — fürs Wetter gerundet, als Kartenendpunkt zu grob | Gipfel kommt aus OSM (Name **oder** Höhe) |
| Foto verlor **59 %** in einer 344×1107-Säule | Kachel ohne eigene Form wuchs auf die Rasterzeile; Markup fehlerfrei | `foto-format.py` + `foto-check.mjs` (misst im Browser) |
| Auf dem Handy verloren Hochformat-Fotos 44 % | Rückfall stand auf `4/3` statt auf der Bildform | `var(--shot-mobil, var(--shot-ar, 4/3))` |
| `tour.js` überschrieb das korrekt gebaute Gipfelkreuz | Parität: der Browser kannte den Gipfel nicht | `data-gipfel` am SVG |
| Einzellauf löschte das Verzeichnis der anderen Touren | Datei war Gedächtnis statt Anzeige | wird aus den `route.json` **abgeleitet** |
| Luftbild lag verzerrt unter der Route | Cache-Schlüssel trug nur die Nordwest-Ecke | Schlüssel trägt den ganzen Ausschnitt |
| Veraltetes Höhengitter/Luftbild | verschobene Linien sehen aus wie Gelände | Ausschnitt liegt in `relief.json`/`gelaende.json`, wird verglichen |
| „© OpenStreetMap" statt „…-Mitwirkende" | beim Kürzen der Fußnoten verloren | VERBOTEN-Muster im Tor |
| Luftbild unsichtbar | im Skript abdunkeln **und** im CSS Deckkraft → multipliziert sich | Ton im Skript, Sichtbarkeit im CSS |
| GPX sah nach 53 % Fehler aus | flach statt räumlich gerechnet, Aufstieg gegen Gesamtstrecke verglichen | räumlich + Aufstiegs-Erkennung |

### Die Tore

```bash
node scripts/tour-check.mjs --alle          # 6 PFLICHT-Zeilen für die Route
bash scripts/tour-check-fixtures.sh         # Negativtests, jeder MUSS rot werden
python3 scripts/route-einbauen.py --selbsttest   # 3 Fälle
node scripts/foto-check.mjs --selbsttest    # stellt den alten Zustand her
```

**Jedes dieser Tore hat seinen eigenen Fehlerfall schon einmal nicht gesehen.**
Der Selbsttest von `foto-check` stellt den alten Zustand per CSS wieder her und
verlangt, dass er auffällt; der von `route-einbauen` **baut sich seinen OSM-Fall
selbst**, weil er sonst an einer GPS-Rundtour ins Leere lief. Ein Wächter, den
man nie hat anschlagen sehen, ist keiner.

---

## 6b. Sicherheit & Recht

```bash
node scripts/sicherheits-loop.mjs        # jede Seite einzeln, Sicherheit + Recht
```

Vor jedem Release und nach jeder neuen Seite. Das Wissen dazu — was geprüft wird,
was der erste Lauf fand, was bewusst offen bleibt — steht in **`SICHERHEIT.md`**.

**Der Grund, warum es diese Runde braucht:** GitHub Pages liefert den ganzen Branch
aus. Was im Repo liegt, ist im Netz — auch was niemand verlinkt hat. Genau dort lagen
am 18.09.2026 alle Funde: eine zweite, veraltete Datenschutzerklärung, eine interne
Admin-Oberfläche, vier Prototyp-Ordner mit Google Fonts. Kein bestehendes Tor hatte
sie je besucht, weil alle den verlinkten Seiten folgen.

---

## 6c. Produkte & Affiliate

```bash
node scripts/produkte-sync.mjs           # erzeugt den No-JS-Fallback aus den Daten
node scripts/produkte-sync.mjs --pruefen # im premium-check
```

**Einzige Quelle: `lieblingsprodukte/products.js`.** Der `<noscript>`-Block in
`partner-picks/index.html` wird daraus erzeugt — vorher stand dort „bei
Datenänderung hier syncen", also eine Aufgabe, die man vergessen kann.

**Drei Regeln, die das Tor nicht alle prüfen kann:**

1. **Kanal-Regel (verbindlich):** was es bei Nature Heart oder Alpin Loacker gibt,
   wird **ausschließlich** über deren Link/Code verlinkt — nie über Amazon. Vor
   jedem neuen Produkt deren Sortiment prüfen. Das weiß kein Skript.
2. **Jede `url` trägt `tag=vegetarianhul-21`.** Ohne Tag ist der Link Arbeit ohne
   Ertrag. → wird geprüft.
3. **`text` ist Sebis O-Ton, kein Katalog-Sprech und kein Health-Claim.** Wo nur
   eine sachliche Zeile steht, trägt der Eintrag `otonOffen: true` und der Lauf
   listet ihn auf. **Nichts erfinden** — der O-Ton ist die Quelle, nicht der Rohstoff.

Amazon-Kurzlinks (`amzn.eu/d/…`) tragen keine ASIN. Auflösen mit einem echten
Browser (Playwright); `curl -I` folgt der Weiterleitung nicht.

---

## 7. Hub-Ausbau (nächste Stufen)

- **GPX-Export** (Bergfex/Strava → Teilen → GPX) hebt die Routenkarte vom Weg laut OpenStreetMap auf die tatsächlich gegangene Spur — die Karte selbst steht seit 16.09. (§6c). Optional 3D wie Watzmann (DEM-Methode, s. `project_vh_hulk_hikes_nav`).
- **Empfehlungen → gegangen:** wenn Sebi eine der 6 (Grünstein/Zinnkopf/Dürrnbachhorn/Rauschberg/Gamsknogel/Hochgern) geht → Detailseite bauen, Liste-Zeile auf „gegangen" + klickbar.
- **Skalierung:** Liste ist client-seitig gefiltert/sortiert; JSON-LD ItemList mitpflegen (SEO/KI). Bei vielen Touren später ggf. Daten-getriebenes Rendering erwägen (aber SEO = Text muss im HTML bleiben).
- **Übertragbar auf s2s-Kunden:** Muster (Daten-getriebene Detailseiten, Panel-Split, Live-Widget mit Quelle+Datenschutz) siehe `learning_v3_site_port_patterns`.
