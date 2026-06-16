/* ============================================================
   vegetarianhulk.de/lieblingsprodukte — Produkt-Daten
   Neues Produkt: Objekt unten anhängen. Produkt pausieren:
   active: false setzen (bleibt in den Daten, wird nicht gerendert).

   Felder:
     name        Pflicht — Anzeigename
     kategorie   Pflicht — Gruppen-Label (z.B. "Womit ich filme").
                 Bewusst frei, damit später auch Nicht-Creator-Produkte
                 (Berg/Gear, Alltag) eigene Kategorien bekommen können.
     text        Pflicht — 1 Satz O-Ton, warum DIESES Gerät. Kein
                 Katalog-Sprech, kein Health-Claim.
     url         Pflicht — finaler Affiliate-Link.
                 ⚠️ Tag-Pflicht: muss tag=vegetarianhul-21 tragen.
                 "PENDING_SITESTRIPE_<ASIN>" = Platzhalter, noch NICHT live —
                 die Seite rendert solche Karten als "Link folgt" (nicht klickbar).
     preisHinweis Optional — kurzer Preis-/Spar-Kontext
     bild        Optional — Pfad zu Produktbild (reservierte Größe → kein CLS).
                 Leer = Monogramm-Platzhalter.
     active      Pflicht — false = nicht rendern

   ── KANAL-REGEL (verbindlich) ───────────────────────────────
   Produkte, die es bei Nature Heart ODER Alpin Loacker gibt, werden
   AUSSCHLIESSLICH über deren Affiliate-Link/Code verlinkt (siehe
   /codes) — NIEMALS über Amazon. Amazon nur für Produkte, die WEDER
   NH NOCH AL führen. Die aktuellen 4 Geräte sind reines Creator-Gear,
   kein Konflikt. Bei neuem Produkt zuerst NH/AL-Sortiment prüfen.

   ── Amazon-Tag-Status (LIVE) ──
   Alle 4 url tragen die verifizierten SiteStripe-Links mit
   tag=vegetarianhul-21 (+ linkCode/linkId/ref_). Neue Amazon-Produkte
   immer mit eigener SiteStripe-URL inkl. Tag eintragen — nie ohne Tag.
   ============================================================ */
const VH_AMAZON_TAG = "vegetarianhul-21";

const VH_PRODUCTS = [
  {
    name: "DJI Neo 2 Fly More Combo",
    kategorie: "Womit ich filme",
    text: "Für die Drohnenshots über den Gipfeln — startet von der Hand, brauch kein Stativ am Berg.",
    url: "https://www.amazon.de/dp/B0FJ1F5QZM?th=1&linkCode=ll2&tag=vegetarianhul-21&linkId=a138653a571471b0275264da9a5a8428&ref_=as_li_ss_tl",
    bild: "",
    active: true
  },
  {
    name: "DJI Mic Mini",
    kategorie: "Womit ich filme",
    text: "Mein Ton bei jedem Talking-Head — clippt man dran und vergisst es.",
    url: "https://www.amazon.de/dp/B0DDL8WGH5?th=1&linkCode=ll2&tag=vegetarianhul-21&linkId=8d4636d5aacb5d851793087d5df6b729&ref_=as_li_ss_tl",
    bild: "",
    active: true
  },
  {
    name: "Insta360 Flow 2 Plus",
    kategorie: "Womit ich filme",
    text: "Der Gimbal für die Wander-Vlogs — KI-Tracking läuft mit, wenn ich allein unterwegs bin.",
    url: "https://www.amazon.de/dp/B0F6CBMRBH?th=1&linkCode=ll2&tag=vegetarianhul-21&linkId=50fde7fd02631ca3bb2eab5034fb7539&ref_=as_li_ss_tl",
    bild: "",
    active: true
  },
  {
    name: "Apple MacBook Air 13\" M4",
    kategorie: "Womit ich filme",
    text: "Schneidet alle meine Reels — lautlos und den ganzen Tag ohne Steckdose.",
    url: "https://www.amazon.de/dp/B0DZDFWPDP?th=1&linkCode=ll2&tag=vegetarianhul-21&linkId=56a0390f5dcab742bc125eaea31387ae&ref_=as_li_ss_tl",
    bild: "",
    active: true
  }
];
