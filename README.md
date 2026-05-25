# vegetarianhulk.de

> Personal Brand Site von Sebi ([@vegetarianhulk](https://instagram.com/vegetarianhulk)) — Disziplin · Faith · Vegetarisch+Stark · Fitness.

**Live:** [vegetarianhulk.de](https://vegetarianhulk.de) · Mirrors `.info` + `.online` → 301 → `.de`
**Tagline:** „Disziplin ist kein Talent. Sie ist ein Ritual."
**Anker-Vers:** Sprüche 24,16 (Schlachter 2000)

## Stack

- **Static HTML/CSS/JS** (vanilla, kein Build-Tool, keine Dependencies)
- **Ausnahme:** `/newsletter/` = React+Babel via CDN (Tech-Schuld, eigener Refactor-Sprint geplant)
- **Hosting:** GitHub Pages mit CNAME
- **Domain:** vegetarianhulk.de bei united-domains
- **Fonts:** Playfair Display (Display) + Inter (Body) — selbst gehostet via `fonts.css`
- **Newsletter-Backend:** Brevo via Cloudflare Worker `peaking-ai-api.peaking.workers.dev`
- **Tracking:** Kein Page-Tracking, keine Cookies, keine Analytics

## Pages

| Page | Datei | Status |
|---|---|---|
| Homepage | `index.html` | LIVE — Hero + 4 Werte + Bibel-Anker + Lead-Magnet + Brand-Bridge |
| Kooperationen (B2B) | `kooperationen.html` | LIVE — USP + Pakete + Stats + Process + FAQ + Form |
| Newsletter (Signup) | `newsletter/index.html` | LIVE — React/Babel-Page, Brevo-Signup |
| 3-Tage-Reset (Magnet) | `3-tage-reset/index.html` | LIVE — A4-Print-Blatt, `noindex` |
| Danke-Page | `danke.html` | LIVE — Post-Signup Tag-Confirmation |
| Impressum | `impressum.html` | LIVE — TMG §5, KI-Disclosure (EU AI-Act) |
| Datenschutz | `datenschutz.html` | LIVE — DSGVO |
| 404 | `404.html` | LIVE — Brand-konsistent |
| Lieblingsprodukte | `archive/lieblingsprodukte.html` | 🗄️ ARCHIVIERT (23.05.) |

## Funnel-Architektur

```
L1 Bio-Anker          L2 Lead-Magnet        L3 Brand-Anfrage
(Insta-Klick)    →    (3-Tage-Reset)   →    (Kooperationen)
index.html#hero       index.html#mag.       kooperationen.html
```

## Files

```
vegetarianhulk/
├── index.html, kooperationen.html, impressum.html, datenschutz.html
├── 404.html, danke.html
├── style.css                — Shared CSS (72KB, Refactor-Schuld)
├── fonts.css                — Selbst gehostete Fonts
├── newsletter/, newsletter.css, newsletter.js, newsletter-tokens.css
├── 3-tage-reset/            — Lead-Magnet Print-Page
├── mail-templates/          — 4 Brevo HTML-Templates (00-confirmation + 03-day3)
├── admin/                   — Internal Admin (noindex)
├── command/                 — Cockpit (noindex)
├── design/                  — Claude-Design Prototypes (noindex)
├── design-archives/         — Claude-Design ZIPs (versioniert)
├── archive/                 — Deprecated Pages (Lieblingsprodukte ab 23.05.)
├── _preview/                — Internal Previews (noindex)
├── hero.jpg                 — Hero-Foto (240KB, WebP-Optimierung pending)
├── version.json             — Update-Check-Polling (siehe update-check.js)
├── sitemap.xml, robots.txt, CNAME, .nojekyll
└── CLAUDE.md                — AI-Working-Doc (Design-Workflow, Brand-Tokens)
```

## Brand-Tokens

- **Farben:** Forest-Green `#2d6a3e` · Forest-Deep `#1f4d2c` · Vanilla `#f7efde` · Beige `#efe5cf`
- **Fonts:** Playfair Display 400/500/700 (italic-accents) + Inter 400/600/800
- **Tone:** Authentisch, diszipliniert, gläubig, kein Coaching-Sprech

## Workflow

```bash
cd ~/vegetarianhulk
# Änderungen machen
git add -A
git commit -m "feat/fix/docs: was geändert wurde"
git push
# → GitHub Pages auto-deployt in ~1 Min
# → version.json bumpen wenn User-Reload getriggert werden soll
```

## Cross-References

- AI-Working-Doc: [`CLAUDE.md`](./CLAUDE.md)
- Design-Import-History: [`design-history.md`](./design-history.md)
- Brand-Strategy + Marketing: SMASH Memory Index

---

© 2026 Sebi · vegetarianhulk.de
