/* ============================================================
   vegetarianhulk · <vh-danke-block>
   Gemeinsamer "Danke an meine Smashies"-Block — Single Source of
   Truth. Identisch am Ende von /lieblingsprodukte UND /codes.
   Kein Copy-Paste-Drift.

   - Smashy-Maskottchen: <img> mit fix reserviertem Seitenverhältnis
     (aspect-ratio 1/1) → kein CLS, egal ob das PNG (noch) lädt.
     Fehlt/lädt nicht → Fallback-Platzhalter (Block bricht nie).
   - Ton: gentle-giant, Forest Family. Anonym, keine echten Namen.
   - Shadow DOM + hartkodierte Forest-Family-Styles = pixelgleich
     auf jeder Seite.
   ============================================================ */
(function () {
  'use strict';

  // ?v bei Bild-Update mit hochzählen (IG-In-App-Browser cached aggressiv;
  // danke-block.js wird beim Hash-Bump ohnehin neu ausgeliefert).
  var MASCOT_SRC = '/assets/img/smashy-maskottchen.png?v=3';

  var TEMPLATE = '' +
    '<style>' +
    '  :host { display: block; }' +
    '  * { box-sizing: border-box; }' +
    '  .wrap {' +
    '    max-width: 520px; margin: 0 auto; text-align: center;' +
    /* Inhalt als zentrierte Spalte — horizontal UND vertikal mittig.
       min-height = reservierte Höhe (CLS-stabil), Inhalt zentriert sich
       darin statt oben anzukleben; padding symmetrisch (oben=unten). */
    '    display: flex; flex-direction: column; align-items: center; justify-content: center;' +
    '    min-height: 416px; padding: 30px 24px;' +
    '    position: relative; overflow: hidden;' +
    '    background: linear-gradient(158deg, #F8F2E2 0%, #F0E7D2 55%, #E4D8BC 100%);' +
    '    border: 1px solid rgba(24,43,31,0.1); border-radius: 20px;' +
    '    box-shadow: inset 0 1px 0 rgba(255,255,255,0.75), 0 2px 6px rgba(20,40,28,0.06), 0 30px 60px -30px rgba(4,89,39,0.34);' +
    '  }' +
    '  .wrap::before { content: ""; position: absolute; left: 0; right: 0; top: 0; height: 3px;' +
    '    background: linear-gradient(90deg, transparent, rgba(4,89,39,0.5), transparent); }' +
    '  @media (min-width: 600px) { .wrap { min-height: 398px; } }' +
    '  .mascot {' +
    '    width: 150px; aspect-ratio: 1 / 1; margin: 0 auto 14px;' +
    '    position: relative;' +  /* frei schwebend — kein Tile/Border/BG; aspect-ratio reserviert Platz (kein CLS) */
    '  }' +
    '  .mascot img { width: 100%; height: 100%; object-fit: contain; display: block;' +
    '    filter: drop-shadow(0 10px 14px rgba(10,42,31,0.22)); }' +
    '  .mascot .fallback {' +
    '    position: absolute; inset: 0; display: flex; flex-direction: column;' +
    '    align-items: center; justify-content: center; gap: 6px; color: #045927;' +
    '  }' +
    '  .mascot .fallback span {' +
    '    font-family: "Inter", system-ui, sans-serif; font-size: 10px; font-weight: 800;' +
    '    letter-spacing: 1.5px; text-transform: uppercase; color: #5c513f;' +
    '  }' +
    '  .kicker {' +
    '    font-family: "Inter", system-ui, sans-serif; font-size: 11px; font-weight: 800;' +
    '    letter-spacing: 2.5px; text-transform: uppercase; color: #1a3d28; margin: 0 0 10px;' +
    '  }' +
    '  h2 {' +
    '    font-family: "Playfair Display", Georgia, serif; font-size: 26px; font-weight: 700;' +
    '    line-height: 1.15; color: #1a1410; margin: 0 0 12px;' +
    '  }' +
    '  p {' +
    '    font-family: "Inter", system-ui, sans-serif; font-size: 15px; line-height: 1.6;' +
    '    color: #5c513f; margin: 0 auto; max-width: 420px;' +
    '  }' +
    '  p strong { color: #045927; font-weight: 700; }' +
    '  @media (min-width: 600px) { .mascot { width: 180px; } h2 { font-size: 29px; } }' +
    '</style>' +
    '<div class="wrap">' +
    '  <div class="mascot">' +
    '    <img alt="Smashy Maskottchen" width="140" height="140" loading="eager" decoding="async" ' +
    '         onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';" />' +
    '    <div class="fallback" style="display:none" aria-hidden="true">' +
    '      <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 4 13C4 8 8 4 20 4c0 12-4 16-9 16z"/><path d="M12 11c-3 2-5 5-6 9"/></svg>' +
    '      <span>Smashy</span>' +
    '    </div>' +
    '  </div>' +
    '  <p class="kicker">Smashies</p>' +
    '  <h2>Danke an meine Smashies</h2>' +
    '  <p>Jeder Kauf über meine Links hält das hier am Laufen — <strong>ohne Mehrkosten für dich</strong>. Danke, dass ihr Teil der Smashies seid.</p>' +
    '</div>';

  function VhDanke() { return Reflect.construct(HTMLElement, [], VhDanke); }
  VhDanke.prototype = Object.create(HTMLElement.prototype);
  VhDanke.prototype.constructor = VhDanke;

  VhDanke.prototype.connectedCallback = function () {
    if (this._wired) return;
    this._wired = true;
    var root = this.attachShadow({ mode: 'open' });
    root.innerHTML = TEMPLATE;
    // src erst nach dem Wiring setzen, damit onerror sicher greift
    var img = root.querySelector('.mascot img');
    if (img) img.src = MASCOT_SRC;
  };

  if (window.customElements && !customElements.get('vh-danke-block')) {
    customElements.define('vh-danke-block', VhDanke);
  }
})();
