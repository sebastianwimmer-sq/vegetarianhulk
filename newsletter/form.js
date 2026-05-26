/* ============================================================
   vegetarianhulk · /newsletter · vanilla form + states
   No React. Native validation. localStorage parity with index.
   ============================================================ */

(function () {
  'use strict';

  var LS_KEY = 'vegetarianhulk_newsletterSubscribed';

  // ── Form-state helper ────────────────────────────────────
  function setState(form, state, detail) {
    var card = form.closest('.form-card');
    var input = form.querySelector('.input');
    var submit = form.querySelector('.submit');
    var submitLabel = submit.querySelector('.label');
    var spinner = submit.querySelector('.spinner');
    var msg = card.querySelector('.form-msg');

    card.dataset.state = state;
    card.classList.remove('is-done');

    // reset
    submit.disabled = false;
    if (spinner) spinner.style.display = 'none';
    submitLabel.style.opacity = '1';
    msg.classList.remove('is-visible', 'form-msg--success', 'form-msg--info', 'form-msg--error');
    input.classList.remove('is-focused');
    input.removeAttribute('aria-invalid');

    if (state === 'focus') {
      input.classList.add('is-focused');
      input.focus({ preventScroll: true });
      return;
    }
    if (state === 'sending') {
      submit.disabled = true;
      if (spinner) spinner.style.display = 'inline-block';
      submitLabel.style.opacity = '0.5';
      return;
    }
    if (state === 'success') {
      card.classList.add('is-done');
      msg.classList.add('is-visible', 'form-msg--success');
      msg.innerHTML = '<strong>Eingetragen.</strong> Schau in dein Postfach — Tag 1 kommt direkt.';
      return;
    }
    if (state === 'already') {
      msg.classList.add('is-visible', 'form-msg--info');
      msg.innerHTML = '<strong>Schon dabei.</strong> Diese Email ist bereits eingetragen.';
      return;
    }
    if (state === 'error') {
      msg.classList.add('is-visible', 'form-msg--error');
      input.setAttribute('aria-invalid', 'true');
      msg.innerHTML = '<strong>Etwas ging schief.</strong> ' + (detail || 'Versuch&apos;s nochmal.');
      return;
    }
    // idle
  }

  // ── URL-driven state override (for design preview) ─
  function applyUrlState() {
    var params = new URLSearchParams(window.location.search);
    var s = params.get('state');
    if (!s) return;
    document.querySelectorAll('form.signup').forEach(function (f) {
      setState(f, s);
    });
  }

  // ── Variant class (?variant=hand|geo, default hand) ─
  function applyVariant() {
    var params = new URLSearchParams(window.location.search);
    var v = params.get('variant') || 'hand';
    document.body.classList.remove('variant-hand', 'variant-geo');
    document.body.classList.add('variant-' + v);
  }

  // ── Sticky-CTA visibility logic ─
  function setupStickyCta() {
    var cta = document.querySelector('.sticky-cta');
    if (!cta) return;
    var hero = document.querySelector('.hero');
    var repeat = document.querySelector('.repeat');
    var subscribed = false;
    try { subscribed = localStorage.getItem(LS_KEY) === 'true'; } catch (e) {}

    // If subscribed (or URL forced), never show.
    var params = new URLSearchParams(window.location.search);
    var ctaForced = params.get('cta');
    if (ctaForced === 'on') { cta.classList.add('is-visible'); return; }
    if (ctaForced === 'off' || subscribed) { cta.classList.remove('is-visible'); return; }

    var heroOut = false, formIn = false;
    function update() {
      if (heroOut && !formIn) cta.classList.add('is-visible');
      else cta.classList.remove('is-visible');
    }
    var ob1 = new IntersectionObserver(function (entries) {
      heroOut = !entries[0].isIntersecting;
      update();
    }, { threshold: 0.1 });
    if (hero) ob1.observe(hero);

    var ob2 = new IntersectionObserver(function (entries) {
      formIn = entries[0].isIntersecting;
      update();
    }, { threshold: 0.15 });
    if (repeat) ob2.observe(repeat);
  }

  // ── Reveal-on-scroll ─
  function setupReveal() {
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) {
      els.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    var ob = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          ob.unobserve(e.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el) { ob.observe(el); });
  }

  // ── Form submit — POSTs to Cloudflare Worker → Brevo ─
  function syncAllFormsSuccess(state) {
    document.querySelectorAll('form.signup').forEach(function (other) {
      setState(other, state);
    });
    var cta = document.querySelector('.sticky-cta');
    if (cta) cta.classList.remove('is-visible');
  }

  function setupForms() {
    document.querySelectorAll('form.signup').forEach(function (form) {
      var input = form.querySelector('.input');

      form.addEventListener('submit', function (ev) {
        ev.preventDefault();
        var email = (input.value || '').trim().toLowerCase();
        var valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

        if (!valid) {
          setState(form, 'error', 'Email-Adresse pr&uuml;fen.');
          return;
        }

        setState(form, 'sending');

        fetch('https://peaking-ai-api.peaking.workers.dev/newsletter/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, brand: 'vegetarianhulk' })
        })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            return { res: res, data: data };
          });
        })
        .then(function (r) {
          if (r.res.ok && r.data.ok) {
            try { localStorage.setItem(LS_KEY, 'true'); } catch (e) {}
            syncAllFormsSuccess(r.data.already ? 'already' : 'success');
            return;
          }
          // 503 Brevo not configured → mailto fallback (smooth)
          if (r.res.status === 503) {
            try { localStorage.setItem(LS_KEY, 'true'); } catch (e) {}
            var subject = encodeURIComponent('3-Tage-Reset bitte');
            var body = encodeURIComponent(
              'Hi Sebi,\n\nbitte schick mir den 3-Tage-Disziplin-Reset.\n\nMeine Mail: ' + email + '\n\nDanke!'
            );
            window.location.href = 'mailto:info@vegetarianhulk.de?subject=' + subject + '&body=' + body;
            syncAllFormsSuccess('success');
            return;
          }
          throw new Error(r.data.error || ('Status ' + r.res.status));
        })
        .catch(function (err) {
          setState(form, 'error', 'Konnt nicht senden. Schreib mir direkt: info@vegetarianhulk.de');
          console.error('[newsletter] submit failed:', err);
        });
      });

      // Live-clear error on input
      input.addEventListener('input', function () {
        var card = form.closest('.form-card');
        if (card.dataset.state === 'error') setState(form, 'idle');
      });
    });
  }

  // ── Boot ─
  document.addEventListener('DOMContentLoaded', function () {
    applyVariant();
    setupForms();
    setupReveal();
    setupStickyCta();
    applyUrlState();
  });
})();
