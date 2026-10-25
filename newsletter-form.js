/* ============================================================
   vegetarianhulk · <vh-newsletter-form>
   Single Source of Truth für das Newsletter-Signup.
   Auf Startseite UND /newsletter eingebunden — kein Copy-Paste-Drift.

   - Felder: Vorname (optional) + E-Mail
   - Submit: POST {email, brand, firstName} → Cloudflare Worker → Brevo
     503 (Brevo not configured) → mailto-Fallback (smooth)
   - States: idle · sending · success · already · error
   - localStorage-Parity (Sticky-CTA-Logik beider Seiten)
   - Mehrere Instanzen auf einer Seite werden bei Erfolg synchronisiert
   - Dispatcht `vh:subscribed` (document) → Seiten können Sticky-CTA ausblenden

   Shadow DOM mit eigenen (hartkodierten) Forest-Family-Styles =
   pixelgleiches Rendering auf jeder Seite, egal welches Stylesheet lädt.
   ============================================================ */
(function () {
  'use strict';

  var ENDPOINT = 'https://vh-forms.peaking.workers.dev/newsletter/subscribe';
  var BRAND = 'vegetarianhulk';
  // Cloudflare Turnstile: Sitekey eintragen → CAPTCHA aktiv (Widget vor dem Submit).
  // Leer = Schicht aus. Server-Gegenstück: TURNSTILE_SECRET im vh-forms-Worker.
  var TURNSTILE_SITEKEY = '0x4AAAAAAEUfGlaYARQSJ-Co';
  var LS_KEY = 'vegetarianhulk_newsletterSubscribed';
  var CONTACT = 'info@vegetarianhulk.de';
  /* Zweisprachig (Sebi 25.10.2026): Texte per <html lang>. Die englische Anmeldung geht auf die
     englische Liste und bekommt englische Mails (Worker: sprache). */
  var SPRACHE = document.documentElement.lang === 'en' ? 'en' : 'de';
  var T = {
    de: {
      form: 'Newsletter-Signup', vorname: 'Dein Vorname (optional)', mail: 'Deine E-Mail-Adresse', mailPh: 'deine@email.de',
      knopf: 'Berg-Starter holen', hp: 'Dieses Feld bitte leer lassen',
      einwilligung: 'Ja, schick mir den Berg-Starter und ab und zu den Letter. Ich best&auml;tige per Mail (Double-Opt-In) und kann mich jederzeit abmelden. Mehr in der <a href="/datenschutz.html">Datenschutzerkl&auml;rung</a>.',
      trust: 'Kein Spam &middot; Aussteigen mit einem Klick.',
      erfolg: '<strong>Fast geschafft.</strong> Best&auml;tige kurz den Link in deiner Mail &mdash; dann kommt der Berg-Starter.',
      schon: '<strong>Schon dabei.</strong> Diese E-Mail ist bereits eingetragen.',
      fehler: '<strong>Etwas ging schief.</strong> ', nochmal: 'Versuch&apos;s nochmal.', schritt: 'Da fehlt noch ein Schritt.',
      mailPruefen: 'E-Mail-Adresse pr&uuml;fen.', haken: 'Bitte setz kurz den Datenschutz-Haken &mdash; dann geht&apos;s los.',
      captcha: '<strong>Fast fertig.</strong> Setz noch den Haken bei der Sicherheitspr&uuml;fung &mdash; dann geht&apos;s los.',
      senden: 'Konnt nicht senden. Schreib mir direkt: ',
      mailtoBetreff: 'Berg-Starter bitte', mailtoText: 'Hi Sebi,\n\nbitte schick mir den Berg-Starter.\n\n',
      mailtoVorname: 'Mein Vorname: ', mailtoMail: 'Meine Mail: ', mailtoDanke: '\n\nDanke!',
      einwilligungText: 'Newsletter + Berg-Starter, Double-Opt-In, Abmeldung jederzeit'
    },
    en: {
      form: 'Newsletter signup', vorname: 'Your first name (optional)', mail: 'Your email address', mailPh: 'you@email.com',
      knopf: 'Get the Hike Starter', hp: 'Please leave this field empty',
      einwilligung: 'Yes, send me the Hike Starter and the letter now and then. I confirm by email (double opt-in) and can unsubscribe anytime. More in the <a href="/datenschutz.html" hreflang="de">privacy policy (German)</a>.',
      trust: 'No spam &middot; Unsubscribe with one click.',
      erfolg: '<strong>Almost done.</strong> Just confirm the link in your email &mdash; then the Hike Starter arrives.',
      schon: '<strong>Already in.</strong> This email is already signed up.',
      fehler: '<strong>Something went wrong.</strong> ', nochmal: 'Please try again.', schritt: 'One step is still missing.',
      mailPruefen: 'Please check your email address.', haken: 'Please tick the privacy box &mdash; then we&apos;re good to go.',
      captcha: '<strong>Almost there.</strong> Please complete the security check &mdash; then we&apos;re good to go.',
      senden: 'Couldn&apos;t send. Write to me directly: ',
      mailtoBetreff: 'Hike Starter please', mailtoText: 'Hi Sebi,\n\nplease send me the Hike Starter.\n\n',
      mailtoVorname: 'My first name: ', mailtoMail: 'My email: ', mailtoDanke: '\n\nThanks!',
      einwilligungText: 'Newsletter + Hike Starter, double opt-in, unsubscribe anytime'
    }
  }[SPRACHE];

  var TEMPLATE = '' +
    '<style>' +
    '  :host { display: block; }' +
    '  * { box-sizing: border-box; }' +
    '  .sr { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }' +
    '  form { display: flex; flex-direction: column; gap: 10px; width: 100%; max-width: 460px; margin: 0 auto; }' +
    '  .row { display: flex; flex-direction: column; gap: 10px; }' +
    '  .field {' +
    '    -webkit-appearance: none; appearance: none; width: 100%;' +
    '    background: #f7efde; border: 1.5px solid #cfbf9d; border-radius: 14px;' +
    '    padding: 16px 18px; min-height: 52px;' +
    '    font-family: "Inter", system-ui, sans-serif; font-size: 16px; font-weight: 500;' +
    '    color: #1a1410; outline: none;' +
    '    transition: border-color 0.18s ease, box-shadow 0.18s ease;' +
    '  }' +
    '  .field::placeholder { color: #9a8c75; font-weight: 400; }' +
    '  .field:focus { border-color: #045927; box-shadow: 0 0 0 4px rgba(4, 89, 39, 0.14); }' +
    '  .submit {' +
    '    position: relative; background: #045927; color: #f7efde; border: none;' +
    '    border-radius: 14px; padding: 16px 22px; min-height: 52px;' +
    '    font-family: "Inter", system-ui, sans-serif; font-weight: 700; font-size: 14px;' +
    '    letter-spacing: 1.4px; text-transform: uppercase; cursor: pointer;' +
    '    display: inline-flex; align-items: center; justify-content: center; gap: 8px;' +
    '    transition: background 0.18s ease, transform 0.15s ease, box-shadow 0.25s ease;' +
    '  }' +
    '  .submit:hover:not(:disabled) { background: #122d1c; transform: translateY(-1px); box-shadow: 0 14px 32px -10px rgba(4, 89, 39, 0.55); }' +
    '  .submit:disabled { opacity: 0.7; cursor: wait; }' +
    '  .submit:focus-visible { outline: 3px solid #1a7340; outline-offset: 2px; }' +
    '  .arrow { display: inline-block; transition: transform 0.18s ease; }' +
    '  .submit:hover:not(:disabled) .arrow { transform: translateX(3px); }' +
    '  .spinner { width: 14px; height: 14px; border: 2px solid rgba(247, 239, 222, 0.35); border-top-color: #f7efde; border-radius: 50%; animation: spin 700ms linear infinite; }' +
    '  @keyframes spin { to { transform: rotate(360deg); } }' +
    '  @media (min-width: 520px) { .email-row { flex-direction: row; } .email-row .field { flex: 1; } }' +
    '  .trust {' +
    '    font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 11px; font-weight: 600;' +
    '    letter-spacing: 1px; text-transform: uppercase; color: #9a8c75; margin: 2px 0 0; line-height: 1.5;' +
    '  }' +
    '  .trust a { color: #045927; }' +
    '  .msg { display: none; margin: 0; padding: 14px 16px; border-radius: 12px; font-size: 14px; line-height: 1.45; font-weight: 500; }' +
    '  .msg.is-visible { display: block; }' +
    '  .msg--success { background: rgba(4, 89, 39, 0.08); border: 1px solid rgba(4, 89, 39, 0.3); color: #122d1c; }' +
    '  .msg--info { background: #efe5cf; border: 1px solid #cfbf9d; color: #1a1410; }' +
    '  .msg--error { background: rgba(179, 54, 31, 0.06); border: 1px solid rgba(179, 54, 31, 0.3); color: #b3361f; }' +
    '  .msg strong { font-weight: 700; }' +
    '  :host([data-state="success"]) .row, :host([data-state="success"]) .submit, :host([data-state="success"]) .trust, :host([data-state="success"]) .consent { display: none; }' +
    '  .consent { display: flex; align-items: flex-start; gap: 10px; margin: 2px 0 0; cursor: pointer; }' +
    '  .consent input { flex: 0 0 auto; width: 19px; height: 19px; margin-top: 1px; accent-color: #045927; cursor: pointer; }' +
    '  .consent > span { font-family: "Inter", system-ui, sans-serif; font-size: 12.5px; line-height: 1.5; color: #5c513f; font-weight: 500; }' +
    '  .consent a { color: #045927; font-weight: 600; }' +
    '  .consent.is-err > span { color: #b3361f; }' +
    '  .consent.is-err input { outline: 2px solid #b3361f; outline-offset: 2px; }' +
    '  .hp { position: absolute !important; left: -9999px; top: auto; width: 1px; height: 1px; overflow: hidden; }' +
    '  @media (prefers-reduced-motion: reduce) { .spinner { animation-duration: 1400ms; } .submit, .arrow, .field { transition: none; } }' +
    '</style>' +
    '<form novalidate aria-label="' + T.form + '">' +
    '  <div class="row">' +
    '    <label class="sr" for="vhnf-first">' + T.vorname + '</label>' +
    '    <input id="vhnf-first" class="field" type="text" name="firstName" placeholder="' + T.vorname + '" autocomplete="given-name" maxlength="40" />' +
    '    <div class="row email-row">' +
    '      <label class="sr" for="vhnf-email">' + T.mail + '</label>' +
    '      <input id="vhnf-email" class="field" type="email" name="email" placeholder="' + T.mailPh + '" autocomplete="email" inputmode="email" required />' +
    '      <button class="submit" type="submit">' +
    '        <span class="label">' + T.knopf + '</span>' +
    '        <span class="arrow" aria-hidden="true">&rarr;</span>' +
    '        <span class="spinner" hidden aria-hidden="true"></span>' +
    '      </button>' +
    '    </div>' +
    '  </div>' +
    '  <slot name="captcha"></slot>' +
    '  <label class="sr" for="vhnf-hp">' + T.hp + '</label>' +
    '  <input id="vhnf-hp" class="hp" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" />' +
    '  <label class="consent"><input id="vhnf-consent" type="checkbox" />' +
    '    <span>' + T.einwilligung + '</span>' +
    '  </label>' +
    '  <p class="trust">' + T.trust + '</p>' +
    '  <div class="msg" role="status" aria-live="polite"></div>' +
    '</form>';

  /* Turnstile rendert nicht in Shadow DOM — deshalb Light-DOM-Kind am Host,
     das über <slot name="captcha"> an der richtigen Stelle erscheint. */
  var turnstileReady = null;
  function loadTurnstile() {
    if (turnstileReady) return turnstileReady;
    turnstileReady = new Promise(function (resolve) {
      if (window.turnstile) { resolve(window.turnstile); return; }
      var s = document.createElement('script');
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__vhTurnstileOnload';
      s.async = true;
      s.defer = true;
      window.__vhTurnstileOnload = function () { resolve(window.turnstile); };
      document.head.appendChild(s);
    });
    return turnstileReady;
  }

  function setLocalStorageSubscribed() {
    try { localStorage.setItem(LS_KEY, 'true'); } catch (e) { /* private mode */ }
  }

  function emitSubscribed() {
    document.dispatchEvent(new CustomEvent('vh:subscribed', { bubbles: true }));
  }

  function syncAllToSuccess(state) {
    document.querySelectorAll('vh-newsletter-form').forEach(function (node) {
      if (typeof node.showState === 'function') node.showState(state);
    });
  }

  function VhForm() {
    return Reflect.construct(HTMLElement, [], VhForm);
  }
  VhForm.prototype = Object.create(HTMLElement.prototype);
  VhForm.prototype.constructor = VhForm;

  VhForm.prototype.connectedCallback = function () {
    if (this._wired) return;
    this._wired = true;
    var root = this.attachShadow({ mode: 'open' });
    root.innerHTML = TEMPLATE;

    this._form = root.querySelector('form');
    this._email = root.querySelector('#vhnf-email');
    this._first = root.querySelector('#vhnf-first');
    this._submit = root.querySelector('.submit');
    this._label = root.querySelector('.label');
    this._arrow = root.querySelector('.arrow');
    this._spinner = root.querySelector('.spinner');
    this._msg = root.querySelector('.msg');
    this._hp = root.querySelector('#vhnf-hp');
    this._consent = root.querySelector('#vhnf-consent');
    this._consentBox = root.querySelector('.consent');

    var self = this;
    this._form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      self.handleSubmit();
    });
    this._email.addEventListener('input', function () {
      if (self.dataset.state === 'error') self.resetState();
    });
    this._consent.addEventListener('change', function () {
      if (self._consent.checked) self._consentBox.classList.remove('is-err');
    });

    // CAPTCHA-Schicht (nur mit Sitekey aktiv)
    this._turnstileWidgetId = null;
    if (TURNSTILE_SITEKEY) {
      var holder = document.createElement('div');
      holder.setAttribute('slot', 'captcha');
      this.appendChild(holder);
      this._captchaHolder = holder;
      loadTurnstile().then(function (turnstile) {
        self._turnstileWidgetId = turnstile.render(holder, {
          sitekey: TURNSTILE_SITEKEY,
          theme: 'light',
          size: 'flexible',
          action: 'newsletter-signup',
        });
      });
    }
  };

  VhForm.prototype.resetState = function () {
    this.removeAttribute('data-state');
    this._submit.disabled = false;
    this._spinner.hidden = true;
    this._label.style.opacity = '1';
    this._arrow.style.display = '';
    this._msg.className = 'msg';
    this._email.removeAttribute('aria-invalid');
  };

  VhForm.prototype.showState = function (state, detail) {
    this.resetState();
    this.dataset.state = state;
    if (state === 'sending') {
      this._submit.disabled = true;
      this._spinner.hidden = false;
      this._label.style.opacity = '0.5';
      this._arrow.style.display = 'none';
      return;
    }
    if (state === 'success') {
      this._msg.className = 'msg is-visible msg--success';
      this._msg.innerHTML = T.erfolg;
      return;
    }
    if (state === 'already') {
      this.removeAttribute('data-state'); // Felder sichtbar lassen
      this._msg.className = 'msg is-visible msg--info';
      this._msg.innerHTML = T.schon;
      return;
    }
    if (state === 'error') {
      this.removeAttribute('data-state');
      this._msg.className = 'msg is-visible msg--error';
      this._email.setAttribute('aria-invalid', 'true');
      this._msg.innerHTML = T.fehler + (detail || T.nochmal);
    }
    if (state === 'fehlt') {
      this._msg.className = 'msg is-visible msg--info';
      this._msg.innerHTML = detail || T.schritt;
      return;
    }
  };

  VhForm.prototype.handleSubmit = function () {
    // Honeypot: von Bots ausgefüllt → still abbrechen (nicht verraten)
    if (this._hp && this._hp.value) { this.showState('success'); return; }
    var email = (this._email.value || '').trim().toLowerCase();
    var firstName = (this._first.value || '').trim().slice(0, 40);
    var valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!valid) {
      this.showState('error', T.mailPruefen);
      return;
    }
    // Datenschutz-Einwilligung (DSGVO): Haken ist Pflicht
    if (this._consent && !this._consent.checked) {
      this._consentBox.classList.add('is-err');
      this.showState('error');
      this._email.removeAttribute('aria-invalid'); // nicht die Mail, der Haken fehlt
      this._msg.innerHTML = T.haken;
      return;
    }
    // CAPTCHA: Token einsammeln (nur wenn Schicht aktiv)
    var turnstileToken = '';
    if (TURNSTILE_SITEKEY && window.turnstile && this._turnstileWidgetId !== null) {
      turnstileToken = window.turnstile.getResponse(this._turnstileWidgetId) || '';
      if (!turnstileToken) {
        this.showState('fehlt', T.captcha);
        this._email.removeAttribute('aria-invalid');
        if (this._captchaHolder) {
          this._captchaHolder.classList.add('is-err');
          try {
            this._captchaHolder.scrollIntoView({ block: 'center', behavior: 'smooth' });
          } catch (e) {
            this._captchaHolder.scrollIntoView(false);
          }
          var holderRef = this._captchaHolder;
          window.setTimeout(function () { holderRef.classList.remove('is-err'); }, 2600);
        }
        return;
      }
    }
    this.showState('sending');
    var self = this;

    fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, brand: BRAND, firstName: firstName, turnstileToken: turnstileToken, consent: true, consentText: T.einwilligungText, sprache: SPRACHE })
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          return { res: res, data: data };
        });
      })
      .then(function (r) {
        if (r.res.ok && r.data.ok) {
          setLocalStorageSubscribed();
          emitSubscribed();
          syncAllToSuccess(r.data.already ? 'already' : 'success');
          return;
        }
        // 503 Brevo not configured → mailto-Fallback (smooth)
        if (r.res.status === 503) {
          setLocalStorageSubscribed();
          emitSubscribed();
          var subject = encodeURIComponent(T.mailtoBetreff);
          var body = encodeURIComponent(
            T.mailtoText +
            (firstName ? T.mailtoVorname + firstName + '\n' : '') +
            T.mailtoMail + email + T.mailtoDanke
          );
          window.location.href = 'mailto:' + CONTACT + '?subject=' + subject + '&body=' + body;
          syncAllToSuccess('success');
          return;
        }
        throw new Error(r.data.error || ('Status ' + r.res.status));
      })
      .catch(function (err) {
        // Turnstile-Token ist verbraucht → Widget zurücksetzen für neuen Versuch
        if (self._turnstileWidgetId !== null && window.turnstile) {
          try { window.turnstile.reset(self._turnstileWidgetId); } catch (e) { /* noop */ }
        }
        self.showState('error', T.senden + CONTACT);
        if (window.console) console.error('[newsletter] submit failed:', err);
      });
  };

  if (window.customElements && !customElements.get('vh-newsletter-form')) {
    customElements.define('vh-newsletter-form', VhForm);
  }
})();
