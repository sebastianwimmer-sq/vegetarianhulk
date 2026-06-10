/* ============================================================
   vegetarianhulk.de/codes — Partner-Daten
   Neuen Partner: Objekt unten anhängen. Partner pausieren:
   active: false setzen (bleibt in den Daten, wird nicht gerendert).

   Felder:
     name      Pflicht — Anzeigename
     logo      Optional — Pfad zu Logo-Bild (z.B. "/codes/img/brand.png").
               Leer/weggelassen = Monogramm aus dem ersten Buchstaben.
     code      Pflicht — Rabattcode (Copy-to-Clipboard)
     discount  Optional — z.B. "10%" (wird als Badge "–10%" gerendert)
     valueLine Pflicht — 1 Satz: warum dieser Partner
     shopUrl   Pflicht — Ziel des CTA (rel="nofollow sponsored")
     active    Pflicht — false = nicht rendern
   ============================================================ */
const VH_PARTNERS = [
  {
    name: "Nature Heart",
    logo: "",
    code: "VEGETARIANHULK",
    discount: "10%",
    valueLine: "Pflanzlich & laborgeprüft — meine Nahrungsergänzung, transparent in den Zutaten.",
    shopUrl: "https://nature-heart.de/",
    active: true
  },
  {
    name: "Alpin Loacker",
    logo: "",
    code: "VEGETARIANHULK",
    discount: "15%",
    valueLine: "Wanderstöcke, Schlafsäcke & Merino — mein Outdoor-Gear am Berg.",
    shopUrl: "https://www.alpinloacker.com/",
    active: false
  }
];
