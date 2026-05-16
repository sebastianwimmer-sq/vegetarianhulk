/* eslint-disable */
// Newsletter signup landing for vegetarianhulk.de/newsletter
// Atomic editorial components — submit hits Worker /newsletter/subscribe (Brevo).

const { useState } = React;

const MAILS = [
  {
    num: '01',
    when: 'Tag 1 · 5:42 Uhr',
    title: <>Architektur statt <em>Willenskraft</em>.</>,
    tease:
      'Warum dein 7-Uhr-Wecker nichts wert ist, solange dein Schlafzimmer dunkel und dein Handy in Reichweite ist. Setup vor Motivation. Immer.',
    shot: {
      subject: 'Die Sache mit der Willenskraft.',
      preview: (
        <>
          Ich hab 4 Jahre versucht, mich morgens <em>zu zwingen</em>. Das geht ein paar Tage. Dann nicht. Heute: drei Sachen, die mein Bett für mich machen…
        </>
      ),
      time: '5:42',
    },
  },
  {
    num: '02',
    when: 'Tag 2 · 5:42 Uhr',
    title: <>Was passiert, wenn du <em>fällst</em>.</>,
    tease:
      'Niemand redet darüber: der dritte Morgen, an dem du liegen bleibst. Hier ist, was ich mir gesagt hab — und was funktioniert hat. Ohne „mach dich klein".',
    shot: {
      subject: 'Ich bin gestern liegen geblieben.',
      preview: (
        <>
          Tag 247 — und ich hab den Wecker weggedrückt. Kein Drama. Aber ich will erzählen, was <em>am Tag danach</em> passiert ist. Weil das der eigentliche Punkt ist.
        </>
      ),
      time: '5:42',
    },
  },
  {
    num: '03',
    when: 'Tag 3 · 5:42 Uhr',
    title: <>Ab heute ist es ein <em>Ritual</em>.</>,
    tease:
      'Die letzte Mail. Kein Verkauf. Ein einzelnes Blatt — drei Sachen für deinen Morgen, eine Frage für deinen Abend. Drucken, hinhängen, vergessen.',
    shot: {
      subject: 'Ein Blatt. Drei Sachen.',
      preview: (
        <>
          Heute kein langer Text. Ich häng dir einen PDF an — das, was bei mir <em>am Spiegel klebt</em>. Mach mit oder lass es. Beides ist okay.
        </>
      ),
      time: '5:42',
    },
  },
];

function NlNav() {
  return (
    <nav className="nl-nav">
      <a className="nl-brand" href="/">
        <span className="nl-brand-dot" />
        <span>vegetarian<em>hulk</em></span>
      </a>
      <ul className="nl-nav-links">
        <li><a href="/#manifest">Manifest</a></li>
        <li><a href="/lieblingsprodukte.html">Lieblingsprodukte</a></li>
        <li><a href="/kooperationen.html">Für Brands</a></li>
        <li><a href="/newsletter" aria-current="page">Newsletter</a></li>
      </ul>
      <a className="nl-nav-cta" href="https://instagram.com/vegetarianhulk" target="_blank" rel="noopener">Insta&nbsp;→</a>
    </nav>
  );
}

function NlHero() {
  return (
    <header className="nl-hero">
      <div className="nl-hero-left">
        <div className="nl-hero-meta">
          <span className="nl-dot" />
          <span>3-Tage-Reset · DSGVO · Brevo</span>
        </div>
        <div className="nl-eyebrow nl-eyebrow--big nl-hero-eyebrow">
          <span className="line" />
          <span>— Newsletter —</span>
          <span className="line" />
        </div>
        <h1 className="nl-hero-h1">
          Was du <em>bekommst</em>,<br/>
          wenn du dich <em>einträgst</em>.
        </h1>
        <p className="nl-hero-lead">
          Drei Mails. Drei Tage. Dann Stille. Kein Funnel, kein Re-Targeting, kein „ich-meld-mich-in-2-Wochen-wieder". Wenn du nach Mail&nbsp;3 raus bist — raus. Wenn nicht: ich schreib dir, wenn was da ist. Nicht öfter.
        </p>
      </div>
      <aside className="nl-hero-right" aria-hidden="true">
        <div className="nl-hero-mark">3<span style={{color:'var(--forest-1)'}}>·</span>3</div>
        <div className="nl-hero-mark-sub">Mails · Tage</div>
      </aside>
    </header>
  );
}

