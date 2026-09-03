/* Ausgelagert aus anfrage.html am 03.09.2026.
   Grund: mit einem Inline-<script> laesst sich script-src nicht auf 'self'
   setzen — 'unsafe-inline' erlaubt sonst jedes eingeschleuste Skript.
   Einbindung mit defer an derselben Stelle, damit das Timing gleich bleibt.
   Quelle: der Stand aus origin/main INKLUSIVE der Turnstile-Fuehrung —
   die frühere Auslagerung stammte aus der Fassung davor und haette 13
   Zeilen verschluckt. */
// Brand-Anfrage → eigener Cloudflare-Worker (vh-forms, Repo: workers/vh-forms)
// → Brevo Transactional → info@vegetarianhulk.de.
const FORMS_ENDPOINT = 'https://vh-forms.peaking.workers.dev/brand-inquiry';

async function submitBrandInquiry(e) {
  e.preventDefault();
  const form = document.getElementById('brandForm');
  const get = id => (document.getElementById(id).value || '').trim();
  const checked = name => {
    const el = document.querySelector('input[name="' + name + '"]:checked');
    return el ? el.value : '';
  };
  const brand = get('bf-brand');
  const email = get('bf-email');

  const errBox = document.getElementById('formError');
  errBox.hidden = true;
  if (!brand || !email) return false; // Pflicht: nur Brand + E-Mail

  // DSGVO: Consent-Haken ist Pflicht
  const consent = document.getElementById('bf-consent');
  const consentBox = document.querySelector('.anf-consent');
  if (consent && !consent.checked) {
    if (consentBox) consentBox.classList.add('is-err');
    errBox.hidden = false;
    errBox.textContent = 'Bitte setz kurz den Datenschutz-Haken, dann kann ich deine Anfrage bearbeiten.';
    (consentBox || errBox).scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }

  const payload = {
    brand: brand,
    link: get('bf-link'),
    what: get('bf-what'),
    types: Array.from(document.querySelectorAll('input[name="type"]:checked')).map(i => i.value),
    budget: checked('budget'),
    time: checked('time'),
    idea: get('bf-idea'),
    email: email,
    contact: checked('contact'),
    handle: get('bf-handle'),
    consent: true,
    turnstileToken: (window.turnstile && window.turnstile.getResponse()) || '',
    _honey: get('bf-hp')
  };

  // Ohne Turnstile-Token antwortet der Worker fail-closed mit 403. Den Request
  // gar nicht erst schicken, sondern zeigen, WO der Haken fehlt — sonst liest
  // der Nutzer nur eine Fehlermeldung und sucht die Ursache beim Formular.
  if (!payload.turnstileToken) {
    const widget = document.querySelector('.cf-turnstile');
    const fehler = document.getElementById('formError');
    if (fehler) {
      fehler.innerHTML = '<strong>Fast fertig.</strong> Setz noch den Haken bei der Sicherheitsprüfung — dann geht\'s los.';
      fehler.hidden = false;
    }
    if (widget) {
      widget.classList.add('is-err');
      widget.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => widget.classList.remove('is-err'), 2600);
    }
    return;
  }

  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Wird gesendet …';

  try {
    const res = await fetch(FORMS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      document.getElementById('formCard').hidden = true;
      const ok = document.getElementById('successState');
      ok.hidden = false;
      ok.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return false;
    }
    // Token verbraucht/fehlgeschlagen → Widget zurücksetzen für neuen Versuch
    if (window.turnstile) { try { window.turnstile.reset(); } catch (e) { /* noop */ } }
    // 503 = Worker live, Mail-API (noch) nicht konfiguriert → mailto-Fallback
    if (res.status === 503) {
      const subject = encodeURIComponent('Brand-Anfrage: ' + brand);
      const body = encodeURIComponent(
        'Brand: ' + brand + '\nWebseite/Insta: ' + (payload.link || '—') +
        '\nIdee: ' + (payload.idea || '—') + '\nKontakt: ' + email
      );
      window.location.href = 'mailto:info@vegetarianhulk.de?subject=' + subject + '&body=' + body;
      btn.disabled = false;
      btn.textContent = original;
      errBox.textContent = 'Mail-App geöffnet — schick die Anfrage direkt ab, ich melde mich persönlich.';
      errBox.hidden = false;
      return false;
    }
    throw new Error(data.error || ('Status ' + res.status));
  } catch (err) {
    btn.disabled = false;
    btn.textContent = original;
    errBox.textContent = 'Konnte nicht senden: ' + (err.message || err) + ' — bitte schreib mir direkt an info@vegetarianhulk.de.';
    errBox.hidden = false;
  }
  return false;
}

// Footer-Year
(function () {
  var y = new Date().getFullYear();
  document.querySelectorAll('#footer-year').forEach(function (el) { el.textContent = y; });
})();


/* Consent-Fehler zurücksetzen beim Ankreuzen */
(function () {
  var c = document.getElementById('bf-consent');
  if (c) c.addEventListener('change', function () {
    if (c.checked) { var box = document.querySelector('.anf-consent'); if (box) box.classList.remove('is-err'); }
  });
})();
/* Count-Up der Kontext-Zahlen beim Reinscrollen (animiert + live-Gefühl) */
(function () {
  'use strict';
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function fmtInt(n) { return n.toLocaleString('de-DE'); }
  function fmtPct(n) { return n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'; }
  var nums = document.querySelectorAll('[data-count], [data-count-pct]');
  function run(el) {
    var pct = el.hasAttribute('data-count-pct');
    var target = parseFloat(pct ? el.dataset.countPct : el.dataset.count);
    var fmt = pct ? fmtPct : fmtInt;
    if (reduce) { el.textContent = fmt(target); return; }
    var t0 = null, DUR = 1400;
    function step(ts) {
      if (!t0) t0 = ts;
      var p = Math.min(1, (ts - t0) / DUR);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = fmt(pct ? Math.round(target * e * 10) / 10 : Math.round(target * e));
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if ('IntersectionObserver' in window && nums.length) {
    if (!reduce) nums.forEach(function (el) { el.textContent = el.hasAttribute('data-count-pct') ? fmtPct(0) : fmtInt(0); });
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { run(en.target); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -12% 0px' });
    nums.forEach(function (el) { io.observe(el); });
  } else { nums.forEach(run); }
})();
