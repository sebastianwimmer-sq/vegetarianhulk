# vegetarianhulk.de

Personal Brand Website von Sebi (@vegetarianhulk) — vegetarischer Fitness-Lifestyle.

## Stack

- **Frontend:** Static HTML/CSS/JS (kein Build-Tool)
- **React Pages:** lieblingsprodukte.html, newsletter/index.html (React via CDN)
- **Hosting:** GitHub Pages (vegetarianhulk.de via CNAME)
- **Newsletter:** Brevo via Cloudflare Worker (peaking-ai-api.peaking.workers.dev)
- **Admin:** /admin/lieblingsprodukte/ (localStorage-basiert)

## Brand

- **Farben:** Forest Green #2d6a3e, Warm Vanilla #f7efde, Beige #efe5cf
- **Fonts:** Playfair Display (Display), Inter (Body)
- **Tone:** Authentisch, diszipliniert, gläubig, kein Coaching-Sprech
- **Tagline:** "Disziplin ist kein Talent. Sie ist ein Ritual."

## Design-Workflow (Claude Design Integration)

### Das Triangle: Design <-> Chat <-> Code

Sebastian arbeitet mit 3 Claude-Instanzen für Design-Tasks:
- **Claude Design** (Anthropic-App): Produziert Design-Systeme + Mockups
- **Chat-Claude** (mobile): Strukturiert Briefs + koordiniert
- **Claude Code** (ich): Reviewed Design-Output + implementiert

### Standard-Flow für neue Design-Tasks

1. **Pre-Design-Check** (Sebastian -> Code): Code prüft ob Component existiert, welche Constraints
2. **Brief-Refinement** (Sebastian -> Chat-Claude): Chat-Claude formuliert sauberen Design-Brief
3. **Design-Phase** (Sebastian -> Claude Design): Briefing absetzen, Mockups/Specs zurück
4. **Implementation** (Sebastian -> Code): Code reviewed + implementiert + Pre-Live-Test

### Wann Pre-Design-Check Pflicht ist

- Neues Component (Card, Button, Form, etc.)
- Neue Page-Section
- Redesign existierender Component
- Cross-Component-Patterns (Modals, Toasts)

### Wann Pre-Design-Check optional

- Reine Copy-Änderungen
- Farb-Tweaks (Token-Update)
- Spacing-Fixes

### Pre-Design-Check Format

Sebastian schickt vor Design-Task:

> Pre-Design-Check: [Component-Name]
> Was geplant: [kurze Beschreibung]

Ich antworte mit:
1. Existiert Component schon? Wo?
2. Welche technischen Constraints?
3. Welche States müssen mit-designed werden?
4. Mobile-Breakpoints / Container-Sizes?
5. Ähnliche Patterns für Konsistenz?

### Brain als Single-Source-of-Truth

- Vor jedem Pre-Design-Check: Brain-Note `design:inventory + project:vh` lesen
- Nach Implementation: Component-Inventar im Brain updaten
- Templates im Brain: "Pre-Design-Check Template" + "Design-Brief Refinement Template"

## Available Design Skills

Global installiert (~/.claude/skills/), automatisch verfügbar:
- **Impeccable** — Anti-AI-Slop Quality-Check (`/impeccable audit`, `/impeccable critique`, `/impeccable polish`)
- **UI/UX Pro Max** — Design-System-Generator + UX-Guidelines (`/ui-ux-pro-max`)

Brand-Tokens VH: Forest-Green Editorial, Playfair+Inter Typography, Warm Vanilla Surfaces

## Brain Integration

Vor groesseren Tasks: Second Brain konsultieren via MCP-Tool.
Tags: `project:vh`, `design:inventory`, `design:system`
