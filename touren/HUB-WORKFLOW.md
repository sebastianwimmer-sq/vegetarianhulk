# Hulk Hikes — Hub-Workflow & Daten-Spec (SSoT)

Verbindliche Vorlage für alle künftigen Touren + den Ausbau des Hulk-Hikes-Hubs.
Stand fixiert 21.07.2026. Referenz-Instanz: `touren/ristfeuchthorn/index.html`.
**Neue Tour = diese Datei kopieren, Daten tauschen, Build-Schritte abarbeiten, verifizieren.** Nichts an der Struktur ändern.

---

## 1. System-Überblick

Zwei Seitentypen, beide im v3-Editorial-Dark-Look (shared `/v3.css`, `/v3.js`, `/fonts.css`; Shell = bg-wrap, rails, topbar, `.nav`, footer):

| Seite | Datei | Zweck |
|---|---|---|
| **Hub / Liste** | `touren/index.html` | Forum-Liste: Pinned-Highlight (zuletzt gegangen) + Toolbar (Suche/Filter/Sort) + expandierbare Zeilen. |
| **Tour-Detail** | `touren/<slug>/index.html` | Volle Tour: Foto-Hero → Split (Praxis \| Meinung) → Höhenprofil → CTA. Nur für **selbst gegangene** Touren. |

**Regel:** Empfehlungen (nicht selbst gegangen) leben nur als Zeile/Karte in der Liste. Sobald Sebi eine geht → Detailseite + Umschalten auf „gegangen".

---

## 2. Tour-Detail — FIXIERTE Reihenfolge (nicht ändern)

1. **Foto-Hero** (`.tour-hero`) — full-bleed Foto (78vh, Zoom-in beim Laden), Overlay: Crumb, DAV-Badge, Playfair-H1, Untertitel, Lead, **Fakten-Strip** (Playfair-Zahlen auf Hairline) inkl. **Live-„Jetzt"-Fakt** (Smashy-Dot + Temp am Gipfel).
2. **Split** (`.tour-split` → `.tour-split__grid`, 2 symmetrische Panels, ab 820px gestapelt):
   - Links `.tour-panel--dark`: Kicker „Vorm Start" + Playfair-Titel + **Info-Tafel** (`.tour-rows` → `.tour-row` = `<dt>`Label | `<dd>`Text, Hairline-Divider; KEINE Einzel-Bubbles!) + Foot (Video/Maps-Links).
   - Rechts `.tour-panel--cream` (`data-light`): Kicker „Gegangen ⌃ Datum" + Playfair-Titel „Meine Meinung" + handschriftliche Notiz (`.tour-note__body`, Caveat) + Signatur (`.tour-note__sig`) + **Aktivitäts-Beweise** (`.tour-proof`, unten bündig).
3. **Höhenprofil** (`.tour-profile`) — dunkle Karte, SVG zeichnet sich beim Reveal (draw-on), kompakt (Höhe clamp 120–168px).
4. **CTA** (`.tour-cta`, `data-light`) — Newsletter, geprägter `.tour-btn`.
5. Zurück-Link `.tour-back` → `/touren/`.

Header beider Split-Panels IMMER gleich (Mono-Kicker + Playfair-Titel), `align-items: stretch` → gleiche Höhe.

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

1. **Ordner:** `mkdir touren/<slug>` · `touren/ristfeuchthorn/index.html` als Basis kopieren.
2. **Foto (HEIC → Web):** iPhone-HEIC ist sideways + EXIF-Falle. Ablauf:
   `sips -s format jpeg -Z 1600 IN.HEIC --out _t.jpg` → `sips -r 90 _t.jpg --out _t2.jpg` (aufrecht drehen) → Pillow: `Image.open('_t2.jpg').convert('RGB').save('<slug>/ausblick.jpg', quality=82, optimize=True)` (OHNE exif = Tag weg). **NICHT** `ImageOps.exif_transpose` auf die schon gedrehte Datei (überkorrigiert). PIL kann HEIC nicht direkt → sips als Reader.
3. **Daten tauschen** (§3) in Hero, Fakten, Split-Zeilen, Notiz, Proof, Datum, Badge.
4. **Höhenprofil-SVG:** Pfad-Punkte aus dem Bergfex-Profil nachzeichnen (viewBox 0 0 900 270, `preserveAspectRatio="none"`), Peak-Marker setzen.
5. **Wetter:** in beiden Wetter-Skripten `elevation=<Gipfelhöhe>` (lat/lon = Bergregion) setzen. Muster: WMO-Code → Fineline-Icon-Map (aus Vorlage übernehmen).
6. **Liste eintragen** (`touren/index.html`): Pinned-Highlight = neueste gegangene Tour; Zeile mit `data-name` (lowercase, inkl. Umlaut+ASCII-Variante fürs Suchen), `data-region`, `data-diff`, `data-thm` (NICHT `data-hm` — v3.js-Altimeter überschreibt `[data-hm]`!), `data-date`.
7. **Cache-Busting:** `./scripts/bump-asset-versions.sh` (kennt v3.css/v3.js/relief3d.js). Neue seiten-eigene Assets brauchen kein `?v=` (sind im Ordner).
8. **Verifizieren:** WebKit + Chromium, 1000px + 375px, keine JS-Fehler, kein Overflow, Live-Widget-Ausfall = lautlos hidden. Screenshots selbst prüfen.
9. **Datenschutz:** Neue Drittanbieter-Calls (Karten-Embed etc.) IMMER in `datenschutz.html` §4+§5 + Quell-Link am Widget. Open-Meteo ist bereits drin.

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
