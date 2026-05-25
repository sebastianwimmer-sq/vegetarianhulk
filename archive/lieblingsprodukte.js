// vegetarianhulk Lieblingsprodukte — Production
// Edit-Workflow für Sebi:
//   1. AMAZON_TAG setzen (z.B. 'vegetarianhulk-21')
//   2. Jedes Produkt: asin: 'B07XYZ...' einfügen (aus Amazon-URL kopieren)
//   3. Push → live
// Wenn AMAZON_TAG leer oder asin leer → Card zeigt „Bald verfügbar" statt Link.

const AMAZON_TAG = ''; // ← HIER deinen Amazon-Partnernet-Tag einfügen, z.B. 'vegetarianhulk-21'

const amazonUrl = (asin) =>
  asin && AMAZON_TAG
    ? `https://www.amazon.de/dp/${asin}?tag=${AMAZON_TAG}`
    : '';

const PRODUCTS = {
  fruehstueck: {
    icon: '🥣',
    eyebrow: '— Morgens, 5:42 —',
    title: <>So sieht <em>mein Frühstück</em> aus.</>,
    intro:
      'Vier Sachen. Immer dieselben. Ich hab aufgehört, kreativ zu sein — und angefangen, jeden Tag aufzustehen.',
    items: [
      {
        name: 'Kölln Blütenzarte Haferflocken',
        ph: 'OATS · 1KG',
        ph2: 'kölln · vollkorn',
        voice:
          '500g-Pack steht seit 2016 auf meiner Theke. Nichts Special, aber jeden Tag das Gleiche schlägt jedes Pulver.',
        meta: '4,29 € · 500 g',
        asin: '', // ← B-Code aus Amazon-URL (z.B. 'B07XYZ123A')
      },
      {
        name: 'Rapunzel Bio Erdnussmus Crunchy',
        ph: 'PEANUT BUTTER',
        ph2: 'rapunzel · 500g',
        voice:
          'Zwei Löffel auf den Hafer. Keine 13 Zutaten — Erdnüsse, Salz. Das war\'s. Schmeckt wie das, was es ist.',
        meta: '12,90 € · 500 g',
        asin: '',
      },
      {
        name: 'Milbona Magerquark 500g',
        ph: 'QUARK · 0,2%',
        ph2: 'milbona · lidl',
        voice:
          '40g Protein für 1,29€. Schmeckt nach nichts — genau deshalb pass\' ich rein, was ich will.',
        meta: '1,29 € · 500 g',
        asin: '',
        noAmazon: true,
        href: 'https://www.lidl.de',
        ctaLabel: 'Zu Lidl',
      },
      {
        name: 'Bananen (Bio, fairtrade)',
        ph: 'BANANE',
        ph2: 'reif, mit punkten',
        voice:
          'Die mit den braunen Punkten. Süßer, leichter zu verdauen, kein Insulin-Hammer. Vom Wochenmarkt.',
        meta: 'lokal · ~0,30 € / Stk',
        asin: '',
        noAmazon: true,
        href: '#wochenmarkt',
        ctaLabel: 'Zum Markt',
      },
    ],
  },
  gym: {
    icon: '💪',
    eyebrow: '— 4 Mal die Woche —',
    title: <>Was im <em>Gym-Rucksack</em> liegt.</>,
    intro:
      'Drei Sachen. Mehr brauch ich nicht, mehr nehm ich nicht. Wenn dir jemand 7 Supplements verkauft, lauf weg.',
    items: [
      {
        name: 'ESN Designer Whey Vegan (Vanille)',
        ph: 'WHEY VEGAN',
        ph2: 'esn · 1kg · vanille',
        voice:
          '20g Protein, schmeckt nach echtem Vanillepudding. Nach dem Training in Hafermilch — sonst nichts.',
        meta: '24,90 € · 1 kg',
        asin: '',
      },
      {
        name: 'Bulk Creatine Monohydrate',
        ph: 'KREATIN',
        ph2: 'bulk · 500g · monohydrat',
        voice:
          '5g jeden Tag. Eine Studie sagt es funktioniert. Tausend sagen es. Eines der wenigen Supplements, die echt was bringen.',
        meta: '18,90 € · 500 g',
        asin: '',
      },
      {
        name: 'Vegan B12 Tropfen (Cyanocobalamin)',
        ph: 'B12 · TROPFEN',
        ph2: 'vegavero · 50ml',
        voice:
          'Wenn du veggie bist und das nicht nimmst, bist du blauäugig. Drei Tropfen, unter die Zunge, morgens.',
        meta: '14,90 € · 50 ml',
        asin: '',
      },
    ],
  },
  faith: {
    icon: '📖',
    eyebrow: '— 5:42, vor dem Kaffee —',
    title: <>Was ich <em>jeden Morgen</em> aufschlage.</>,
    intro:
      'Zwei Bücher. Ein Vers pro Tag, dann ein Satz dazu. Mehr nicht. Es geht um Wiederholung, nicht um Tiefe.',
    items: [
      {
        name: 'Schlachter 2000 Bibel (Standardausgabe)',
        ph: 'BIBEL · SCH2000',
        ph2: 'leder · standard',
        voice:
          'Ich lese Schlachter, weil sie nüchtern übersetzt. Keine glatten Paraphrasen. Wenn da „Knecht" steht, dann steht da „Knecht".',
        meta: 'ab 19,90 €',
        asin: '',
      },
      {
        name: 'Leuchtturm1917 Notizbuch A5, Punktraster',
        ph: 'NOTIZBUCH A5',
        ph2: 'leuchtturm · forest',
        voice:
          'Eine Seite pro Morgen. Datum oben links, Vers, ein Satz. Nach 66 Tagen liest du dich selbst zurück.',
        meta: '23,90 € · A5 dotted',
        asin: '',
      },
    ],
  },
  daily: {
    icon: '🎒',
    eyebrow: '— Was am Körper bleibt —',
    title: <>Daily <em>Stack.</em></>,
    intro:
      'Sachen, die ich seit Jahren mit mir rumtrage. Nicht weil sie schön sind. Weil sie nicht kaputt gehen.',
    items: [
      {
        name: 'Bellroy Slim Sleeve Wallet (Charcoal)',
        ph: 'WALLET',
        ph2: 'bellroy · slim · charcoal',
        voice:
          '4 Karten, ein paar Scheine. Ich hatte ihn 4 Jahre, sieht aus wie am ersten Tag — nur dunkler an den Ecken.',
        meta: '89 € · leder',
        asin: '',
      },
      {
        name: 'Klean Kanteen 800ml Edelstahl',
        ph: 'BOTTLE · 800ML',
        ph2: 'klean kanteen · matt',
        voice:
          'Kein Plastik, kein Geschmack, fällt nicht auseinander. 800ml weil 500 immer zu wenig sind. Lebenslang.',
        meta: '32,90 € · 800 ml',
        asin: '',
      },
      {
        name: 'Apple Watch Sport Loop, Forest Green',
        ph: 'WATCH BAND',
        ph2: 'sport loop · forest green',
        voice:
          'Klettverschluss. Trocknet schnell, juckt nicht beim Heben. Das einzige Band, das ich nicht innerhalb von 3 Monaten gewechselt hab.',
        meta: '49 € · 45mm',
        asin: '',
      },
    ],
  },
};

