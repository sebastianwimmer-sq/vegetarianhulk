# Design-Import History — vegetarianhulk

Tracking welche Claude-Design-Outputs wann integriert wurden.

## Format

| Datum | Component/Section | Source-File | Commit | Notes |
|-------|-------------------|-------------|--------|-------|
| YYYY-MM-DD | [Name] | [zip-filename] | [hash] | [opt] |

---

## History

| 2026-05-26 | Sprint v31.3 Newsletter Cinematic Funnel | 2026-05-26-newsletter-cinematic-v31.3-claude-design.zip | (pending merge) | Full React→Vanilla rewrite (~350KB→48KB). 4 Sections: Hero+Form / Habits (Hand-drawn vs Geometric Toggle) / Anti-Hype Statements / Form-Repeat+Galater 6,4. Glass-Topbar V29 port, Sticky-CTA-Mobile mit LS-Cross-Page-Sync, Brevo-Worker-POST + 503-mailto-Fallback. Default-Variant: variant-hand (Editorial). |
| 2026-05-25 | Sprint v30 Homepage Redesign (Code-First) | — code-only, no ZIP | 9f2bb1e → d6183e2 | Editorial Redesign in 6 Steps: Hero Cinematic + Identity-Glass-Card / Bibel-Anchor Sprüche 24:16 (eigene Section) / Lead-Preview 3 Teaser-Tiles / Sticky-CTA Mobile mit localStorage-Gate / Polish A+B+C (Nav + Werte-Magazine + Form-Premium) / Cleanup ~143 Z. Dead-CSS. Direction: Arda-Cinematic + VH-Soul. |
| 2026-05-20 | Command Cockpit v2 Phase A | 2026-05-20-command-v2-phase-a-claude-design.zip | — | 2 Varianten (Editorial-Heavy + Builder-Heavy), Combine: B-Basis + A's Editorial Header |

---

## Workflow-Reminder

Bei jedem Claude-Design-Import:
1. ZIP von `~/Downloads/` nach `design-archives/[date]-[component]-claude-design.zip`
2. Diese Datei mit neuer Zeile updaten
3. Brain-Note mit Tag `design:archive` + `project:vh` anlegen
4. Commit + Push
