# VH Navigation & IA Redesign — Design-Brief (für Claude Design)

**Datum:** 2026-07-06
**Projekt:** vegetarianhulk.de
**Sub-Projekt:** A (wird VOR der Touren-Sektion gebaut; sie setzt sich in diesen Rahmen ein)
**Deliverable dieses Docs:** Brief für Claude Design. Danach: Pre-Review → Implementierung durch Claude Code (mit frontend-design / a11y / motion / impeccable Skills).

---

## 0. Auftrag in einem Satz

Die site-weite Navigation von vegetarianhulk.de wird zu einer **schwebenden, editorialen VH-Nav** ("floating pill") mit **5 klaren Zielen**, gestochenem Icon-Set, einem prominenten Center-CTA und einer feinen, zielgerichteten Motion-Signatur — das Flaggschiff-Element, das den Qualitätsanspruch des „ultimativen VH-Builds" setzt.

## 1. Referenz & Abgrenzung

- **Struktur-Referenz:** floating Pill-Navigation (schwebende, abgerundete Leiste, ~5 Slots, hervorgehobener Center-Button) — siehe iconly.pro „Crypto Dashboard UI".
- **BEWUSSTE ABGRENZUNG:** NICHT der Krypto-/Tech-/Glassmorphism-Look. Wir übersetzen das *Muster* (schwebend, kompakt, Center-Fokus) in **VH-Editorial**: warm, Papier/Vanilla, Forest-Green, gestochene Berg-Ästhetik. Kein kaltes Glas, kein Gradient-Purple, keine Neon-Akzente.

## 2. Brand-Rahmen (verbindlich)

- **Farben:** `--vanilla #f7efde`, `--beige-1 #efe5cf`, `--earth #cfbf9d`, `--ink #1a1410`, `--ink-2 #5c513f`; Forest: `--forest-primary #045927` (CTAs/aktiv), `--forest-anchor #122d1c` (tiefste), `--forest-accent #1a7340` (Detail-Brights).
- **Typo:** Playfair Display (Display), Inter (UI/Body). **Nav-Labels in Inter** (Legibilität small), P&P-Monogramm in Playfair.
- **Ästhetik-DNA (aus den Hulk-Hikes-Cards):** Topo-Linien-Textur, salbeigrüne Blobs, **gestochene Line-Art** (Engraving). Diese DNA soll die Nav-Icons tragen → visuelle Klammer zwischen Nav und Touren.
- **Ton:** authentisch, diszipliniert, bairisch-warm, anti-Ego.

## 3. Informationsarchitektur (final)

**5 primäre Ziele (die floating Nav):**
- **Startseite** → `/`
- **Hulk Hikes** → `/touren/` *(neu — Wandertouren-Sektion; = Center-Slot / Mehrwert-Magnet, siehe §5)*
- **Smash Partner & Picks** → `/partner-picks/` *(gemergte Kategorie: Codes + Lieblingsprodukte)*; Kurzmarke **„P&P"**
- **Newsletter** → `/newsletter`
- **Für Brands** → `/kooperationen.html`

