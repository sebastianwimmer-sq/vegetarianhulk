# vegetarianhulk Design System

> **Tagline:** „Disziplin ist kein Talent. Sie ist ein Ritual."
> **Brand:** vegetarianhulk — Sebi's öffentliche Personal-Brand
> **Domain:** vegetarianhulk.de · **Insta:** @vegetarianhulk
> **Persona:** 25 J · Bayern · Christ · Veggie seit 2016 · Macher

Light-mode, magazine-warm design system for the **vegetarianhulk** personal brand site. Forest-Hulk + Vanille-Beige — a deliberate counterweight to the SMASH PWA's dark-mode neon. Playfair Display + Inter, Apple-easing motion, aurora-light gradients, prefers-reduced-motion respect.

> ⚠️ **Not SMASH.** SMASH is the product (`#00ff6a` Hulk Green, dark mode, Inter only). vegetarianhulk is the person behind it (`#2d6a3e` Forest, light mode, Playfair + Inter). Cross-link freely but keep the visuals separate.

---

## Index

| File | What it is |
|---|---|
| `README.md` | This file — brand foundation, voice, visual rules |
| `colors_and_type.css` | CSS custom properties — tokens + semantic presets |
| `preview/*.html` | Design-system cards — colors, type, components |
| `Hero.html` | Reference hero page for vegetarianhulk.de |
| `index.html` | Walkthrough of the system + link to all previews |

---

## Brand foundation

### Voice
- **1st-person raw, vulnerable, emotional warm.** Sebi schreibt wie ein Freund am Tisch, nicht wie ein Coach am Mikro.
- **Anti-Coach-Bro.** Keine „Grindset" / „you got this" / „hustle culture" Phrasen. Nie.
- **Bibel-Anker als konkreter Tagesanker** — Verse als Ritual-Trigger, nicht generischer Schmuck. Ein Vers gehört zu einem Tag, einer Frage, einem Moment.
- **Plant-Based + Stark** als gelebter Beweis seit 2016. Nicht missionarisch, nicht militant — einfach gemacht.

### Tone Dials
- Persönlich > performativ
- Konkret > abstrakt („66 Tage Gebet" statt „spirituelle Praxis")
- Bayerisch-direkt > Marketing-glatt
- Stille > Hype

### Verbotene Phrasen
- ❌ „You got this." / „Let's go!" / „Smash it." / „Crush it."
- ❌ „Grindset" / „No excuses" / „Sleep is for the weak"
- ❌ „Authentic journey" / „Manifest your reality"
- ❌ „Werde dein bestes Self" (German paraphrase of the SMASH tagline — that line belongs to the app, only in English, only with period.)

### Erlaubte Phrasen (Beispiele)
- ✅ „Mach hin." (geliehen von SMASH — Sebi spricht denselben Ton)
- ✅ „Disziplin ist kein Talent. Sie ist ein Ritual."
- ✅ „Tag 1.247 · Plant-Based"
- ✅ „Ich bete morgens um 5:42. Nicht weil ich heilig bin."

---

## Visual foundations

### Palette
| Token | Hex | Use |
|---|---|---|
| `--forest-1` | `#2d6a3e` | Primary forest — links, CTAs, accents |
| `--forest-2` | `#1f4d2c` | Deeper forest — gradient end, hover |
| `--forest-3` | `#3d8a52` | Aurora light tint |
| `--vanilla`  | `#f7efde` | App canvas, warm vanilla beige |
| `--beige-1`  | `#efe5cf` | Card / surface |
| `--beige-2`  | `#e6d9bd` | Hover / elevated surface |
| `--earth`    | `#cfbf9d` | Hairline border, warm brown |
| `--ink`      | `#1a1410` | Primary text — warm near-black |

**Rule:** never Smash-Hulk `#00ff6a` on this brand. Forest only.

### Type
- **Inter** (Body) — UI, Buttons, Eyebrows, Captions. Weights 400/500/600/700/800/900.
- **Playfair Display** (Display) — H1, H2, Hero headlines, **Bibelverse** (always italic 400). Weights 400–700, italic 400.

**Casing.**
- Display headlines: sentence case with optional italic accent words — Playfair shines in italic.
- Eyebrow labels: `UPPERCASE`, 1.6px letter-spacing, forest color.
- Buttons: `UPPERCASE`, 1.5px letter-spacing.

### Spacing & Radii
- Mobile rhythm: 4 / 8 / 12 / 16 / 20 / 24
- Section rhythm: 56 / 80 / 120
- Cards 20px · Buttons 12px · Image 24px · Pill 999px

### Animation philosophy
- **Apple-easing** `cubic-bezier(0.16, 1, 0.3, 1)` — the only easing curve. Everything else feels wrong.
- **Aurora background** — slow, layered forest-light radial gradients drifting on the hero. ~14s loop. Subtle.
- **3D-Float hero** — gentle Y/rotateX float on the headline (max 4px / 0.5deg). Subtle = good.
- **prefers-reduced-motion: reduce** kills aurora + float, keeps content static. No exceptions.
- Transitions 220–420ms. No bounces, no springs, no parallax scroll, no scroll-jacking.

### Imagery vibe
- Real photos of Sebi: in nature, in the gym, with food. Warm tones, never blown-out.
- When there's no photo: **vanilla card with a forest verse**, or a phone mockup of SMASH.
- No illustrations, no stock photos, no AI imagery.

---

## Component catalogue (stubs)

See `preview/` for full cards. The starter components:

- **Button** — Primary (forest fill, vanilla text), Ghost (earth border, ink text), Link (forest underline on hover).
- **Card** — Vanilla canvas → beige-1 surface → beige-2 hover. Border `--earth`. Optional ribbon eyebrow.
- **Verse card** — Playfair italic verse, forest attribution line, vanilla background, hairline border.
- **Nav** — sticky top bar, vanilla blur, forest underline on active.
- **Day-stamp** — `TAG 1.247 · PLANT-BASED` chip, monospace number, forest text.
- **Section header** — Eyebrow + display headline + body paragraph, left-aligned editorial.

---

## Caveats

- **Fonts** loaded from Google Fonts. For offline use, fork to local `.woff2`.
- **No icon set** — same rule as SMASH. Use emoji for category markers (🌱 🙏 🏋️ 📖 🍞 🥬) sparingly; use unicode glyphs (→ · ✱) for affordances.
- This is a **personal brand** surface, not a product surface. Marketing-first; no PWA chrome here.
