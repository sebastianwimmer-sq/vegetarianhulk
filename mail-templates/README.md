# vegetarianhulk Mail-Templates

Single-Source-of-Truth aller Brevo-Mails. **NICHT** Drag&Drop-Editor — HTML-Mode (`<>` Symbol).

## Status

| File | Brevo-Slot | Status | Subject |
|---|---|---|---|
| `00-confirmation.html` | Double-Opt-In Template | ✅ ready | Eine Sache noch. |
| `01-day1.html` | Drip Tag 1 (sofort nach Confirm) | ✅ ready | Tag 1 — Architektur statt Willenskraft |
| `02-day2.html` | Drip Tag 2 (+24h) | ✅ ready | Tag 2 — Was passiert wenn du fällst |
| `03-day3.html` | Drip Tag 3 (+48h) | ✅ ready | Tag 3 — Ab heute ist es ein Ritual |

## Brevo-Workflow (1× setup, dann automatisch)

1. **Confirmation (Double-Opt-In):** Brevo → Contacts → List `vegetarianhulk-discipline-reset` → Double-Opt-In aktiv + `00-confirmation.html` als Template
2. **Drip-Automation:** Brevo → Automation → Workflow „Discipline Reset 3-Day"
   - Trigger: Contact joins list
   - Step 1: Send `01-day1.html` (delay 0h)
   - Step 2: Send `02-day2.html` (delay 24h)
   - Step 3: Send `03-day3.html` (delay 48h)

## Design-Constraints (alle Mails)

- **Background:** vanilla-beige `#efe5cf` + white-card `#f7efde`
- **Accent:** Forest-Hulk-Green `#2d6a3e`
- **Typography:** Playfair Display (Headlines) + system-sans (Body)
- **Voice:** Sebi 1st-person raw, emotional warm
- **Gmail-Dark-Mode-Force-Light:** `@media (prefers-color-scheme: dark)` override
- **Outlook-VML:** Hero-Gradient + CTA-Button als VML-Fallback
- **Variables:** `{{ contact.FIRSTNAME | default: 'du' }}`, `{{ confirm_url }}` (nur 00)
- **Footer:** unsubscribe + Impressum-Link (DSGVO)

## HTML-Paste-Workflow

1. Brevo → Email → New Template
2. **Editor wählen:** `Code Your Own` (NICHT Drag&Drop!)
3. Im Code-Editor: gesamten Inhalt der `.html`-Datei einfügen
4. Preview testen (Desktop + Mobile)
5. Save + Activate

## Sebi-TODOs (Mail 1/2/3 V4)

Wenn Sebi „mail 1+2+3 als file" sagt:
- Brand-Foundation am Anfang prompt
- Magazine-Editorial-Style wie `00-confirmation.html`
- Hero v25 als Visual-Reference
- Pull-Quote in der Mitte + Sign-off „Sebi."

Cross-References:
- `~/vegetarianhulk/design/prototypes/15-05/email-confirmation-brevo.html` (Reference-Design)
- Memo: `project_smash_vegetarianhulk_lead_magnet_drafts.md` (3 fertige Mails)