function TrustBar() {
  return (
    <section className="nl-trust" aria-label="Trust indicators">
      <div className="nl-trust-cell">
        <div className="nl-trust-num">3.715<em>.</em></div>
        <div className="nl-trust-label">Tage plant-based · seit 14.03.2016</div>
      </div>
      <div className="nl-trust-cell">
        <div className="nl-trust-num">0</div>
        <div className="nl-trust-label">Bezahlte Slots · keine Werbedeals</div>
      </div>
      <div className="nl-trust-cell">
        <div className="nl-trust-num">0</div>
        <div className="nl-trust-label">Spam · Mails außerhalb der drei Tage</div>
      </div>
    </section>
  );
}

function MailCard({ m }) {
  return (
    <article className="nl-mail">
      <header className="nl-mail-head">
        <span className="nl-mail-tag">
          <span>TAG</span>
          <span className="nl-mail-num">{m.num}</span>
        </span>
        <span className="nl-mail-time">{m.when}</span>
      </header>
      <h3 className="nl-mail-title">{m.title}</h3>
      <p className="nl-mail-tease">{m.tease}</p>
      <div className="nl-mail-shot" role="img" aria-label={`Preview von Mail ${m.num}`}>
        <div className="nl-shot-from">
          <div className="nl-shot-avatar">S</div>
          <div className="nl-shot-from-name">
            Sebi · <span>vegetarianhulk</span>
          </div>
          <div className="nl-shot-from-time">{m.shot.time}</div>
        </div>
        <div className="nl-shot-subject">{m.shot.subject}</div>
        <div className="nl-shot-preview">{m.shot.preview}</div>
      </div>
    </article>
  );
}

function MailsSection() {
  return (
    <section className="nl-mails" aria-labelledby="nl-mails-h">
      <div className="nl-section-head">
        <div>
          <div className="nl-section-eyebrow">— Was kommt —</div>
          <h2 id="nl-mails-h" className="nl-section-h2">
            Drei Mails. Drei Tage.<br/>
            <em>Dann Stille.</em>
          </h2>
        </div>
        <div className="nl-section-h2-mark">N° 01–03 · 5:42</div>
      </div>
      <div className="nl-mail-grid">
        {MAILS.map(m => <MailCard key={m.num} m={m} />)}
      </div>
    </section>
  );
}

function PullQuote() {
  return (
    <aside className="nl-pull">
      <div className="nl-pull-mark">„</div>
      <blockquote className="nl-pull-quote">
        Ich misch nicht jeden Tag rein.<br/>
        <em>Versprochen.</em>
      </blockquote>
      <div className="nl-pull-attrib">
        <span className="nl-pull-line" />
        <span>Sebi · 5:42 · Bayern</span>
        <span className="nl-pull-line" />
      </div>
    </aside>
  );
}

