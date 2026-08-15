# Hulk Hikes — Touren-Sektion (Design-Spec)

**Datum:** 2026-07-06
**Status:** Konzept eingefroren (Sub-Projekt B). Wartet auf Sub-Projekt A (Nav/IA-Redesign), das zuerst gebaut wird.
**Projekt:** vegetarianhulk.de
**Brand:** VegetarianHulk (@vegetarianhulk / Sebi)

---

## 1. Was wir bauen

Ein **Wandertouren-Bereich** namens **„Hulk Hikes"** auf vegetarianhulk.de. Ziel: echten Mehrwert für Besucher — Touren, die man **1:1 nachwandern** kann (Orientierung, Nachwandern, Inspiration). Voll nachwanderbare Tourenführer in Sebis Stimme, alle Level, ehrlich eingestuft.

**Nicht** Teil dieser Spec (eigenes Sub-Projekt A, wird zuerst umgesetzt):
- Site-weites Navigations-Redesign (floating VH-Nav)
- Zusammenlegung `/codes` + `/lieblingsprodukte` in eine „Empfehlungen"-Kategorie
- Kategorie-/IA-Struktur der Top-Navigation

Diese Touren-Sektion **setzt sich in den durch Sub-Projekt A geschaffenen Nav-Rahmen ein**. Nav-Integration wird dort finalisiert.

## 2. Positionierung & Voice

- **Alle Level, ehrlich eingestuft** — kein Gipfel-Ego, kein Elite-Gehabe. Der Insta-„Einsteiger-Tour"-Beitrag ist einfach eine der „Leicht"-Touren.
- **Voice (aus den Insta-Cards):** bairisch, warm, ehrlich, anti-Ego. Belege/Ton-Anker:
  - „bei uns **dahoam** zammgstellt"
  - „**alle selber gangen**, alle mit Parkplatz, alle ohne 2 Stunden Anfahrt"
  - „Du brauchst keinen 3000er… der erste Schritt — der Rest kommt von alleine."
- **Anti-Slop-Moat:** echte Sinneseindrücke, echte Bedingungen, Reibung, die ehrliche Lehre des Tages. Keine geglättete KI-Prosa. (= zugleich E-E-A-T-/Trust-Signal für Google.)
- **Home-Turf-Regionen:** Berchtesgadener Land / Chiemgau / Bayern („dahoam") — natürlicher Regions-Cluster für Filter **und** lokales Google-Ranking.
- Brand-Rahmen trägt durch: Forest-Green, Playfair + Inter, Bibel-Vers-Anker auch hier.

## 3. Architektur

Hybrid (laut Recherche der SEO-Gewinner):

- **Übersicht** `/touren/` — Grid aus Touren-Karten, **client-seitig filterbar** in Vanilla JS über die Metadaten (kein Backend, GitHub-Pages-tauglich):
  - Filter: Region · Schwierigkeit · Dauer · Eigenschaften (hund-/kinderwagen-/familientauglich, ÖPNV-erreichbar)
- **Detailseite je Tour** `/touren/<slug>` (z.B. `/touren/mordau-alm`) — eigene URL, teilbar, rankt einzeln.
- Interne Verlinkung: Tour → Regions-Hub → verwandte Touren.
- Nav-Label: **„Hulk Hikes"**. URLs/Seitentitel bleiben SEO-tragend („Tour + Region"), z.B. Titel „Mordau-Alm · Ramsau bei Berchtesgaden".

## 4. Datenmodell pro Tour

Eine Datenquelle pro Tour (JSON/Markdown). Daraus werden generiert: Detailseite, Fakten-Block, Filter-Metadaten, Karte, Höhenprofil, JSON-LD, Sitemap-Eintrag.

**Fakten-Block (Pflicht — immer gleiches Icon+Wert-Raster, in 3 Sek. scanbar):**
- Region / Gebirge
- Tourtyp (Rundweg / Streckentour)
- Distanz (km)
- Höhenmeter ↑ / ↓ (getrennt)
- Gehzeit (reine Gehzeit)
- **Schwierigkeit** — 3-Stufen-Skala **Leicht / Mittel / Anspruchsvoll**, Kondition + Trittsicherheit getrennt erklärt; für harte Touren zusätzlich SAC-Referenz (T1–T6)
- Ausgangspunkt + Anfahrt/Parken (**inkl. ÖPNV**)

**Nice-to-have (Qualität/Long-Tail-SEO):**
- GPX-Download · Höhenprofil-Bild · Einkehr/Hütte · beste Jahreszeit · hund-/kinderwagen-/familientauglich · Wasser/WC · Aussichts-Highlights

