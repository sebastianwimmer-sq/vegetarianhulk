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
| `.tour-strip` | Fotostrecke für Touren mit mehr als einem Bild. **Bento mit ungleichen Kacheln** (Kodex Regel 8), nicht drei gleich große — ein uniformes Karten-Grid ist der Anti-Slop-Wächter aus dem Kodex. Größe folgt der Chronologie: das lange Warten groß, der Moment breit, der Rest klein. **Grid, kein horizontaler Scroller** — WebKit/Gecko laden `loading="lazy"` beim horizontalen Scrollen nicht nach. |

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
4. **Höhenprofil-SVG:** Pfad-Punkte aus dem Bergfex-/Strava-Profil nachzeichnen
   (viewBox 0 0 900 270, `preserveAspectRatio="none"`), Peak-Marker setzen.
   **Beschriftung NIE als `<text>` ins SVG** — `preserveAspectRatio="none"` verzerrt sie mit:
   bei 900er viewBox auf 180px Höhe schrumpft 11px-Schrift auf gut 7px und wird zugleich
   horizontal gestreckt. Stattdessen `.tour-profil__marke` als HTML über dem Diagramm.
   **Zum Ablesen** (Höhe/Distanz am Zeiger, wie in den Tourenportalen): `data-punkte="km,höhe …"`
   ans SVG. Nur setzen, wenn echte Messwerte vorliegen — bei Ristfeuchthorn ist der Pfad aus
   dem Bergfex-Bild nachgezeichnet, dort gibt es bewusst kein Ablesen statt hergeleiteter Zahlen.
5. **Wetter:** in beiden Wetter-Skripten `elevation=<Gipfelhöhe>` (lat/lon = Bergregion) setzen.
   Muster: WMO-Code → Fineline-Icon-Map (aus Vorlage übernehmen).
6. **Liste eintragen** (`touren/index.html`): Pinned-Highlight = neueste gegangene Tour;
   Zeile mit `data-name` (lowercase, inkl. Umlaut+ASCII-Variante und gängiger Falschschreibung
   fürs Suchen), `data-region`, `data-diff`, `data-thm` (NICHT `data-hm` — v3.js-Altimeter
   überschreibt `[data-hm]`!), `data-date`. Dazu: **`tkCount` hochzählen**, **JSON-LD ItemList
   pflegen** und prüfen, ob es für den `data-diff`-Wert überhaupt einen **Filter-Chip** gibt —
   sonst ist die Tour nur über „Alle" erreichbar (Fall Kneifelspitze: T1 = erster leichter Grad).
7. **Cache-Busting:** `./scripts/bump-asset-versions.sh`. Neue seiten-eigene Assets brauchen
   kein `?v=` (sind im Ordner).
8. **Prüfen:** `node scripts/tour-check.mjs <slug>` — muss grün sein, sonst nicht ausliefern.
   Nach Änderungen AM TOR selbst: `./scripts/tour-check-fixtures.sh` (12 Negativtests + Positivtest).
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
10. **Datenschutz:** Neue Drittanbieter-Calls (Karten-Embed etc.) IMMER in `datenschutz.html`
    §4+§5 + Quell-Link am Widget. Open-Meteo ist bereits drin.
11. **Branch:** von `origin/main` abzweigen, nicht vom aktuellen Arbeitsbranch. Sonst hängt die
    Tour an einem ungemergten Feature (Stand 09/2026: `feat/berg-portal-t0-t1` wartet auf den DNS-Umzug).

---

## 5. Standing Rules (Sebi, verbindlich)

- **Ehrlichkeit:** nichts erfinden. Nur echte Daten, echte Fotos, Sebis echte Worte. Watzmann = „Schaustück", nicht „seine Tour".
- **Sprache:** locker/zielgruppig (16–34), kein Lehrbuch-Deutsch. Bsp: „Kurz fürs Rucksack-Hirn", „ist top", „Gratis parken".
- **Anti-Slop:** keine Deko-Emoji; Trenner = `.hsep` Berg-Silhouette (nicht `·`); Live-Marker = atmender Smashy (`.live-dot`/`.tk-live__dot`/`.tour-now__dot`); Buttons = geprägtes Emaille (nicht flach); keine schwebenden Einzel-Bubbles → zusammenhängende Panels.
- **Ein Foto pro Tour ist Normalfall** (Sebi macht Videos für Insta) — Format ist darauf ausgelegt.

---

## 6. Hub-Ausbau (nächste Stufen)

- **GPX-Export** (Bergfex → Teilen → GPX) ermöglicht echte Routenkarte statt nur Höhenprofil; optional 3D wie Watzmann (DEM-Methode, s. `project_vh_hulk_hikes_nav`).
- **Empfehlungen → gegangen:** wenn Sebi eine der 6 (Grünstein/Zinnkopf/Dürrnbachhorn/Rauschberg/Gamsknogel/Hochgern) geht → Detailseite bauen, Liste-Zeile auf „gegangen" + klickbar.
- **Skalierung:** Liste ist client-seitig gefiltert/sortiert; JSON-LD ItemList mitpflegen (SEO/KI). Bei vielen Touren später ggf. Daten-getriebenes Rendering erwägen (aber SEO = Text muss im HTML bleiben).
- **Übertragbar auf s2s-Kunden:** Muster (Daten-getriebene Detailseiten, Panel-Split, Live-Widget mit Quelle+Datenschutz) siehe `learning_v3_site_port_patterns`.
