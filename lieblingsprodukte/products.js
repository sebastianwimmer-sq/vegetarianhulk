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

   ── otonOffen ──
   true = die Zeile ist nur sachlich (was das Ding IST), Sebis eigener Satz
   fehlt noch. `scripts/produkte-check.py` listet sie auf. Nichts erfinden:
   der O-Ton ist die Quelle, nicht der Rohstoff.

   ── Amazon-Tag-Status (LIVE) ──
   Die ersten 4 url tragen die verifizierten SiteStripe-Links mit
   tag=vegetarianhul-21 (+ linkCode/linkId/ref_). Neue Amazon-Produkte
   immer mit eigener SiteStripe-URL inkl. Tag eintragen — nie ohne Tag.
   ============================================================ */
const VH_AMAZON_TAG = "vegetarianhul-21";

/* Kurzform je Kategorie — nur fuer die Filter-Pillen.
   Auf der Karte steht der ganze Satz ("Womit ich am Berg unterwegs bin"),
   weil er sich dort als Satz liest. Als Pille waere er dreizeilig und wuerde
   die Leiste auf dem Handy sprengen. Deshalb hier die Kurzform — und nur
   hier, damit es keinen zweiten Ort gibt, der mitgepflegt werden muss.
   `scripts/produkte-sync.mjs` meldet jede Kategorie ohne Eintrag. */
const VH_KATEGORIE_KURZ = {
  "Womit ich filme": "Filmen",
  "Was ich nehme": "Supplements",
  "Womit ich am Berg unterwegs bin": "Am Berg",
};

/* Englische Seite /en/partner-picks/ (20.10.2026): Kategorie-Saetze und Kurzformen
   auf Englisch. Schluessel bleibt der deutsche Satz, damit es EINE Kategorie gibt.
   Neue Kategorie → hier mitpflegen, sonst steht auf Englisch der deutsche Satz. */
const VH_KATEGORIE_EN = {
  "Womit ich filme": "What I film with",
  "Was ich nehme": "What I take",
  "Womit ich am Berg unterwegs bin": "What I take to the mountains",
};
const VH_KATEGORIE_KURZ_EN = {
  "Womit ich filme": "Filming",
  "Was ich nehme": "Supplements",
  "Womit ich am Berg unterwegs bin": "Mountains",
};

