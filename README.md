# vegetarianhulk.de

> Sebi's Founder-Site. **Lead-Funnel + Media-Kit** für [@vegetarianhulk](https://instagram.com/vegetarianhulk).

**Live:** https://vegetarianhulk.de · https://vegetarianhulk.info (301) · https://vegetarianhulk.online (301)

Part of the **SMASH Universe** (siehe [smashtheapp.de](https://smashtheapp.de)).

---

## Stack

- **Static HTML/CSS** — vanilla, kein Build, keine Dependencies
- **Hosting:** GitHub Pages (kostenlos)
- **Domain:** vegetarianhulk.de bei united-domains
- **Font:** Inter via Google Fonts
- **Tracking:** Keins. Keine Cookies. Keine Analytics. Sauber.
- **Lead-Magnet:** mailto-Fallback (MVP), Brevo-Upgrade dokumentiert

## Files

```
vegetarianhulk/
├── index.html             — User-Funnel: Hero + Trust-Bar + Lead-Magnet + SMASH-Card + Brand-Bridge
├── kooperationen.html     — Brand-Funnel: Reichweite + Audience + Pillars + Brand-Fit + CTA
├── impressum.html         — TMG §5 (Anbieterkennzeichnung)
├── datenschutz.html       — DSGVO-Datenschutzerklärung
├── style.css              — Shared CSS (warmer Hulk-Style + V2-Components)
├── CNAME                  — Custom Domain für GitHub Pages
└── README.md              — Diese Datei
```

## Architektur — 3-Layer Lead-Funnel

| Layer | Page | Wer? | Was tun? |
|---|---|---|---|
| **L1 Bio-Anker** | `index.html` Hero + Trust-Bar | Insta-User der erste Kontakt hat | Identity erfassen, weiter zu Lead-Magnet |
| **L2 Lead-Magnet** | `index.html` "3-Tage-Reset" | Engagierte User | Email abgeben → 3-Mail-Sequence |
| **L3 Media-Kit** | `kooperationen.html` | Brand-Vertreter, Marken | Reichweite checken → Mailto |

---

## Sebi-Action-Items (Reihenfolge nach Priorität)

### 1. ⭐ Hero-Foto rein (`hero.jpg`)

**Anleitung:**

```
1. Such ein gutes Selfie aus (frontal, freundlicher Ausdruck, scharf)
2. Crop quadratisch, mind. 400×400 px (1:1)
3. Speicher als hero.jpg
4. Im Finder zu /Users/sebastianwimmer/vegetarianhulk/ ziehen
5. Im Terminal:
   cd ~/vegetarianhulk
   git add hero.jpg
   git commit -m "Add hero photo"
   git push
```

**Was passiert:** Die Site lädt automatisch `hero.jpg` wenn vorhanden. Wenn nicht da → fallback "FOTO kommt"-Box. Du musst NIX im HTML ändern.

### 2. ⭐ Impressum-Daten einfüllen

In `impressum.html` alle `[PLACEHOLDER]`-Blöcke ersetzen:
- Vor- und Zuname
- Straße + Hausnummer (kein Postfach!)
- PLZ + Ort
- Telefon (empfohlen, EuGH-Rechtsprechung 2018)
- USt-IdNr. wenn vorhanden, sonst gesamten Block löschen

### 3. ⭐ Reichweite-Stats einfüllen (`kooperationen.html`)

Hol dir aus Instagram-Insights:
- Follower-Count → `[FOLLOWER]`
- Engagement-Rate (letzte 30 Tage) → `[ER%]`
- Ø Reichweite/Post → `[POSTS]`
- Ø Story-Views → `[STORIES]`
- Audience-Demo (Alter, Land, Geschlecht) → alle `[XX]%`-Stellen

**Tipp:** Stats monatlich aktualisieren (1 Termin im Kalender). Datum unten in Section 01 setzen.

### 4. 🟡 (Optional) Brevo-Form einbinden statt mailto

**Aktuell:** Lead-Magnet-Form öffnet User's Mail-App (mailto-Fallback). User schickt Mail an `info@smashtheapp.de`. Sebi liest manuell + reagiert.

**Upgrade:** Brevo-Subscription-Form für sauberen Auto-Flow.

```
1. Login bei Brevo (du hast schon Account für SMASH)
2. Contacts → Forms → Create Form → "Subscription Form"
3. Liste anlegen: "vegetarianhulk-discipline-reset"
4. Form-Embed-Code kopieren ODER nur die Action-URL
5. In index.html Form-Tag updaten:
   <form class="lead-magnet-form" action="[BREVO-FORM-URL]" method="POST">
   (Submit-Handler-JS löschen)
6. (Optional) Brevo-Automation: 3-Mail-Drip an neue Subscriber
```

### 5. 🟡 (Optional) `info@vegetarianhulk.de` Email einrichten

Bei udag Catch-All-Forwarding zu info@smashtheapp.de (gleiches Pattern wie smashuniverse.info). Dann in:
- `index.html` Submit-Handler mailto austauschen
- `kooperationen.html` Big-CTA mailto austauschen
- `impressum.html` Mail-Block

---

## Workflow für Updates

```bash
cd ~/vegetarianhulk
# Änderungen machen
git add -A
git commit -m "Was du geändert hast"
git push
# → GitHub Pages auto-deployt in ~1 Min
```

## DNS Setup (one-time, schon erledigt)

### vegetarianhulk.de (Haupt-Domain)
A-Records auf GitHub Pages IPs:
```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```

### vegetarianhulk.info + vegetarianhulk.online (Redirects)
Bei udag → "Domain-Forwarding" → 301-Redirect zu `https://vegetarianhulk.de`.

## GitHub Pages Activation (one-time, schon erledigt)

```bash
gh api -X POST repos/sebastianwimmer-sq/vegetarianhulk/pages -F "source[branch]=main" -F "source[path]=/"
# HTTPS-Enforce nach Cert-Provisioning:
gh api -X PUT repos/sebastianwimmer-sq/vegetarianhulk/pages -F "https_enforced=true"
```

## Cross-References

- Marketing-Plan: Memory `project_smash_vegetarianhulk_marketing.md`
- Site-Setup-Memory: `project_smash_vegetarianhulk_site.md`
- Brand-Konsistenz: Memory `project_smash_brand.md`, BRAND.md in life-tracker
- Email-Setup: Memory `project_smash_universe_email_setup.md`
- Stack-Audit: `project_smash_stack_audit.md`

---

© 2026 Sebi · vegetarianhulk.de
