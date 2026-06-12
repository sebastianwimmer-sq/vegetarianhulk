/* ============================================================
   vegetarianhulk.de/codes — Partner-Daten
   Neuen Partner: Objekt unten anhängen. Partner pausieren:
   active: false setzen (bleibt in den Daten, wird nicht gerendert).

   Felder:
     name           Pflicht — Anzeigename
     slug           Pflicht — URL-Slug für die Interstitial-Seite
                    /go/<slug>/ (CTA auf /codes zeigt dorthin).
                    ⚠️ Beim Ändern von slug/shopUrl/fallbackUrl auch
                    die statischen Fallbacks in go/<slug>/index.html
                    syncen (meta refresh + Link-hrefs).
     logo           Optional — Pfad zu Logo-Bild (z.B. "/codes/img/brand.png").
                    Leer/weggelassen = Monogramm aus dem ersten Buchstaben.
     code           Pflicht — Rabattcode (Copy-to-Clipboard)
     discount       Optional — z.B. "10%" (wird als Badge "–10%" gerendert)
     category       Optional — Kategorie-Tag unter dem Namen
                    (z.B. "Supplements"). Noch keine Filter-UI —
                    Filter kommt erst ab mehr Partnern.
     isNew          Optional — true = dezentes "Neu"-Badge oben an
                    der Card. Zum Abschalten: false setzen/entfernen.
     valueLine      Pflicht — 1 Satz: warum dieser Partner
     hint           Optional — Hinweis-Box über dem CTA: { lead, text }.
                    lead wird fett gerendert (z.B. "Wichtig:" / "Easy:").
     shopUrl        Pflicht — Affiliate-URL (Redirect-Ziel von /go/<slug>/)
     fallbackUrl    Pflicht — generische Shop-Domain als Fallback,
                    falls der Affiliate-Link defekt ist. Wird auch vom
                    Link-Check-Workflow als erwartete Ziel-Domain genutzt.
     finePrintExtra Optional — Zusatzsatz hinter dem Affiliate-Fineprint
                    (z.B. Sale-Ausnahmen)
     active         Pflicht — false = nicht rendern

   Compliance Nature Heart: KEINE Health Claims in valueLine/hint
   ("unterstützt Immunsystem", "hilft bei ..." etc. sind verboten).
   Nur produktneutral: Qualität, Laborprüfung, Made in Germany, Routine.
   ============================================================ */
const VH_PARTNERS = [
  {
    name: "Nature Heart",
    slug: "nature-heart",
    logo: "",
    code: "VEGETARIANHULK",
    discount: "10%",
    category: "Supplements",
    valueLine: "Laborgeprüfte Nahrungsergänzung, Made in Germany — fester Teil meiner täglichen Routine.",
    hint: {
      lead: "Wichtig:",
      text: "Der Link allein gibt keinen Rabatt — Code VEGETARIANHULK im Warenkorb eingeben."
    },
    shopUrl: "https://nature-heart.de/sebastian11377224",
    fallbackUrl: "https://nature-heart.de",
    active: true
  },
  {
    name: "Alpin Loacker",
    slug: "alpin-loacker",
    logo: "",
    code: "VEGETARIANHULK",
    discount: "15%",
    category: "Outdoor-Gear",
    isNew: true,
    valueLine: "Familienbetrieb aus den Alpen seit 1993 — Merino, Wanderstöcke, Schlafsäcke & Ultraleicht-Gear für meine Bergtouren.",
    hint: {
      lead: "Easy:",
      text: "Der Rabatt wird beim Klick auf den Link automatisch angewendet."
    },
    shopUrl: "https://alpinloacker.com/sebastian-wimmer",
    fallbackUrl: "https://alpinloacker.com",
    finePrintExtra: "Während großer Sale-Aktionen gilt 5 % statt 15 %.",
    active: true
  }
];