**Physische Reihenfolge (Center = Mehrwert):**
`Startseite · P&P · [ Hulk Hikes ] · Newsletter · Für Brands`
→ Hulk Hikes sitzt mittig und ist der hervorgehobene Hero-Slot (Retention: „der Grund wiederzukommen"). Startseite außen links (Konvention), Für Brands außen rechts (seltenstes Ziel).

**Footer (nicht in der floating Nav):** Impressum, Datenschutz.

**Merge-Detail „Smash Partner & Picks":**
- Vereint bisher `/codes/` („Smash Codes": Partner-Rabattcodes Nature Heart, Alpin Loacker) + `/lieblingsprodukte/` („Hulk's Picks": Amazon-Gear).
- **Kanal-Regel bleibt zwingend:** Produkte, die es bei Nature Heart ODER Alpin Loacker gibt, ausschließlich über deren Partner-Link/Code — niemals Amazon. Amazon nur, was NH/AL nicht führen.
- Neue Seitenstruktur: ein Dach, zwei Abschnitte („Partner & Codes" / „Meine Picks"), mit **P&P-Monogramm** als Header-Badge.
- **Redirects Pflicht:** `/codes/` und `/lieblingsprodukte/` müssen auf die neue URL weiterleiten (301-Ersatz auf GitHub Pages: Redirect-Stub-HTML mit `<link rel="canonical">` + Meta-Refresh + JS). Interne Links + Sitemap + Footer aktualisieren.

## 4. Floating Nav — Verhalten & Responsive

- **EINE konsistente Corporate-Design-Nav auf ALLEN Plattformen** (Sebi-Vorgabe): dieselbe schwebende VH-Pille überall — KEIN abweichender Klassik-Header auf Desktop. Wiedererkennung > OS-Konvention.
- **Mobile (Hauptzielgruppe):** floating **Bottom-Bar**, daumenreichweite, mit Safe-Area-Inset. Auto-Hide beim Runterscrollen, Reveal beim Hochscrollen.
- **Desktop:** dieselbe schwebende Pille (Top-Center), die beim Scrollen dezent kondensieren darf — aber form-/materialidentisch zur Mobile-Version. Wortmarke `vegetarian**hulk**` links außerhalb der Pille.
- **Immer sichtbar / persistent**, aber unaufdringlich (schwebt über Content mit weichem Schatten + `--earth`-Border).
- **Material:** warme Vanilla/Beige-Oberfläche, weiche Elevation, optional Hauch Topo-Textur. KEIN Glas.

## 5. Center-Slot (prominent) — final

- **Center = Hulk Hikes** (Entscheidung Sebi). Rationale: der **Mehrwert-Magnet** = der Grund, immer wieder zurückzukommen (Retention). Die Berg-Touren sind der wiederkehrende Sog, nicht ein einmaliger Conversion-Klick.
- Behandlung: gefüllte/erhöhte **`--forest-primary`**-Hero-Pille, größer als die Nachbar-Slots, **Berg-Gipfel-Icon** (Engraving-Signatur), dezenter Idle-Glow (sparsam), taktiles Press-Feedback. Das „Smash"-Moment der Nav.
- **Newsletter** bleibt starker Slot rechts der Mitte; Conversion läuft weiter über bestehende CTAs (Sticky, In-Page, Tour-Seiten).
- Claude Design darf 1 Vergleichs-Variante mit Newsletter-Center liefern — Default ist aber Hulk Hikes.

## 6. Icon-Set (gestochen / Engraving-Stil)

5 Line-Art-Icons im Berg-Engraving-Duktus der Touren-Cards (Forest-Green, dünne Kontur):
- Startseite → Haus/Berg-Dach
- Hulk Hikes → **Berg-Gipfel** (Signatur, verwandt mit der Card-Illustration)
- Smash Partner & Picks → **P&P-Monogramm** (Playfair, Ampersand-forward) oder Anhänger/Knoten-Marke
- Newsletter → Brief/Umschlag
- Für Brands → Handschlag/Ring
> **Labels + Icons zusammen** (nicht icon-only) — Klarheit & Barrierefreiheit. Auf sehr kleinen Screens dürfen Nicht-Center-Labels dezenter/kleiner werden, aber lesbar bleiben.

## 7. States (bitte alle mit-designen)

- **Default / Hover / Active (`aria-current`) / Focus-visible / Pressed**
- **Aktiv-Indikator:** gleitende/morphende Pille oder Underline, die zwischen Slots wandert (Shared-Element-Gefühl) — nur `transform`.
- **Scrolled / kondensiert** (Desktop-Header → Pille).
- **Center-CTA-Emphasis** (Idle + Hover + Press).
- **Reduced-Motion-Fallback** (alles ohne Bewegung, nur Zustandswechsel).

## 8. Motion-Signatur (compositor-friendly, cross-brand)

Nur `transform` / `opacity` (Perf-Regeln VH). **Shared Motion-Tokens mit s2s** (gemeinsame Marken-Motion-Sprache):
- `--duration-fast: 150ms`, `--duration-normal: 300ms`, `--ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1)`
- **Nav-Entrance:** Fade + sanftes Rise beim Load.
- **Hover:** magnetischer Icon-Pull, Label-Underline-Sweep, dezente Scale.
- **Active:** gleitender Indikator (Transform-Morph).
- **Center-CTA:** weicher Idle-Puls (sparsam), taktiles Press.
- **Mobile-Menü (falls expandierend):** gestaffeltes Reveal.
- **`prefers-reduced-motion: reduce` → alles aus.**

**Cursor-Signatur (Sebi-Vorgabe: mit rein, aber VH-passend):**
- **Nur Desktop / `@media (hover:hover) and (pointer:fine)`** — auf Touch komplett aus (Mobile = Hauptzielgruppe, kein Cursor).
- **Editorial statt Gimmick:** dezenter, VH-eigener Cursor — z.B. ein feiner Forest-Green-Ring/Punkt im Engraving-Duktus, der bei interaktiven Elementen (Nav-Slots, Buttons, Links, Touren-Karten) sanft wächst/andockt (**magnetischer Pull**), sonst unsichtbar-zurückhaltend.
- Optional: leichte Trail-/Ease-Verzögerung — aber subtil, `transform`/`opacity` only, **kein** ruckartiger Maus-Follower, **kein** Verdecken des echten Cursors an Formularen/Text.
- **Bei `prefers-reduced-motion: reduce` → System-Cursor, Effekt aus.**
- **Anti-Slop-Guardrail:** Motion & Cursor müssen *Flow klären*, nicht ablenken. Kein Neon, kein verspielter Takeover — die Signatur soll „premium/handgemacht" wirken, verwandt mit der Engraving-DNA.

## 9. Barrierefreiheit (Pflicht)

- Semantisch: `<nav aria-label="Hauptnavigation">`, `<a aria-current="page">`.
- Voll tastaturbedienbar, sichtbarer Focus-Ring, logische Tab-Reihenfolge.
- Touch-Targets ≥ 44px.
- Labels sichtbar (nicht nur Icons).
- Kontrast AA (Text/Icon auf Vanilla/Beige und auf Forest-Center).
- Reduced-Motion respektiert.

## 10. Deliverables von Claude Design

1. Floating Nav **Desktop** (default + scrolled/kondensiert) — 2–3 Varianten.
2. Floating Nav **Mobile Bottom-Bar** (default + scroll-hidden + ggf. expanded) — passend zu den Desktop-Varianten.
3. **Alle States** aus §7.
4. **Icon-Set** (5, Engraving-Stil) + **P&P-Monogramm**.
5. **Motion-Notes** (was animiert, Timing, Easing) je Element.
6. Light-Mode (VH ist Light-Brand; kein Auto-Dark).

## 11. Erfolgskriterien / Checkliste

- [ ] Sieht NICHT aus wie das Krypto-/Tech-Template — unverkennbar VH-Editorial.
- [ ] 5 Ziele klar, Center-CTA sticht heraus.
- [ ] Icons tragen die Engraving-DNA der Touren-Cards (visuelle Klammer).
- [ ] Hover/Focus/Active/Pressed fühlen sich *designed* an.
- [ ] Mobile-first, daumenreichweite, Auto-Hide sauber.
- [ ] a11y vollständig (Tastatur, Kontrast, Reduced-Motion, Labels).
- [ ] Redirect-/Merge-Plan für Codes+Picks steht.
- [ ] Motion nur compositor-friendly; Tokens teilbar mit s2s.

## 12. Entscheidungen (fixiert) & offene Rest-Punkte

**Fixiert (Sebi, 06.07.):**
- **Center-Slot = Hulk Hikes** (Mehrwert/Retention). Newsletter-Center nur als Vergleichs-Variante.
- **P&P-URL = `/partner-picks/`** (+ Redirect-Mapping von `/codes/` & `/lieblingsprodukte/`).
- **Desktop = dieselbe floating Corporate-Nav** wie Mobile (kein Klassik-Header) — konsistent auf allen Plattformen.
- **Cursor-Signatur ist drin** (Desktop-only, editorial, Guardrails in §8).

**Rest-Punkte:**
- Redirect-Detail-Mapping (welche Alt-URL → welcher Abschnitt der P&P-Seite).
- Cross-brand Motion-Token-Datei (gemeinsame `motion.css` VH ↔ s2s) — eigener kleiner Track.
