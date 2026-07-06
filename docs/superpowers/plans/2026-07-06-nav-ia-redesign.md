# VH Nav & IA Redesign — Implementation Plan (Sub-Projekt A)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Site-weite VegetarianHulk-Navigation auf eine schwebende, editoriale VH-„floating pill" umstellen (5 Ziele, Center = Hulk Hikes), `/codes/` + `/lieblingsprodukte/` zu `/partner-picks/` („Smash Partner & Picks", P&P) mergen inkl. Redirects, plus feine Menü- + Cursor-Motion.

**Architecture:** Statische Site (kein Build-Tool). Nav-Markup bleibt **in jedem HTML im DOM** (SEO/internes Linking, no-JS-safe). Styles zentral in `style.css`. Verhalten (Auto-Hide, Aktiv-Indikator, Cursor-Signatur) als **progressive-enhancement JS** (`nav.js`), die bei fehlendem JS oder `prefers-reduced-motion` sauber degradiert. Icons als inline-SVG (Engraving-Stil).

**Tech Stack:** HTML5, CSS (Custom Properties, `style.css`), Vanilla JS (ES, kein Framework), GitHub Pages. Cache-Busting via `./scripts/bump-asset-versions.sh`.

## Global Constraints

- Kein Build-Tool, kein npm-Dependency für Runtime — Vanilla only.
- Brand-Tokens verbindlich: `--vanilla #f7efde`, `--beige-1 #efe5cf`, `--earth #cfbf9d`, `--ink #1a1410`, `--ink-2 #5c513f`, `--forest-primary #045927`, `--forest-anchor #122d1c`, `--forest-accent #1a7340`.
- Typo: Playfair Display (Display), Inter (UI/Nav-Labels).
- Motion nur `transform`/`opacity`; Tokens `--duration-fast:150ms`, `--duration-normal:300ms`, `--ease-out-expo:cubic-bezier(0.16,1,0.3,1)`.
- a11y: `<nav aria-label>`, `aria-current="page"`, Focus-visible, Touch-Target ≥44px, Labels sichtbar, Kontrast AA, `prefers-reduced-motion` respektiert.
- Cursor-Signatur: nur `@media (hover:hover) and (pointer:fine)`; auf Touch + reduced-motion aus.
- 5 Nav-Ziele, Reihenfolge: `Startseite · P&P · [Hulk Hikes] · Newsletter · Für Brands`. Center = Hulk Hikes (Hero-Slot).
- Kanal-Regel P&P: NH/Alpin-Loacker-Produkte nur über Partner-Codes, nie Amazon.
- Alte URLs `/codes/`, `/lieblingsprodukte/` MÜSSEN weiterleiten (kein 404, kein Linkrot).
- Alle Seiten mit Nav (7): `index.html`, `impressum.html`, `anfrage.html`, `datenschutz.html`, `kooperationen.html`, `codes/index.html`, `lieblingsprodukte/index.html`. Zusätzlich Footer-Nav + `404.html`.

---

## File Structure

- `style.css` — Nav-Komponente (`.vh-nav`, Slots, Center-Hero, States, responsive top/bottom), P&P-Badge, Cursor-Layer, Motion-Tokens (falls noch nicht in `:root`).
- `nav.js` (neu) — Progressive Enhancement: Scroll-Auto-Hide, Aktiv-Slot-Markierung via `location.pathname`, Mobile/Desktop-Placement-Hook, Cursor-Signatur (Desktop-only). Selbst-degradierend.
- `assets/nav/` (neu) — Engraving-SVG-Icons (5) + P&P-Monogramm (kann auch inline liegen).
- `partner-picks/index.html` (neu) — gemergte Seite (Abschnitte „Partner & Codes", „Meine Picks"). Datenquellen: `codes/partners.js`, `lieblingsprodukte/products.js`.
- `codes/index.html`, `lieblingsprodukte/index.html` — ersetzt durch **Redirect-Stubs** (canonical + meta-refresh + JS) auf `/partner-picks/`.
- Nav-Markup in den 7 Seiten + Footer-Links + `sitemap.xml` + `404.html`.

Jede Task endet mit sichtbar/klickbar prüfbarem Ergebnis. Verifikation (statische Site): visueller Check im Browser + `./scripts/pre-merge-audit.sh` + Link-Check-Workflow + manueller a11y-/Keyboard-/Reduced-Motion-Check.

---

## Task 1: Nav-Markup-Partial + Design-Tokens festlegen (Single Source im Kopf)

**Files:** Modify `style.css` (`:root` Tokens + `.vh-nav`-Grundgerüst), Referenz-Markup in `index.html`.

**Interfaces — Produces:** kanonisches Nav-HTML-Snippet (identisch für alle Seiten), CSS-Klassen `.vh-nav`, `.vh-nav__slot`, `.vh-nav__slot--center`, `.vh-nav__label`, `.vh-nav__icon`, `.vh-nav__indicator`.