const VH_PRODUCTS = [
  {
    name: "DJI Neo 2 Fly More Combo",
    kategorie: "Womit ich filme",
    text: "Für die Drohnenshots über den Gipfeln — startet von der Hand, brauch kein Stativ am Berg.",
    text_en: "For the drone shots over the summits — launches from my hand, no tripod needed in the mountains.",
    url: "https://www.amazon.de/dp/B0FJ1F5QZM?th=1&linkCode=ll2&tag=vegetarianhul-21&linkId=a138653a571471b0275264da9a5a8428&ref_=as_li_ss_tl",
    bild: "",
    active: true
  },
  {
    name: "DJI Mic Mini",
    kategorie: "Womit ich filme",
    text: "Mein Ton bei jedem Talking-Head — clippt man dran und vergisst es.",
    text_en: "My audio for every talking head — clip it on and forget about it.",
    url: "https://www.amazon.de/dp/B0DDL8WGH5?th=1&linkCode=ll2&tag=vegetarianhul-21&linkId=8d4636d5aacb5d851793087d5df6b729&ref_=as_li_ss_tl",
    bild: "",
    active: true
  },
  {
    name: "Insta360 Flow 2 Plus",
    kategorie: "Womit ich filme",
    text: "Der Gimbal für die Wander-Vlogs — KI-Tracking läuft mit, wenn ich allein unterwegs bin.",
    text_en: "The gimbal for my hiking vlogs — AI tracking keeps up when I’m out on my own.",
    url: "https://www.amazon.de/dp/B0F6CBMRBH?th=1&linkCode=ll2&tag=vegetarianhul-21&linkId=50fde7fd02631ca3bb2eab5034fb7539&ref_=as_li_ss_tl",
    bild: "",
    active: true
  },
  {
    name: "Apple MacBook Air 13\" M4",
    kategorie: "Womit ich filme",
    text: "Schneidet alle meine Reels — lautlos und den ganzen Tag ohne Steckdose.",
    text_en: "Edits all my reels — silent, and all day without a power outlet.",
    url: "https://www.amazon.de/dp/B0DZDFWPDP?th=1&linkCode=ll2&tag=vegetarianhul-21&linkId=56a0390f5dcab742bc125eaea31387ae&ref_=as_li_ss_tl",
    bild: "",
    active: true
  },
  {
    name: "ESN Daily — 480 g, Raspberry Iced Tea",
    kategorie: "Was ich nehme",
    text: "Pulver, 480 g, Geschmack Raspberry Iced Tea.",
    text_en: "Powder, 480 g, Raspberry Iced Tea flavor.",
    url: "https://www.amazon.de/dp/B0CLLYL8Q5?tag=vegetarianhul-21",
    bild: "",
    active: true,
    otonOffen: true      /* sachliche Zeile — Sebis Satz fehlt noch */
  },
  {
    name: "ESN Cognitive Essentials — 90 Kapseln",
    name_en: "ESN Cognitive Essentials — 90 capsules",
    kategorie: "Was ich nehme",
    text: "90 vegane Kapseln, 30 Portionen.",
    text_en: "90 vegan capsules, 30 servings.",
    url: "https://www.amazon.de/dp/B0H94HWT9J?tag=vegetarianhul-21",
    bild: "",
    active: true,
    otonOffen: true      /* sachliche Zeile — Sebis Satz fehlt noch */
  },
  {
    name: "SALEWA Toxo 3.0 Helm",
    name_en: "SALEWA Toxo 3.0 helmet",
    kategorie: "Womit ich am Berg unterwegs bin",
    text: "Helm von Salewa.",
    text_en: "Helmet by Salewa.",
    url: "https://www.amazon.de/dp/B09HKQ89LM?tag=vegetarianhul-21",
    bild: "",
    active: true,
    otonOffen: true      /* sachliche Zeile — Sebis Satz fehlt noch */
  },
  {
    name: "EDELRID Jay IV Klettergurt",
    name_en: "EDELRID Jay IV climbing harness",
    kategorie: "Womit ich am Berg unterwegs bin",
    text: "Klettergurt von Edelrid.",
    text_en: "Climbing harness by Edelrid.",
    url: "https://www.amazon.de/dp/B0DXWTYRBY?tag=vegetarianhul-21",
    bild: "",
    active: true,
    otonOffen: true      /* sachliche Zeile — Sebis Satz fehlt noch */
  },
  {
    name: "BangLong Fahrradbrille",
    name_en: "BangLong cycling glasses",
    kategorie: "Womit ich am Berg unterwegs bin",
    text: "Polarisiert, UV400.",
    text_en: "Polarized, UV400.",
    url: "https://www.amazon.de/dp/B0DBZB4CZW?tag=vegetarianhul-21",
    bild: "",
    active: true,
    otonOffen: true      /* sachliche Zeile — Sebis Satz fehlt noch */
  },
  {
    name: "NooMii Trinkflasche — 800 ml",
    name_en: "NooMii water bottle — 800 ml",
    kategorie: "Womit ich am Berg unterwegs bin",
    text: "Edelstahl, doppelwandig, 800 ml.",
    text_en: "Stainless steel, double-walled, 800 ml.",
    url: "https://www.amazon.de/dp/B0FPDS1YJG?tag=vegetarianhul-21",
    bild: "",
    active: true,
    otonOffen: true      /* sachliche Zeile — Sebis Satz fehlt noch */
  },
  {
    name: "Alpenwert Sitzkissen — 2er Set",
    name_en: "Alpenwert seat cushion — set of 2",
    kategorie: "Womit ich am Berg unterwegs bin",
    text: "Faltbar, wasserdicht, im Zweierset.",
    text_en: "Foldable, waterproof, set of two.",
    url: "https://www.amazon.de/dp/B0DK27T39B?tag=vegetarianhul-21",
    bild: "",
    active: true,
    otonOffen: true      /* sachliche Zeile — Sebis Satz fehlt noch */
  },
  {
    name: "HYZUO Laptoptasche 13 Zoll",
    name_en: "HYZUO 13-inch laptop sleeve",
    kategorie: "Womit ich filme",
    text: "Mit Ständer, für das MacBook Air 13 Zoll.",
    text_en: "With stand, for the 13-inch MacBook Air.",
    url: "https://www.amazon.de/dp/B08HWR6J51?tag=vegetarianhul-21",
    bild: "",
    active: true,
    otonOffen: true      /* sachliche Zeile — Sebis Satz fehlt noch */
  },
  {
    name: "Cable Kit VI",
    kategorie: "Womit ich am Berg unterwegs bin",
    text: "Mein Klettersteigset.",
    text_en: "My via ferrata set.",
    url: "https://www.amazon.de/dp/B08WRH819Y?tag=vegetarianhul-21",
    bild: "",
    active: true,
    otonOffen: true      /* sachliche Zeile — Sebis Satz fehlt noch */
  }
];