function SignupForm() {
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState('idle'); // idle | sending | success | already | error
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!consent) {
      setErrorMsg('Bitte bestätige die Datenschutz-Erklärung.');
      return;
    }
    if (!email || !email.includes('@')) {
      setErrorMsg('Gib eine gültige E-Mail-Adresse ein.');
      return;
    }
    setErrorMsg('');
    setState('sending');

    try {
      const res = await fetch('https://peaking-ai-api.peaking.workers.dev/newsletter/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          firstName: firstName || undefined,
          brand: 'vegetarianhulk',
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.ok) {
        setState(data.already ? 'already' : 'success');
        return;
      }
      // Brevo not yet wired → mailto fallback
      if (res.status === 503) {
        const subject = encodeURIComponent('3-Tage-Reset bitte');
        const body = encodeURIComponent(
          'Hi Sebi,\n\nbitte schick mir den 3-Tage-Disziplin-Reset.\n\nMeine Mail: ' + email + '\n\nDanke!'
        );
        window.location.href = 'mailto:info@vegetarianhulk.de?subject=' + subject + '&body=' + body;
        setState('success');
        return;
      }
      throw new Error(data.error || ('Status ' + res.status));
    } catch (err) {
      setState('error');
      setErrorMsg('Konnt nicht senden. Schreib mir direkt: info@vegetarianhulk.de');
      console.error(err);
    }
  }

  const success = state === 'success' || state === 'already';

  return (
    <section className="nl-form-wrap" aria-labelledby="nl-form-h" id="eintragen">
      <div className="nl-form-side">
        <div className="nl-eyebrow">— Eintragen —</div>
        <h3 id="nl-form-h">
          Eine Mail. Ein <em>Klick.</em><br/>
          Dann startet der Reset.
        </h3>
        <p>
          Du trägst dich ein. Brevo schickt dir eine Bestätigungsmail (Double-Opt-In, DSGVO). Du klickst einmal. Morgen früh 5:42 liegt Mail&nbsp;01 in deinem Postfach.
        </p>
        <div className="nl-form-meta">
          <span>Hosted bei Brevo (EU)</span>
          <span>Double-Opt-In</span>
          <span>Jederzeit abmeldbar</span>
        </div>
      </div>

      <form className="nl-form-card" onSubmit={handleSubmit} noValidate>
        <div className="nl-form-stamp">
          3 Mails<em>· kostenlos</em>
        </div>
        <div className="nl-form-card-inner">
          {success ? (
            <div className="nl-form-success" role="status">
              {state === 'already'
                ? <>Du bist schon dabei.<br/><em>Check Inbox &amp; Spam.</em></>
                : <>Eingetragen.<br/><em>Bestätigung kommt gleich.</em></>}
              <small>Klick den Link in deiner Inbox — dann startet der Reset.</small>
            </div>
          ) : (
            <>
              <label htmlFor="nl-firstname" className="nl-form-label">
                Wie heißt du?
              </label>
              <input
                id="nl-firstname"
                type="text"
                className="nl-form-input"
                placeholder="Vorname (optional)"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                style={{ marginBottom: 14 }}
              />
              <label htmlFor="nl-email" className="nl-form-label">
                Deine E-Mail-Adresse
              </label>
              <input
                id="nl-email"
                type="email"
                className="nl-form-input"
                placeholder="du@beispiel.de"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                type="submit"
                className="nl-form-submit"
                disabled={state === 'sending'}
              >
                <span>{state === 'sending' ? 'Wird gesendet …' : 'Reset starten'}</span>
                {state !== 'sending' && <span className="nl-form-submit-arrow">→</span>}
              </button>
              <label className="nl-form-check">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                />
                <span>
                  Ich hab die <a href="/datenschutz.html"><strong>Datenschutz­erklärung</strong></a> gelesen und bin damit einverstanden, dass meine E-Mail-Adresse für den 3-Tage-Reset gespeichert wird.
                </span>
              </label>
              {errorMsg && <div className="nl-form-error">{errorMsg}</div>}
            </>
          )}
        </div>
      </form>
    </section>
  );
}