**Erzähl-/Content-Teil (Sebis Stimme):**
- Bericht (Story mit Reibung) · Foto-Galerie · Bibel-Vers-Anchor · ehrlicher Einzeiler-Verdict (wie „Knackig steil — aber kurz.") · Datum (Freshness) · **Newsletter-CTA (fixer Standard-Baustein, siehe §7)**

## 5. Visuelle DNA (aus den Insta-Cards abgeleitet)

Die Detailseiten-Hero = die Insta-Card, aber lebendig. Elemente:
- Vanilla-Hintergrund (`--vanilla`) + **Topo-Linien-Textur** + weiche **salbeigrüne Blobs** in den Ecken
- **Gestochene Berg-Illustration** (Engraving-Stil, Forest-Green) als Signatur oben
- **Playfair riesig** für den Tour-Namen (Forest-Green), Ort als Playfair-Sub
- Eyebrow-Label in Caps + optional Fortschritts-Dots (für Serien wie „Einsteiger-Tour 01")
- **Fakten-Dreier mit Trennstrichen:** DISTANZ · HÖHENMETER · GEHZEIT (Icon+Wert)
- **Pin + Ausgangspunkt**
- **Höhenprofil** als gefüllte Forest-Green-Fläche — **automatisch aus GPX generiert**
- Ehrlicher Einzeiler-Verdict
- Footer „@vegetarianhulk — Sebi"

Scroll-Reihenfolge Detailseite: Hero (Card-Look) → interaktive Karte → Bericht → Foto-Galerie → Newsletter-CTA → verwandte Touren.

## 6. Karte & Track

**Entscheidung: interaktive Karte von Anfang an, DSGVO-sauber.**
- **Leaflet** self-hosted (analog `vendor/`-Libs).
- **First-party Karten-Kacheln via PMTiles/Protomaps** — ein einzelnes Kachel-Archiv, läuft auf Static-Hosting via Byte-Range-Requests. Beschränkt auf die relevanten Regionen (Berchtesgadener Land/Chiemgau), ggf. über Cloudflare-Infra statt im GitHub-Repo, um Repo-Größe klein zu halten.
- **2-Klick-Load:** Karte lädt erst auf Nutzer-Klick (Platzhalter davor) → nichts Externes ohne aktive Zustimmung, CSP/`_headers`-Disziplin bleibt gewahrt, top Performance.
- **Track** aus GPX gerendert (leaflet-gpx oder GPX→GeoJSON beim Build).
- **Karten-Style in VH-Forest-Green** gethemt.
- **GPX-Hygiene:** Roh-GPX vor Upload ausdünnen (oft >600 kB, für Web zu groß).
- **Höhenprofil** wird beim Build automatisch aus dem GPX erzeugt (kein Handbau).

## 7. SEO & Monetarisierung

**SEO (größter Reichweiten-Hebel):**
- **JSON-LD pro Tour**, automatisch generiert: `Article`/`BlogPosting` (Bericht, Autor, Datum) + `TouristTrip`/`Place` mit Geo-Koordinaten (Start, Region) + `BreadcrumbList`. Ohne Schema droht Nicht-Indexierung; mit Schema bessere Sichtbarkeit inkl. AI-Overviews.
- Eigene Fotos mit `width`/`height` + WebP/AVIF + sprechende Alt-Texte.
- Sitemap + Breadcrumbs automatisch.
- Interne Verlinkung Tour → Regions-Hub → verwandte Touren.

**Monetarisierung (bewusst schlank):**
- **Keine Gear-Box pro Tour** (bewusst gestrichen — YAGNI, hält die Tour fokussiert). Affiliate lebt zentral auf der gemergten „Empfehlungen"-Seite (`/codes` + `/lieblingsprodukte`, Sub-Projekt A).
- **Newsletter-CTA = fixer Standard-Baustein** auf jeder Tour-Detailseite. **Pflicht-Schritt im Session-Workflow** (§8) — jede neue Tour bekommt ihn automatisch, nie „vergessen".

## 8. Tour-Session-Workflow (so entsteht jede Tour)

Wiederholbarer, Claude-Code-bedienter Workflow. Für Sebi fühlt es sich an wie „Name + Fotos rein → Tour fertig".

1. Sebi: „Neue Tour: *<Name>*" + Fotos + GPX (+ Stichpunkte/komoot).
2. Claude in der Session:
   - GPX ausdünnen; Track + Höhenprofil + (Karten-Assets) generieren
   - Fakten ableiten (Distanz, hm ↑/↓, Gehzeit, Region, Tourtyp)
   - Bericht-Entwurf in Sebis bairischer Stimme
   - Ausgangspunkt/Parken/ÖPNV, Einkehr, Jahreszeit, Eigenschaften
   - Bibel-Vers-Anchor, Meta-Tags, JSON-LD
   - **Newsletter-CTA einsetzen (Pflicht)**
3. Gemeinsam feilen (Sebi reviewt Text/Fakten).
4. Build-Script (Claude-Werkzeug) baut Detailseite + Übersicht + Sitemap.
5. Cache-Busting (`./scripts/bump-asset-versions.sh`) + live.

Der Build läuft als kleines Generator-Script (Claude-bedient) → Inhalt landet **statisch im HTML** (SEO-safe), keine Handarbeit/Fehlerquellen für Sebi. Weicht bewusst von VHs „kein Build-Tool" ab — aber nur für diese Sektion und nur als internes Werkzeug.

## 9. MVP / Start

- Framework: Übersicht + Filter + Detail-Template + Karte (Leaflet/PMTiles/2-Klick) + Höhenprofil-Generator + Build-Script + JSON-LD.
- **2 Pilot-Touren** aus Sebis Insta-Cards (Daten liegen bereits vor):
  - **Mordau-Alm**, Ramsau bei Berchtesgaden — 5 km · 294 hm · ca. 1:25 h · Parkplatz Taubensee, Ramsau · Einsteiger-Tour 01
  - **Steiner Alm**, bei Anger — ca. 7,7 km (hin & zurück) · 546 hm · ca. 2:45 h · Waldparkplatz Urwies, Anger · „Knackig steil — aber kurz."
- Restliche Touren der „6 Touren"-Serie folgen per Session-Workflow.

## 10. Offene Punkte / Abhängigkeiten

- **Abhängig von Sub-Projekt A** (Nav/IA-Redesign): finale Nav-Integration, Kategorie-Einordnung, Verhältnis zur „Empfehlungen"-Seite.
- Berg-Engraving-Illustration(en): als wiederverwendbares Asset sichern/erzeugen (per Region oder Set).
- PMTiles-Extrakt-Umfang (welche Regionen, Zoom-Range) + Hosting-Ort (Repo vs. Cloudflare).
- Schwierigkeits-Skala final ausformulieren (Kriterien-Text Kondition/Trittsicherheit, SAC-Mapping).
