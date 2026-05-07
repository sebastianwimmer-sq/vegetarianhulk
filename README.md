# vegetarianhulk.de

> Sebi's Founder-Site. Impressum + Über mich + Kooperationen für [@vegetarianhulk](https://instagram.com/vegetarianhulk).

**Live:** https://vegetarianhulk.de · https://vegetarianhulk.info (301) · https://vegetarianhulk.online (301)

Part of the **SMASH Universe** (siehe [smashtheapp.de](https://smashtheapp.de)).

---

## Stack

- **Static HTML/CSS** — vanilla, kein Build, keine Dependencies
- **Hosting:** GitHub Pages (kostenlos)
- **Domain:** vegetarianhulk.de bei united-domains
- **Font:** Inter via Google Fonts
- **Tracking:** Keins. Keine Cookies. Keine Analytics. Sauber.

## Files

```
vegetarianhulk/
├── index.html        — Hero + Über mich + Was ich baue + Kooperationen + Footer
├── impressum.html    — TMG §5 (Anbieterkennzeichnung)
├── datenschutz.html  — DSGVO-Datenschutzerklärung
├── style.css         — Shared CSS (warmer Hulk-Style)
├── CNAME             — Custom Domain für GitHub Pages
└── README.md         — Diese Datei
```

## Content-Updates

**Impressum:**
- Pflicht-Daten in `impressum.html` einsetzen wo `[PLACEHOLDER]` steht
  - Vor- und Zuname
  - Anschrift (kein Postfach!)
  - Telefon (empfohlen, EuGH-Rechtsprechung)
  - USt-IdNr. wenn vorhanden, sonst Block löschen
- Mail aktuell: `info@smashtheapp.de`. Kann später auf `info@vegetarianhulk.de` getauscht werden.

**Hero-Foto:**
- Aktuell Placeholder
- Sebi legt eigenes Selfie als `hero.jpg` (96×96 px Kreis) ins Repo
- In `index.html` `<div class="hero-photo-placeholder">FOTO</div>` ersetzen durch `<img src="hero.jpg" alt="Sebi" class="hero-photo">`

**Kooperations-Pills:**
- In `index.html` Section 03 — `.coop-pills` direkt editieren

## DNS Setup (one-time)

### vegetarianhulk.de (Haupt-Domain)
A-Records auf GitHub Pages IPs:
```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```
+ CNAME `www` → `sebastianwimmer-sq.github.io`

### vegetarianhulk.info + vegetarianhulk.online (Redirects)
Bei udag → "Domain-Forwarding" → 301-Redirect zu `https://vegetarianhulk.de`.

## GitHub Pages Activation

```bash
gh api -X POST repos/sebastianwimmer-sq/vegetarianhulk/pages -F "source[branch]=main" -F "source[path]=/"
gh api -X PUT repos/sebastianwimmer-sq/vegetarianhulk/pages -F "cname=vegetarianhulk.de" -F "https_enforced=true"
```

## Cross-References

- Marketing-Plan: Memory `project_smash_vegetarianhulk_marketing.md`
- Brand-Konsistenz: Memory `project_smash_brand.md`, BRAND.md in life-tracker
- Email-Setup: Memory `project_smash_universe_email_setup.md`

---

© 2026 Sebi · vegetarianhulk.de
