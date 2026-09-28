/* uebergang.js — der Seitenwechsel weiss, wohin es geht (28.09.2026).
 *
 * WARUM
 * Der Wechsel war auf allen Seiten dieselbe Blende. Und nur EINE von fuenf
 * Touren hatte den Foto-Uebergang von der Uebersicht auf die Tourseite: die
 * angepinnte. Die anderen vier trugen auf der Tourseite einen Namen, zu dem
 * es in der Liste kein Gegenstueck gab. Jetzt:
 *   · RICHTUNG — tiefer in die Seite steigt der Inhalt von unten auf, zurueck
 *     kommt er von oben (Typ `hoch` / `runter`, sonst `quer`).
 *   · FOTO — das angeklickte Tourbild waechst in das Hero der Tourseite, fuer
 *     jede Tour und auch auf dem Rueckweg.
 *
 * WARUM IM <head> UND OHNE defer
 * `pagereveal` feuert vor dem ersten Zeichnen der neuen Seite. Ein Skript mit
 * `defer` am Seitenende kommt dafuer zu spaet — der Typ faellt still aus.
 *
 * Firefox kennt Seitenuebergaenge noch nicht: dort ist `e.viewTransition`
 * null, und hier passiert nichts. Nichts Funktionales haengt daran.
 */
(function () {
  'use strict';
  if (!('onpagereveal' in window)) return;

  var NAME = /^tour-[a-z0-9-]+$/;

  function tiefe(url) {
    return new URL(url, location.href).pathname.replace(/\/index\.html$/, '/')
      .split('/').filter(Boolean).length;
  }
  function tourSlug(url) {
    var m = new URL(url, location.href).pathname.match(/^\/touren\/([a-z0-9-]+)\/?$/);
    return m ? m[1] : null;
  }
  function richtung(von, nach) {
    var a = tiefe(von), b = tiefe(nach);
    return b > a ? 'hoch' : b < a ? 'runter' : 'quer';
  }
  function sichtbar(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  /* Auf der Uebersicht darf jeder Tour-Name nur EINMAL stehen — zwei gleiche
     brechen den ganzen Uebergang ab. Deshalb erst alle abnehmen, dann genau
     einen setzen. */
  function alleAbnehmen() {
    document.querySelectorAll('[style*="view-transition-name"]').forEach(function (el) {
      if (NAME.test(el.style.viewTransitionName)) el.style.viewTransitionName = '';
    });
  }
  function benennen(el, slug) {
    el.style.viewTransitionName = 'tour-' + slug;
    el.style.viewTransitionClass = 'tour';
  }

  /* Das Bild auf der Uebersicht, das zu dieser Tour gehoert: die Pin-Kachel,
     wenn sie genau diese Tour zeigt, sonst das Foto in ihrer Listenzeile. */
  function bildAufUebersicht(slug, geklickt) {
    var pin = document.querySelector('a.tk-pin[href="/touren/' + slug + '/"] .tk-pin__photo');
    if (geklickt && geklickt.closest('a.tk-pin') && sichtbar(pin)) return pin;
    var link = document.querySelector('.tk-row a[href="/touren/' + slug + '/"]');
    var zeile = link && link.closest('.tk-row');
    var bild = zeile && zeile.querySelector('.tk-row__eng');
    if (sichtbar(bild)) return bild;
    return sichtbar(pin) ? pin : null;
  }

  var zuletztGeklickt = null;
  document.addEventListener('click', function (e) {
    zuletztGeklickt = e.target.closest ? e.target.closest('a') : null;
  }, true);

  /* Alte Seite, kurz bevor sie geht */
  window.addEventListener('pageswap', function (e) {
    if (!e.viewTransition || !e.activation || !e.activation.entry) return;
    var von = location.href, nach = e.activation.entry.url;
    e.viewTransition.types.add(richtung(von, nach));
    var ziel = tourSlug(nach);
    if (ziel && tiefe(von) === 1) {           /* Uebersicht -> Tour */
      alleAbnehmen();
      var bild = bildAufUebersicht(ziel, zuletztGeklickt);
      if (bild) benennen(bild, ziel);
    }
  });

  /* Neue Seite, bevor sie zum ersten Mal gezeichnet wird */
  window.addEventListener('pagereveal', function (e) {
    if (!e.viewTransition || !window.navigation || !navigation.activation) return;
    var a = navigation.activation;
    if (!a.from || !a.entry) return;
    e.viewTransition.types.add(richtung(a.from.url, a.entry.url));
    var herkunft = tourSlug(a.from.url);
    if (herkunft && tiefe(a.entry.url) === 1) {   /* Tour -> Uebersicht */
      var setzen = function () {
        alleAbnehmen();
        var bild = bildAufUebersicht(herkunft, null);
        if (bild) benennen(bild, herkunft);
      };
      /* Beim Zeichnen steht das DOM, beim ganz fruehen Aufruf noch nicht. */
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', setzen, { once: true });
      else setzen();
    }
    e.viewTransition.finished.then(function () {
      document.querySelectorAll('.tk-row__eng, .tk-pin__photo').forEach(function (el) {
        if (el.style.viewTransitionClass) { el.style.viewTransitionName = ''; el.style.viewTransitionClass = ''; }
      });
    });
  });
})();
