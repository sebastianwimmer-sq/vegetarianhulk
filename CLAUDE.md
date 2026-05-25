# vegetarianhulk.de

Personal Brand Website von Sebi (@vegetarianhulk) — vegetarischer Fitness-Lifestyle.

## Stack

- **Frontend:** Static HTML/CSS/JS (kein Build-Tool)
- **React Pages:** newsletter/index.html (React+Babel via CDN — Performance-Schuld, eigener Sprint)
- **Hosting:** GitHub Pages (vegetarianhulk.de via CNAME)
- **Newsletter:** Brevo via Cloudflare Worker (peaking-ai-api.peaking.workers.dev)
- **Admin:** /admin/lieblingsprodukte/ (localStorage-basiert, verwaltet archivierte Lieblingsprodukte-Daten — Public-Page in /archive/ seit Sprint 23.05.)

## Brand

- **Farben:** Forest Green #2d6a3e, Warm Vanilla #f7efde, Beige #efe5cf
- **Fonts:** Playfair Display (Display), Inter (Body)
- **Tone:** Authentisch, diszipliniert, gläubig, kein Coaching-Sprech
- **Tagline:** "Disziplin ist kein Talent. Sie ist ein Ritual."
- **Anker-Vers:** Sprüche 24,16 (Schlachter 2000) — DER VH-Vers über alle Pages.

## Brand-Token-Naming (v30+)

Neue Komponenten ab Sprint v30 nutzen Future-Naming, parallel zu Legacy:

| Future (v30+) | Legacy | Wert |
|---|---|---|
| `--vanilla` | `--bg` | #f7efde |
| `--beige-1` | `--surface` | #efe5cf |
| `--earth` | `--border` | #cfbf9d |
| `--ink` | `--text` | #1a1410 |
| `--ink-2` | `--text2` | #5c513f (WCAG-AA-safe für small text) |
| `--ink-3` | `--text3` | #9a8c75 (nur für large-text decorative) |
| `--forest-1` | `--green1` | #2d6a3e |
| `--forest-2` | `--green2` | #1f4d2c |
| `--forest-deep` | `--green-deep` | #1a3d28 |
| `--forest-wash` | — (neu) | rgba(45,106,62,0.06) |

Beide Namen sind in `:root` als Aliase definiert. Legacy bleibt für ältere Components, Future für neue.

## Design-Workflow (Claude Design Integration)

### Das Triangle: Design <-> Chat <-> Code

Sebastian arbeitet mit 3 Claude-Instanzen für Design-Tasks:
- **Claude Design** (Anthropic-App): Produziert Design-Systeme + Mockups
- **Chat-Claude** (mobile): Strukturiert Briefs + koordiniert
- **Claude Code** (ich): Reviewed Design-Output + implementiert

### Standard-Flow für Design-Tasks (4 Phasen)

**Phase 1 — PLAN:**
1. Pre-Design-Check (Sebastian -> Code): Code prüft ob Component existiert, welche Constraints
2. Brief-Refinement (Sebastian -> Chat-Claude): Chat-Claude formuliert sauberen Design-Brief

**Phase 2 — DESIGN:**
3. Sebastian -> Claude Design: Brief absetzen
4. Claude Design -> ZIP in ~/Downloads

**Phase 3 — BRIDGE:**
5. Sebastian -> Code: "ZIP [filename] fuer [component] — Pre-Review bitte"
6. Code: Pre-Review-Report (siehe Format unten)
7. Sebastian: "Go" oder Anpassungs-Request

**Phase 4 — IMPLEMENTATION + ARCHIVE:**
8. Code: feature-Branch, Implementation, Tests
9. Code: ZIP archivieren + design-history.md updaten + Brain-Note
10. Sebastian: Review + Merge auf main

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

### Pre-Review-Report-Format

Wenn Sebastian sagt "ZIP XY fuer Component Z liegt in Downloads":

```
PRE-REVIEW: [Component-Name]
File: [filename]
Variants found: [1 / 2 / 3]

WAS GUT IST:
- [Punkt mit Begruendung]

WAS PROBLEMATISCH IST:
- [Punkt: z.B. "Nutzt Tailwind, wir haben Vanilla CSS"]

PASSENDSTE VARIANTE: [A / B / C oder Combine]

EMPFOHLENE ANPASSUNGEN:
1. [Anpassung mit Tech-Grund]

INTEGRATION-PLAN:
1. Target-File(s): [path/to/file]
2. Geschaetzter Aufwand: [Zeit]
3. Bestehende Pattern-Konsistenz: [check]

-> Soll ich umsetzen wie beschrieben, oder Anpassungen?
```

### Archive-Workflow (nach Implementation)

```bash
# ZIP aus Downloads holen
mv ~/Downloads/[filename].zip \
   design-archives/$(date +%Y-%m-%d)-[component]-claude-design.zip

# design-history.md updaten (neue Zeile)
# Brain-Note mit Tag design:archive + project:vh anlegen
# Commit + Push
```

**Was NICHT mehr passieren soll:**
- ZIPs am Session-Ende einfach loeschen
- "War das Live oder Prototyp?" Verwirrung
- Doppel-Design weil vergessen wurde was schon integriert wurde

### Archive-Policy: Versionierung

Claude Design exportiert oft iterativ (V1, V2, ... Vn). Jede neue Version ist meist Superset.

**Policy:**
- Nur die **hoechste Versionsnummer** archivieren
- Intermediate Versionen direkt loeschen
- Datei umbenennen: `YYYY-MM-DD-[component]-v[N].zip`
- Initial/Foundation-Version (V0) separat archivieren wenn historisch relevant

**Anti-Pattern:** Alle V1-V8 archivieren (= Muell-Hoarding).

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