// ─── Atomic components ──────────────────────────────────────
function LpStamp({ children }) {
  return (
    <span className="lp-stamp">
      <span className="lp-stamp-dot" />
      {children}
    </span>
  );
}

function LpPhoto({ label, sub, tone = 'forest' }) {
  return (
    <div className={`lp-photo lp-photo--${tone}`} aria-hidden="true">
      <svg className="lp-stripes" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
        <defs>
          <pattern id={`lp-stripes-${tone}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="currentColor" strokeWidth="1.2" />
          </pattern>
        </defs>
        <rect width="100" height="100" fill={`url(#lp-stripes-${tone})`} />
      </svg>
      <div className="lp-photo-tag">
        <span className="lp-photo-label">{label}</span>
        <span className="lp-photo-sub">{sub}</span>
      </div>
      <div className="lp-photo-corner">PHOTO</div>
    </div>
  );
}

function ProductCard({ p }) {
  const url = p.href || amazonUrl(p.asin);
  const hasLink = !!url;
  const ctaLabel = p.ctaLabel || 'Zu Amazon';
  return (
    <article className="lp-item">
      <div className="lp-item-photo">
        <LpPhoto label={p.ph} sub={p.ph2} />
      </div>
      <div className="lp-item-body">
        <div className="lp-item-name">{p.name}</div>
        <p className="lp-item-voice">„{p.voice}"</p>
        <div className="lp-item-foot">
          <span className="lp-item-meta">{p.meta}</span>
          {hasLink ? (
            <a
              className={`lp-btn ${p.noAmazon ? 'lp-btn--ghost' : ''}`}
              href={url}
              target="_blank"
              rel={p.noAmazon ? 'noopener' : 'sponsored noopener'}
            >
              {ctaLabel}&nbsp;<span className="lp-btn-arrow">→</span>
            </a>
          ) : (
            <span className="lp-btn lp-btn--ghost" aria-disabled="true" style={{opacity:0.5,cursor:'default'}}>
              Bald verfügbar
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

function CategorySection({ cat, anchor }) {
  return (
    <section className="lp-cat" id={anchor}>
      <header className="lp-cat-head">
        <div className="lp-cat-icon" aria-hidden="true">{cat.icon}</div>
        <div className="lp-cat-meta">
          <div className="lp-eyebrow">{cat.eyebrow}</div>
          <h2 className="lp-cat-title">{cat.title}</h2>
          <p className="lp-cat-intro">{cat.intro}</p>
        </div>
        <div className="lp-cat-count">
          <span className="lp-cat-count-num">{String(cat.items.length).padStart(2, '0')}</span>
          <span className="lp-cat-count-label">items</span>
        </div>
      </header>
      <div className="lp-grid">
        {cat.items.map((p, i) => <ProductCard key={i} p={p} />)}
      </div>
    </section>
  );
}

function PullQuote() {
  return (
    <aside className="lp-pull">
      <div className="lp-pull-mark">„</div>
      <blockquote className="lp-pull-quote">
        Nichts Bezahltes.<br/>
        <em>Nur was wirklich täglich da ist.</em>
      </blockquote>
      <div className="lp-pull-attrib">
        <span className="lp-pull-line" />
        <span>Sebi · seit 14.03.2016 plant-based · Bayern</span>
        <span className="lp-pull-line" />
      </div>
    </aside>
  );
}

function LpNav() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const navRef = React.useRef(null);
  const btnRef = React.useRef(null);

  React.useEffect(() => {
    if (!menuOpen) return;
    const close = (e) => {
      if (!navRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  return (
    <nav className="lp-nav">
      <a className="lp-brand" href="/">
        <span className="lp-brand-dot" />
        <span>vegetarian<em>hulk</em></span>
      </a>
      <button ref={btnRef} className="lp-nav-burger" aria-label={menuOpen ? 'Menü schließen' : 'Menü öffnen'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d={menuOpen ? "M5 5l10 10M5 15l10-10" : "M3 5h14M3 10h14M3 15h14"} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
      </button>
      <ul ref={navRef} className={"lp-nav-links" + (menuOpen ? " lp-nav-links--open" : "")}>
        <li><a href="/" onClick={() => setMenuOpen(false)}>Manifest</a></li>
        <li><a href="/lieblingsprodukte.html" aria-current="page" onClick={() => setMenuOpen(false)}>Lieblingsprodukte</a></li>
        <li><a href="/newsletter" onClick={() => setMenuOpen(false)}>Newsletter</a></li>
        <li><a href="/kooperationen.html" onClick={() => setMenuOpen(false)}>Kooperationen</a></li>
      </ul>
      <a className="lp-nav-cta" href="https://instagram.com/vegetarianhulk" target="_blank" rel="noopener">Insta&nbsp;→</a>
    </nav>
  );
}

function LpHero() {
  const totalItems = Object.values(PRODUCTS).reduce((n, c) => n + c.items.length, 0);
  return (
    <header className="lp-hero">
      <div className="lp-hero-meta">
        <LpStamp>Tag 3.713 · plant-based</LpStamp>
        <span className="lp-hero-path">/ lieblingsprodukte</span>
      </div>
      <div className="lp-eyebrow lp-hero-eyebrow">— Lieblings-Stack —</div>
      <h1 className="lp-hero-h1">
        Was bei mir wirklich<br/>auf dem <em>Teller</em><br/>&amp; im <em>Schrank</em> landet.
      </h1>
      <p className="lp-hero-lead">
        Keine 50-Produkte-Liste. Keine bezahlten Slots. Zwölf Sachen, die seit Jahren bei mir bleiben — Frühstück, Gym, Bibel, Alltag. Wenn was dabei ist, das du nutzt: schön. Wenn nicht: ignorier den Link.
      </p>
      <div className="lp-hero-foot">
        <div className="lp-hero-stat">
          <span className="lp-hero-stat-num">{totalItems}</span>
          <span className="lp-hero-stat-label">Items · 4&nbsp;Kategorien</span>
        </div>
        <div className="lp-hero-stat">
          <span className="lp-hero-stat-num">0</span>
          <span className="lp-hero-stat-label">Bezahlte Platzierungen</span>
        </div>
        <div className="lp-hero-stat">
          <span className="lp-hero-stat-num">~3<span className="lp-hero-stat-sub">¢</span></span>
          <span className="lp-hero-stat-label">Ø Provision pro Klick</span>
        </div>
      </div>
    </header>
  );
}

function DisclosureNotice() {
  return (
    <aside className="lp-disclosure">
      <div className="lp-disclosure-mark">*</div>
      <p className="lp-disclosure-text">
        <strong>Affiliate-Links</strong> — ich empfehle nur Produkte, die ich selbst täglich nutze.
        Wenn du über die Links bestellst, kriegt vegetarianhulk ein paar Cents. Cent-Preise ändern <em>nichts</em> an deiner Bestellung. DSGVO-konform, Werbung gemäß §&nbsp;5a UWG gekennzeichnet.
      </p>
    </aside>
  );
}

function LpFooter() {
  return (
    <footer className="lp-foot">
      <div className="lp-foot-mark">
        <span className="lp-foot-quote">„Disziplin ist kein Talent.<br/><em>Sie ist ein Ritual.</em>"</span>
        <div className="lp-foot-attrib">— Mein Prinzip · seit Tag 1</div>
      </div>
      <div className="lp-foot-trust">
        <div className="lp-eyebrow">— Trust-Note —</div>
        <p>
          {"Wenn du was über meine Links kaufst, kriegt vegetarianhulk ein paar Cents. Du zahlst keinen Aufpreis — Amazon zieht's von ihrer Marge ab. Danke. Wirklich."}
        </p>
        <p className="lp-foot-trust-sub">
          Diese Seite enthält Werbung (Affiliate-Links zu Amazon). Ich liste nur Produkte, die ich seit mindestens 6 Monaten täglich oder wöchentlich nutze. Wenn ich was probiere und es taugt nichts, kommt es runter.
        </p>
      </div>
      <div className="lp-foot-bottom">
        <span className="lp-brand-mini">vegetarian<em>hulk</em> · Sebi · Bayern</span>
        <span className="lp-foot-links">
          <a href="/impressum.html">Impressum</a><span> · </span>
          <a href="/datenschutz.html">Datenschutz</a><span> · </span>
          <a href="mailto:info@vegetarianhulk.de">Kontakt</a>
        </span>
      </div>
    </footer>
  );
}

function LpPage() {
  return (
    <div className="lp-page">
      <LpNav />
      <main className="lp-main">
        <LpHero />
        <DisclosureNotice />
        <CategorySection cat={PRODUCTS.fruehstueck} anchor="fruehstueck" />
        <CategorySection cat={PRODUCTS.gym} anchor="gym" />
        <PullQuote />
        <CategorySection cat={PRODUCTS.faith} anchor="faith" />
        <CategorySection cat={PRODUCTS.daily} anchor="daily" />
        <LpFooter />
      </main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<LpPage />);
