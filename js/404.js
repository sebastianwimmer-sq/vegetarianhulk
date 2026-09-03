/* Ausgelagert aus 404.html am 03.09.2026.
   Grund: mit einem Inline-<script> laesst sich script-src nicht auf 'self'
   setzen — 'unsafe-inline' erlaubt sonst jedes eingeschleuste Skript.
   Einbindung mit defer an derselben Stelle, damit das Timing gleich bleibt. */
// Footer-Jahr dynamisch
  (function () {
    var y = new Date().getFullYear();
    document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = y; });
  })();

  // Verstiegen-Wegweiser: getippten Pfad anzeigen (textContent = safe)
  (function () {
    var el = document.querySelector('[data-err-path]');
    if (el) {
      var path = (location.pathname || '/') + (location.search || '');
      if (path.length > 48) path = path.slice(0, 47) + '…';
      el.textContent = path;
    }
  })();

  // Self-Service-404-Debug: console.warn + sessionStorage-Log (max 20)
  (function () {
    try {
      var path = location.pathname + location.search;
      var ref = document.referrer || 'direct';
      console.warn('[vh:404] Path:', path, '· From:', ref);
      var log = JSON.parse(sessionStorage.getItem('vh:404:log') || '[]');
      log.push({ ts: Date.now(), path: path, from: ref });
      if (log.length > 20) log = log.slice(-20);
      sessionStorage.setItem('vh:404:log', JSON.stringify(log));
    } catch (e) { /* sessionStorage disabled — ignore */ }
  })();