- [ ] **Step 1:** In `style.css` `:root` sicherstellen/ergänzen: `--duration-fast`, `--duration-normal`, `--ease-out-expo` (falls fehlen).
- [ ] **Step 2:** Kanonisches Nav-Markup definieren (in `index.html` als erste Instanz), semantisch:
  ```html
  <nav class="vh-nav" aria-label="Hauptnavigation" data-vh-nav>
    <a class="vh-nav__slot" href="/" data-slot="home"><span class="vh-nav__icon">…svg…</span><span class="vh-nav__label">Start</span></a>
    <a class="vh-nav__slot" href="/partner-picks/" data-slot="pnp"><span class="vh-nav__icon">…</span><span class="vh-nav__label">P&amp;P</span></a>
    <a class="vh-nav__slot vh-nav__slot--center" href="/touren/" data-slot="hikes"><span class="vh-nav__icon">…berg…</span><span class="vh-nav__label">Hulk&nbsp;Hikes</span></a>
    <a class="vh-nav__slot" href="/newsletter" data-slot="news"><span class="vh-nav__icon">…</span><span class="vh-nav__label">Newsletter</span></a>
    <a class="vh-nav__slot" href="/kooperationen.html" data-slot="brands"><span class="vh-nav__icon">…</span><span class="vh-nav__label">Für&nbsp;Brands</span></a>
    <span class="vh-nav__indicator" aria-hidden="true"></span>
  </nav>
  ```
- [ ] **Step 3:** Basis-CSS `.vh-nav` (floating pill, Vanilla/Beige-Surface, `--earth`-Border, weiche Elevation, KEIN Glas), Slots als Flex, Center-Slot erhöht/`--forest-primary`.
- [ ] **Step 4:** Verifikation: `index.html` im Browser — Pille schwebt, 5 Slots, Center hebt sich ab. Screenshot.
- [ ] **Step 5:** Commit `feat(nav): floating VH nav base + tokens (index)`.

## Task 2: Responsive Placement + Auto-Hide (nav.js)

**Files:** Create `nav.js`; Modify `style.css` (Media-Queries top/bottom), `index.html` (script-Tag).

**Interfaces — Consumes:** `.vh-nav` von Task 1. **Produces:** globales Verhalten (Auto-Hide, Aktiv-Slot via `aria-current`), lädt auf allen Seiten.

- [ ] **Step 1:** CSS: Mobile = fixed bottom (Safe-Area-Inset), Desktop = fixed top-center; identisches Material/Form.
- [ ] **Step 2:** `nav.js`: Aktiv-Slot anhand `location.pathname` setzen (`aria-current="page"` + Indicator positionieren), Scroll-Auto-Hide (`transform: translateY`), reduced-motion-Guard.
- [ ] **Step 3:** `<script src="/nav.js" defer>` in `index.html`.
- [ ] **Step 4:** Verifikation: Mobile-Viewport (Bottom, Auto-Hide beim Scrollen), Desktop (Top), Aktiv-Slot korrekt. Keyboard-Tab durch Slots, Focus sichtbar.
- [ ] **Step 5:** Commit `feat(nav): responsive placement + scroll auto-hide + active slot`.

## Task 3: Engraving-Icon-Set + P&P-Monogramm

**Files:** Create `assets/nav/*.svg` (oder inline), Modify Nav-Markup (Icons einsetzen), `style.css` (Icon-Sizing/Farbe).

- [ ] **Step 1:** 5 dünne Line-Art-SVGs im Engraving-Duktus: home/Berg-Dach, **Berg-Gipfel** (hikes), P&P-Monogramm, Umschlag (newsletter), Handschlag (brands). `currentColor`, `stroke-width` konsistent.
- [ ] **Step 2:** Icons ins Nav-Markup (Task-1-Snippet) einsetzen; P&P-Monogramm in Playfair-Anmutung.
- [ ] **Step 3:** Verifikation: Icons scharf @1x/@2x, Forest-Green, gleiches Gewicht, Center-Berg dominant.
- [ ] **Step 4:** Commit `feat(nav): engraving icon set + P&P monogram`.

## Task 4: Menü- & Cursor-Motion

**Files:** Modify `nav.js` (Cursor-Signatur, magnetischer Hover), `style.css` (Hover/Active/Press, Indicator-Transition, Cursor-Layer).

- [ ] **Step 1:** CSS Hover (Label-Underline-Sweep, dezente Scale), Active (gleitender Indicator, `transform`), Pressed; alles `transform`/`opacity`.
- [ ] **Step 2:** `nav.js`: Cursor-Signatur nur `@media (hover:hover) and (pointer:fine)` — Forest-Ring, magnetischer Pull an `.vh-nav__slot`/Buttons/Links; auf Touch + reduced-motion aus; echten Cursor an Text/Formularen NICHT verdecken.
- [ ] **Step 3:** Verifikation: Desktop-Hover/Cursor smooth (60fps, keine Layout-Thrash), Touch = kein Custom-Cursor, `prefers-reduced-motion` = alles statisch.
- [ ] **Step 4:** Commit `feat(nav): editorial menu + cursor motion (guarded)`.