function AntiHype() {
  return (
    <section className="nl-anti" aria-labelledby="nl-anti-h">
      <div className="nl-anti-head">
        <div>
          <div className="nl-eyebrow">— Anti-Hype-Trust —</div>
          <h2 id="nl-anti-h">
            <span className="strike">Das</span> passiert <em>nicht.</em>
          </h2>
        </div>
        <div className="nl-anti-head-aside">
          Drei Sachen, die jeder Newsletter macht und die ich dir hier <em>schriftlich</em> ausschließe.
        </div>
      </div>
      <div className="nl-anti-grid">
        <div className="nl-anti-card nl-anti-card--no">
          <div className="nl-anti-icon">✕</div>
          <h3 className="nl-anti-title">Daily-Spam</h3>
          <p className="nl-anti-text">
            Keine Mail am Tag 4. Keine am Tag 7. Keine „kleine Erinnerung". Nach Mail&nbsp;3 hörst du nichts mehr — außer du willst.
          </p>
          <div className="nl-anti-stamp">— Garantiert</div>
        </div>
        <div className="nl-anti-card nl-anti-card--no">
          <div className="nl-anti-icon">✕</div>
          <h3 className="nl-anti-title">Bezahlte Werbung</h3>
          <p className="nl-anti-text">
            Keine Affiliate-Banner. Keine „Sponsoren der Mail". Keine bezahlten Empfehlungen. Wenn ein Produkt drin ist, nutz ich's selbst.
          </p>
          <div className="nl-anti-stamp">— 0 € Werbedeals</div>
        </div>
        <div className="nl-anti-card nl-anti-card--no">
          <div className="nl-anti-icon">✕</div>
          <h3 className="nl-anti-title">Funnel-Tricks</h3>
          <p className="nl-anti-text">
            Kein „99 € Coaching" am Ende. Kein Webinar, kein Discord, kein Upsell. Drei Mails. Aus. Was du draus machst — deine Sache.
          </p>
          <div className="nl-anti-stamp">— Kein Funnel</div>
        </div>
        <div className="nl-anti-card nl-anti-card--yes">
          <div className="nl-anti-icon">✓</div>
          <h3 className="nl-anti-title">3 Mails. Maximal.</h3>
          <p className="nl-anti-text">
            Das, was du oben siehst. Genau das. Wenn du nach Mail&nbsp;3 bleibst, schreib ich dir nur, wenn was wirklich da ist. Vielleicht 4× im Jahr.
          </p>
          <div className="nl-anti-stamp">— Versprochen, Sebi</div>
        </div>
      </div>
    </section>
  );
}

function NlFooter() {
  return (
    <footer className="nl-foot">
      <div className="nl-foot-inner">
        <div>
          <a className="nl-brand" href="/">
            <span className="nl-brand-dot" />
            <span>vegetarian<em>hulk</em></span>
          </a>
          <p className="nl-foot-blurb">Sebi · 25 · Bayern · Christ · Plant-Based seit 2016. Macher, nicht Coach.</p>
          <div className="nl-foot-tag">„Disziplin ist kein Talent."</div>
        </div>
        <div>
          <h4>Site</h4>
          <ul>
            <li><a href="/#manifest">Manifest</a></li>
            <li><a href="/lieblingsprodukte.html">Lieblingsprodukte</a></li>
            <li><a href="/kooperationen.html">Für Brands</a></li>
            <li><a href="https://smashtheapp.de" target="_blank" rel="noopener">SMASH (App)</a></li>
          </ul>
        </div>
        <div>
          <h4>Folgen</h4>
          <ul>
            <li><a href="https://instagram.com/vegetarianhulk" target="_blank" rel="noopener">@vegetarianhulk</a></li>
            <li><a href="/newsletter" aria-current="page">Newsletter</a></li>
            <li><a href="mailto:info@vegetarianhulk.de">Mail schreiben</a></li>
          </ul>
        </div>
        <div>
          <h4>Rechtliches</h4>
          <ul>
            <li><a href="/impressum.html">Impressum</a></li>
            <li><a href="/datenschutz.html">Datenschutz</a></li>
            <li><a href="mailto:info@vegetarianhulk.de">Kontakt</a></li>
          </ul>
        </div>
      </div>
      <div className="nl-foot-bottom">
        <span>© 2026 vegetarianhulk · vegetarianhulk.de</span>
        <span>Gebaut in Bayern · mit Inter &amp; Playfair Display</span>
      </div>
    </footer>
  );
}

function NewsletterPage() {
  return (
    <div className="nl-page">
      <NlNav />
      <main className="nl-main">
        <NlHero />
        <TrustBar />
        <MailsSection />
        <PullQuote />
        <SignupForm />
        <AntiHype />
      </main>
      <NlFooter />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<NewsletterPage />);
