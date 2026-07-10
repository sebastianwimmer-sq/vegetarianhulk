# VegetarianHulk v3 — Design-Brief (Pro-Overhaul)

**Datum:** 2026-07-06
**Zweck:** Kompletter Design-Overhaul der Personal-Brand-Site vegetarianhulk.de — weg vom „KI-generierten Look", hin zu echtem Grafik-Designer-Niveau. Input für Design-Tool (Stitch) / Claude Design → dann Implementierung durch Claude Code.
**Kern-Neuerung v3:** die **Hulk-Hikes-Wandertouren** als echter Mehrwert für Sebis Social-Media-Follower (nachwanderbar, ehrlich eingestuft).

---

## 1. Marke & Haltung
- **VegetarianHulk / Sebi** — vegetarischer Fitness- & Berg-Lifestyle, diszipliniert, gläubig (Christ), bairisch-warm, anti-Ego, „kein Coaching-Sprech".
- **Tagline:** „Disziplin ist kein Talent. Sie ist ein Ritual." · **Anker-Vers:** Sprüche 24,16.
- **Voice:** ehrlich, bodenständig, bairisch („dahoam", „alle selber gangen"), Reibung statt geglätteter KI-Prosa.
- **Maskottchen:** „Smashy" (Community = „Smashies").

## 2. Register & Look
- **Light-Editorial-Brand** (NICHT dark wie s2s). Warmes Vanilla/Papier, gestochen-editorial (Magazin-Ruhe), Outdoor-Heritage.
- **Nordstern-Referenzen:** Tracksmith, Huckberry, Cereal Magazine, Kinfolk. (Serifen-Display + Sans-Meta, Rules statt Cards, warme gedämpfte Palette, Whitespace-Disziplin.)
- **Dimensionaler Gradient („s2s-Qualität in unserer Farbfamilie"):** gelittete Forest-Verläufe mit Tiefe (heller Mint-Bloom → tiefes Anchor-Grün) auf Heroes/CTAs/Akzenten — NICHT flach, NICHT glassy.

## 3. Farbe & Typo (verbindlich)
- **Palette:** Vanilla `#f7efde` · Beige `#efe5cf` · Earth `#cfbf9d` · Ink `#1a1410` · Ink-2 `#5c513f`. Forest: anchor `#122d1c`, primary `#045927`, accent `#1a7340`.
- **Signatur-Gradient „Waldtiefe":** radialer Mint-Bloom (oben-links) + Anchor-Tiefe (unten-rechts) über linearem Forest-Verlauf.
- **Typo:** Playfair Display (Display/Headlines/Zahlen/Zitate, Weights 400/600/700), Inter (Body/Meta/Eyebrows). **Große Skalensprünge** (Hero → Section → Body), keine 1,5×-Sprünge.
- **Textur:** feines Papier-Grain global + Topo-Linien-Andeutung + gestochene Berg-Illustration als wiederkehrendes Motiv.

## 4. Anti-Slop-Gesetze (Pflicht)
- KEINE uniformen gleich-großen Card-Grids · KEIN Glassmorphism-als-Default · nicht alles zentriert.
- Hierarchie über **Typ + Raum + Linien**, nicht über Ränder/Boxen. **Ein Held pro Sektion.**
- Scale-Kontrast (3×+), Asymmetrie, Grid brechen, editorialer Rhythmus (enge/weite Abstände wechseln), Whitespace-Disziplin, Textur/Tiefe wo Überlappung.

## 5. Content-Block-Kit (wiederkehrend, auf JEDER Seite)
1. **SectionHeader** — Eyebrow (getrackt + Nummer) + Playfair-Headline (+Italic-Forest-Akzent) + Rule.
2. **EditorialIndex** — nummerierte Zeilen mit Trennlinien (Touren, Partner, Rezepte) statt Cards.
3. **SectionDivider** — gestochenes Berg-Motiv + Rule (der „Fingerabdruck").
4. **FeatureRow** — alternierender, asymmetrischer Text/Bild-Block (58/42, Überlappung).
5. **PullQuote** — großes Playfair-Zitat, viel Luft.
6. **StatRow** — große Zahlen + Rules (nicht Boxen) — für Touren-Fakten (km, hm, Gehzeit).

## 6. Navigation (v3, gebaut)
- **Floating Bottom-Bar** (Insta/WhatsApp-Prinzip), **immer sichtbar**, alle Plattformen.
- 5 Slots: `Start · P&P · [Hulk Hikes = Center-Hero] · News · Brands`. Berg **bricht aus der Bar aus** (dimensional).
- **Logo = Wortmarke, adaptiver per-Region-Invert** (dunkel auf Vanilla, hell über dunklen Sektionen).
- **Berg-Cursor** (Desktop). **Smashy-Ladescreen** beim Seitenwechsel (einmal, kurz).

## 7. Seiten (alle konsistent im Kit)
- **Startseite** — Cinematic-Hero (Sebi-Portrait) + DNA/Werte + Bibel-Anker + Closing. Aufs Kit heben (Rules-Sprache), Tiefe rein, glossy/glass-Reste raus.
- **Hulk Hikes** (`/touren/`, Flaggschiff) — dunkle Berg-Hero + **Touren-Carousel** (Sebis Karten, swipe-bar) + EditorialIndex der Touren + je Tour später Detailseite (StatRow: km/hm/Gehzeit/Schwierigkeit, Höhenprofil, Karte, Bericht in Sebis Stimme). Ehrlich eingestuft, nachwanderbar.
- **Smash Partner & Picks** (`/partner-picks/`) — dunkle P&P-Hero + EditorialIndex Partner-Codes & Picks (fertig).
- **News** (`/newsletter`) — aufs Kit heben (aktuell veraltet). ⚠️ Endpoint hängt am PEAKING-Worker → vor Release migrieren.
- **Für Brands** (`/kooperationen.html`) — glossy/glass-Panels aufs editoriale Kit heben.
- **Legal** — schlicht, Kit-konform.

## 8. Constraints
- Static HTML/CSS/JS, GitHub Pages, kein Build-Tool (Ausnahme: Touren-Generator intern).
- **DSGVO:** alles self-hosted (Fonts, Libs, Tiles), keine externen Embeds/CDNs.
- **Performance:** Landing < 150 kB JS / < 30 kB CSS, Bilder mit Dimensionen + WebP/AVIF, compositor-friendly Motion.
- **a11y:** semantisch, Tastatur, Kontrast AA, Reduced-Motion, keine Overflows (375px sauber).

## 9. Deliverable vom Design
Ein **kohärentes v3-Design-System** + Pro-Mockups der 3 Schlüsselseiten: **Startseite · Hulk Hikes · Partner & Picks** — im Light-Editorial-Look mit dimensionalem Forest-Gradient, Kit-Bausteinen, Berg-Motiv. So gut, dass es in einem echten Produkt-Screenshot glaubwürdig wäre.
