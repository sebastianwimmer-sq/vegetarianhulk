# VH Design-Kodex v3 — „Forest Luxury Editorial"

**Stand 10.07.2026 · verbindlich für alle Seiten ab v3.**
Referenz-Implementierung: `design/prototypes/home-v3.html` (Sebi-abgenommen).
Spec-Quelle: Sebis GPT-Mockups (10.07.) + s2s-Hintergrund-Technik.

## Die zwei Farbfamilien (fix)

| Forest Luxury (dunkle Welt) | Hex | Warm Editorial (helle Welt) | Hex |
|---|---|---|---|
| Mint Whisper | `#D1F2EB` | Warm Alabaster | `#E9E0CF` |
| Emerald Green | `#50C878` | Antique Gold | `#BA9B5F` |
| Royal | `#0B6E4F` | Sage Green | `#5E775E` |
| Dark Evergreen | `#013220` | Dark Forest | `#132B23` |

Arbeits-Töne: Seiten-Grund `--cream #F2EAD7` · Karten-Creme `#F5EEDE` ·
Papier-Text auf dunkel `#F3EBD9` · Leaf-Akzent `#7ED09B` · Meta-Grün `#9BD9B4`.

## Regel 1 — Zwei Flächen, keine dritte
- **Papier**: `#F5EEDE`, Radius 28, `--shadow-paper`.
- **Wald**: immer derselbe Verlauf
  `radial(Leaf-Bloom 82% -8%) + linear-gradient(165deg, #1C4A30 → #123524 55% → #0E2C1D)` + Grain-Overlay,
  Radius 28, `--shadow-forest`. (Hero darf den Foto-Blend-Verlauf nutzen, Bibel-Anker den Boden-Bloom — Basis bleibt identisch.)

## Regel 2 — Farb-Rollen je Fläche (2 Textfarben + 1 Akzent)
- Auf **Wald**: Papier-Text · Akzent `Leaf #7ED09B` (Italic, Signaturen, aktive Zustände). Mint nur für Mono-Labels.
- Auf **Papier**: Forest-Text `#132B23` · Akzent `Royal #0B6E4F`. Gold **nur** für Mono-Nummern/-Labels.

## Regel 3 — Drei Typo-Rollen
- **Playfair Display** = Display: Namen, Headlines, Zitate. Italic = Betonung, immer in Akzentfarbe.
- **Inter** = Body.
- **Mono** (`ui-monospace`) = Labels, Meta, Zahlen, Legal — immer uppercase + letterspaced, in Akzent-/Labelfarbe.

## Regel 4 — Zwei Radien: Karten 28px · Controls 14px. Keine asymmetrischen Ecken.

## Regel 5 — Zwei Schatten (Tokens)
```css
--shadow-forest: 0 26px 60px -28px rgba(4,32,19,0.62);
--shadow-paper:  0 16px 40px -24px rgba(19,43,35,0.28);
```

## Regel 6 — Hintergrund = Raumlicht (s2s-Technik)
EINE fixe Verlaufs-Fläche (`.bg`, `position:fixed`), Farben laufen über Sage-Zwischentöne
in die Creme aus — nie transluzente Farbe direkt über Creme (wirkt wie Overlay/Nebel).
5 Radials: Gold-Licht oben rechts · Forest-Ecke oben links · Wald rechts-mitte ·
grüne Aura links-unten · Evergreen-Boden. Drift 85s (nur `transform`), reduced-motion aus.
Content scrollt über das Licht.

## Regel 7 — Drei Signatur-Elemente, sparsam
1. **Scribble-Strich** (handgezogen, Emerald) — max. 1× pro Seite, unter der Kern-Aussage.
2. **Wordmark-Invert** — Wordmark sticky, kippt per clip-path auf Papier/Leaf über dunklen Flächen (`[data-dark]`).
3. **Berg bricht aus der Nav** — Center-Slot Hulk Hikes.

## Regel 8 — Layout
- Bento erlaubt: Karten ungleicher Größe, aber Gap immer 14px, Sektionsabstand 72px (Desktop 96px).
- Rotationen verboten. Overlap nur Foto→Karte (Hero).
- Container: mobil `min(100%-36px, 560px)` · Desktop `min(100%-64px, 1060px)`.

## Nav (fix)
Dunkle Evergreen-Pille, Radius 16, Emerald-Glow-Schein, Icons Papier 66%,
aktiv = Mint + Emerald-Punkt, Berg bricht oben aus. Immer sichtbar, bottom 18px.

## Anti-Slop-Wächter (aus learning_anti_ki_slop_websites_2026)
Kein uniformes Karten-Grid · keine Buzzword-Copy · Spezifität („4:50 Uhr, Bibel, Gym")
· Serif↔Mono-Pairing · Grain/Textur · ein klarer POV.