## Task 5: Nav auf alle Seiten ausrollen

**Files:** Modify `impressum.html`, `anfrage.html`, `datenschutz.html`, `kooperationen.html`, `404.html`, Footer-Nav-Blöcke; `<script src="/nav.js" defer>` überall.

- [ ] **Step 1:** Altes `topbar-nav`-Markup je Seite durch das kanonische `.vh-nav`-Snippet (Task 1/3) ersetzen; `nav.js` einbinden.
- [ ] **Step 2:** Footer-Nav-Labels/Links angleichen (Codes/Lieblingsprodukte → „Smash Partner & Picks" `/partner-picks/`).
- [ ] **Step 3:** `404.html` (eigener Token-Block) — Nav + Hex synchron.
- [ ] **Step 4:** Verifikation: jede Seite Nav identisch, Aktiv-Slot je Seite korrekt, keine tote Referenz.
- [ ] **Step 5:** Commit `feat(nav): roll out floating nav across all pages`.

## Task 6: `/partner-picks/` Merge-Seite

**Files:** Create `partner-picks/index.html`; nutzt Daten aus `codes/partners.js`, `lieblingsprodukte/products.js`.

- [ ] **Step 1:** Neue Seite mit VH-Editorial-Layout: Header + **P&P-Monogramm**, zwei Abschnitte „Partner & Codes" (aus `partners.js`) und „Meine Picks" (aus `products.js`). Kanal-Regel-Kommentar beibehalten.
- [ ] **Step 2:** Daten-Rendering (bestehendes Card-Muster wiederverwenden, DRY), Newsletter-CTA, Bibel-Vers-Anchor.
- [ ] **Step 3:** Verifikation: alle Partner + Picks gerendert, Affiliate-Tags/Codes intakt, PENDING-Karten korrekt „Link folgt".
- [ ] **Step 4:** Commit `feat(partner-picks): merged Codes + Picks page (P&P)`.

## Task 7: Redirects + interne Links + Sitemap

**Files:** Replace `codes/index.html` & `lieblingsprodukte/index.html` durch Redirect-Stubs; Modify `sitemap.xml`, `robots.txt` (falls nötig), alle internen Verweise.

- [ ] **Step 1:** Redirect-Stub (beide alten Pfade): `<link rel="canonical" href="https://vegetarianhulk.de/partner-picks/">` + `<meta http-equiv="refresh" content="0; url=/partner-picks/">` + JS-Fallback + sichtbarer „Weiterleitung"-Text.
- [ ] **Step 2:** `grep -rn '/codes/\|/lieblingsprodukte/'` — alle internen Links auf `/partner-picks/` umbiegen (außer den Redirect-Stubs selbst).
- [ ] **Step 3:** `sitemap.xml`: alte Einträge → `/partner-picks/` + `/touren/`-Platzhalter erst in Sub-Projekt B.
- [ ] **Step 4:** Verifikation: `/codes/` & `/lieblingsprodukte/` leiten weiter; kein interner Link zeigt mehr auf alte Pfade.
- [ ] **Step 5:** Commit `feat(ia): redirect codes+lieblingsprodukte to /partner-picks/`.

## Task 8: Audit, Cache-Bust, Abschluss

**Files:** ggf. `version.json`; Cache-Bust-Script.

- [ ] **Step 1:** `./scripts/pre-merge-audit.sh` + Link-Check laufen lassen, Findings fixen.
- [ ] **Step 2:** a11y manuell: Keyboard-Nav, Focus-Ring, Kontrast, `prefers-reduced-motion`, Touch-Targets.
- [ ] **Step 3:** `./scripts/bump-asset-versions.sh` (CSS/JS `?v=` Hashes).
- [ ] **Step 4:** Verifikation: Desktop + Mobile (320/768/1024/1440) kein Overflow, Nav sauber; Security/Redirect-Sweep.
- [ ] **Step 5:** Commit `chore(nav): audit + cache-bust` + Push/PR.

---

## Self-Review (gegen Brief)

- IA/5 Slots/Center=Hikes → Task 1,2,5 ✅
- Floating, alle Plattformen konsistent → Task 1,2 ✅
- Engraving-Icons + P&P-Monogramm → Task 3,6 ✅
- Menü- + Cursor-Motion (guarded) → Task 4 ✅
- Merge P&P + Kanal-Regel → Task 6 ✅
- Redirects/kein Linkrot → Task 7 ✅
- a11y + Motion-Tokens + Perf → Global + Task 8 ✅
- Cache-Bust-Pflicht → Task 8 ✅
- Sub-Projekt B (Hulk Hikes) = eigener Plan, folgt danach (braucht GPX+Fotos).
