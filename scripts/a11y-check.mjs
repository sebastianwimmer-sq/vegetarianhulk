#!/usr/bin/env node
/**
 * a11y-check.mjs — Barrierefreiheits-Tor fuer alle v3-Seiten.
 *
 *   node scripts/a11y-check.mjs            # alle v3-Seiten
 *   node scripts/a11y-check.mjs /touren/   # einzelne Seite
 *
 * Warum selbst gebaut: axe/pa11y sind hier nicht installiert, und die Site
 * soll sich ohne Netz-Abhaengigkeit pruefen lassen. Geprueft wird das, was bei
 * einer Lese-Seite wirklich zaehlt und was ein Mensch beim Durchklicken merkt:
 *
 *   · Kontrast von Text gegen seinen tatsaechlichen Hintergrund (WCAG 2.2 AA:
 *     4,5:1 normal · 3:1 ab 24px bzw. 18,66px fett)
 *   · Bilder ohne alt — leeres alt="" ist ERLAUBT und korrekt fuer Deko
 *   · Bedienelemente ohne zugaenglichen Namen
 *   · Ueberschriften-Hierarchie (genau eine h1, keine uebersprungenen Ebenen)
 *   · Landmarken (main/nav) und lang-Attribut
 *   · Tippziele unter 44x44 px (WCAG 2.2 AA, 2.5.8 Target Size)
 *   · sichtbarer Fokus auf allen fokussierbaren Elementen
 *
 * Exit 1 bei FEHLER. HINWEIS blockt nicht — ein Tor, das bei jedem zweiten
 * Fall grundlos rot steht, wird ignoriert.
 */
import { spawn } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8247;
const PW = '/opt/homebrew/lib/node_modules/playwright/index.mjs';

function v3Seiten() {
  const treffer = [];
  const suche = (verzeichnis, tiefe) => {
    for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
      if (eintrag.name.startsWith('.') || ['node_modules', 'design', 'fonts', '_preview',
        'email-templates', 'design-archives'].includes(eintrag.name)) continue;
      const voll = join(verzeichnis, eintrag.name);
      if (eintrag.isDirectory() && tiefe < 2) suche(voll, tiefe + 1);
      else if (eintrag.name.endsWith('.html') && readFileSync(voll, 'utf8').includes('v3.css')) {
        treffer.push('/' + voll.slice(WURZEL.length + 1).replace(/index\.html$/, ''));
      }
    }
  };
  suche(WURZEL, 0);
  return treffer.sort();
}

/* Im Browser ausgefuehrt. Bewusst ohne Bibliothek, damit das Tor
   ohne Netz und ohne Installation laeuft. */
function pruefeImBrowser() {
  const fehler = [];
  const hinweise = [];

  const sichtbar = (el) => {
    // aria-hidden mitpruefen: das Honeypot-Feld im Anfrageformular ist mit
    // Absicht unsichtbar und war sonst als Kontrastfehler gemeldet worden.
    if (el.closest('[aria-hidden="true"]')) return false;
    const r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'
      && parseFloat(s.opacity) > 0.05;
  };
  const kurz = (el) => {
    const k = String(el.className || '').split(' ')[0];
    return el.tagName.toLowerCase() + (k ? '.' + k : '');
  };

  /* ---- Kontrast ---- */
  const zuRgb = (farbe) => {
    const m = farbe.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const t = m[1].split(',').map(parseFloat);
    return { r: t[0], g: t[1], b: t[2], a: t.length > 3 ? t[3] : 1 };
  };
  const mischen = (vorn, hinten) =>
    ({ r: vorn.r * vorn.a + hinten.r * (1 - vorn.a),
       g: vorn.g * vorn.a + hinten.g * (1 - vorn.a),
       b: vorn.b * vorn.a + hinten.b * (1 - vorn.a), a: 1 });
  const leuchtkraft = ({ r, g, b }) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const verhaeltnis = (a, b) => {
    const l1 = leuchtkraft(a), l2 = leuchtkraft(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  /* Echten Hintergrund suchen: transparente Eltern durchgehen, bis Farbe kommt.
     Trifft die Kette einen VERLAUF, ist die Farbe hier nicht bestimmbar — dann
     gibt es kein Ergebnis statt eines falschen. Der erste Entwurf pruefte nur
     backgroundColor; bei den Papier- und Wald-Flaechen (radial-gradient) ist die
     transparent, also rechnete er gegen Weiss und meldete 1,04:1 fuer dunklen
     Text auf hellem Grund. 140 erfundene Fehler, keiner davon echt. */
  /* Aus einem Verlauf alle Farbstopps ziehen. Geprueft wird dann gegen den
     UNGUENSTIGSTEN — wenn der Text auf der hellsten Stelle des Verlaufs noch
     lesbar ist, ist er es ueberall. Ohne das blieben 90 % der Textstellen
     ungeprueft, weil die Flaechen der Site fast alle Verlaeufe sind. */
  const stopsAus = (bild) => {
    const treffer = bild.match(/rgba?\([^)]+\)/g) || [];
    return treffer.map(zuRgb).filter((f) => f && f.a > 0.15);
  };
  const hintergrundVon = (el) => {
    let knoten = el;
    const gestapelt = [];
    while (knoten && knoten !== document.documentElement) {
      const s = getComputedStyle(knoten);
      const bild = s.backgroundImage;
      if (bild && bild !== 'none') {
        if (!/gradient/.test(bild)) return null;          // echtes Foto: nicht rechenbar
        const stops = stopsAus(bild);
        if (!stops.length) return null;
        // deckende Stopps beenden die Suche nach oben
        const deckend = stops.filter((f) => f.a >= 0.99);
        if (deckend.length) return { varianten: deckend, gestapelt };
        stops.forEach((f) => gestapelt.push(f));
      }
      const bg = zuRgb(s.backgroundColor);
      if (bg && bg.a > 0) { gestapelt.push(bg); if (bg.a >= 0.99) break; }
      knoten = knoten.parentElement;
    }
    let ergebnis = { r: 255, g: 255, b: 255, a: 1 };
    for (let i = gestapelt.length - 1; i >= 0; i--) ergebnis = mischen(gestapelt[i], ergebnis);
    return { varianten: [ergebnis], gestapelt: [] };
  };

  const textKnoten = [...document.querySelectorAll('p, li, a, span, h1, h2, h3, h4, dt, dd, button, label, figcaption, small, strong, em')]
    .filter((el) => sichtbar(el))
    .filter((el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1));

  const soll_ = (s) => {
    const groesse = parseFloat(s.fontSize);
    const fett = parseInt(s.fontWeight, 10) >= 700;
    return (groesse >= 24 || (fett && groesse >= 18.66)) ? 3 : 4.5;
  };
  const gesehen = new Set();
  let nichtMessbar = 0;
  for (const el of textKnoten) {
    const s = getComputedStyle(el);
    // Text auf einem Foto laesst sich so nicht messen — dort entscheidet der Scrim.
    let aufBild = false, k = el;
    while (k && k !== document.body) {
      if (getComputedStyle(k).backgroundImage !== 'none' && !/gradient/.test(getComputedStyle(k).backgroundImage)) { aufBild = true; break; }
      k = k.parentElement;
    }
    if (aufBild || s.textShadow !== 'none') continue;
    /* 3D-transformierte Elemente (die Wegweiser-Schilder auf der Startseite
       stehen auf rotateY) lassen sich so nicht messen: die Box stimmt nicht
       mehr mit dem gerenderten Bild ueberein, und der Grund wird vom falschen
       Vorfahren geholt. Ergebnis war 1,29:1 fuer ein Schild, das per Auge
       einwandfrei lesbar ist (gegengeprueft am Screenshot). */
    if (s.transform && /matrix3d|rotate[XY]/.test(s.transform)) { nichtMessbar++; continue; }
    // Deko: liegt hinter dem Inhalt und ist nicht anklickbar (z. B. die grosse
    // Ziffer als Wasserzeichen auf den Partner-Picks-Karten, 9 % Deckung).
    if (s.pointerEvents === 'none' && parseFloat(s.zIndex || '0') <= 0) continue;
    // Flaechen aus Pseudo-Elementen: .gab-schild traegt sein Gold auf einem
    // ::before. getComputedStyle sieht das beim Element selbst nicht — dann
    // lieber nicht messen als falsch messen.
    const pseudo = getComputedStyle(el, '::before');
    if (pseudo && pseudo.content !== 'none' && pseudo.backgroundColor
        && !/rgba\(0, 0, 0, 0\)/.test(pseudo.backgroundColor)) { nichtMessbar++; continue; }

    const vorn = zuRgb(s.color);
    if (!vorn) continue;
    const grund = hintergrundVon(el);
    if (!grund) { nichtMessbar++; continue; }
    /* Mittelwert der Verlaufs-Stopps, nicht der schlechteste. Ein Verlauf laeuft
       ueber die ganze Flaeche, der Text liegt selten genau auf dem Extrem — und
       trifft ein Stopp zufaellig die Textfarbe, meldete der Minimal-Ansatz 1,00:1
       fuer Text, der real gut lesbar ist (dunkel auf DAV-Gelb). Weicht der
       schlechteste Stopp stark ab, kommt das als Hinweis dazu. */
    /* Spreizen die Stopps stark (dunkles Schild mit Lichtkante), ist weder
       Mittelwert noch Extremwert verlaesslich — dann lieber "nicht messbar".
       Der Ansatz meldete sonst 1,29:1 fuer ein Wegweiser-Schild, das per Auge
       einwandfrei lesbar ist. */
    if (grund.varianten.length > 1) {
      const hell = grund.varianten.map(leuchtkraft);
      if (Math.max(...hell) - Math.min(...hell) > 0.25) { nichtMessbar++; continue; }
    }
    const mittel = grund.varianten.reduce((a, f) => ({
      r: a.r + f.r / grund.varianten.length,
      g: a.g + f.g / grund.varianten.length,
      b: a.b + f.b / grund.varianten.length, a: 1 }), { r: 0, g: 0, b: 0, a: 1 });
    const hinten = mittel;
    const v = verhaeltnis(mischen(vorn, hinten), hinten);
    const schlechtester = Math.min(...grund.varianten.map((f) => verhaeltnis(mischen(vorn, f), f)));
    if (v >= soll_(s) && schlechtester < soll_(s) - 1) {
      hinweise.push(`Verlauf: an der ungünstigsten Stelle nur ${schlechtester.toFixed(2)}:1 — ${kurz(el)}`);
    }
    const soll = soll_(s);
    if (v < soll) {
      const schluessel = kurz(el) + '|' + s.color;
      if (gesehen.has(schluessel)) continue;
      gesehen.add(schluessel);
      const zeile = `Kontrast ${v.toFixed(2)}:1 (Soll ${soll}) — ${kurz(el)} „${el.textContent.trim().slice(0, 28)}"`;
      (v < soll - 0.6 ? fehler : hinweise).push(zeile);
    }
  }

  /* ---- Bilder ---- */
  for (const img of document.images) {
    if (!img.hasAttribute('alt')) fehler.push(`Bild ohne alt: ${(img.getAttribute('src') || '').split('/').pop()}`);
  }

  /* ---- Bedienelemente ohne Namen ---- */
  for (const el of document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea')) {
    if (!sichtbar(el)) continue;
    const name = (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim()
      || (el.labels && el.labels.length ? [...el.labels].map((l) => l.textContent).join(' ').trim() : '')
      || (el.getAttribute('placeholder') || '').trim()
      || (el.querySelector('img[alt]') ? el.querySelector('img[alt]').alt : '');
    if (!name) fehler.push(`Bedienelement ohne Namen: ${kurz(el)}`);
  }

  /* ---- Ueberschriften ---- */
  const ueber = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(sichtbar);
  const h1 = ueber.filter((h) => h.tagName === 'H1').length;
  if (h1 === 0) fehler.push('keine h1');
  if (h1 > 1) hinweise.push(`${h1} h1-Elemente`);
  let vorige = 0;
  for (const h of ueber) {
    const stufe = +h.tagName[1];
    if (vorige && stufe > vorige + 1) hinweise.push(`Ueberschrift springt h${vorige} → h${stufe} („${h.textContent.trim().slice(0, 24)}")`);
    vorige = stufe;
  }

  /* ---- Struktur ---- */
  if (!document.querySelector('main')) fehler.push('kein <main>');
  if (!document.documentElement.lang) fehler.push('kein lang-Attribut');

  /* ---- Tippziele (WCAG 2.2, 2.5.8) ---- */
  const zuKlein = [];
  for (const el of document.querySelectorAll('a[href], button, input:not([type=hidden]), select')) {
    if (!sichtbar(el)) continue;
    const r = el.getBoundingClientRect();
    // Links im Fliesstext sind ausgenommen (WCAG: "inline exception")
    const imText = el.tagName === 'A' && el.parentElement
      && /^(P|LI|SPAN|DD|SMALL|STRONG|EM)$/.test(el.parentElement.tagName);
    if (imText) continue;
    if (r.width < 44 || r.height < 44) zuKlein.push(`${kurz(el)} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  if (zuKlein.length) hinweise.push(`Tippziel unter 44px: ${[...new Set(zuKlein)].slice(0, 4).join(', ')}`);

  if (nichtMessbar) hinweise.push(`${nichtMessbar} Textstellen auf Verlauf/Foto — Kontrast dort nicht rechnerisch pruefbar, per Auge kontrollieren`);
  return { fehler, hinweise };
}

/* ---------- Lauf ---------- */
const argv = process.argv.slice(2);
const seiten = argv.length ? argv : v3Seiten();

let pw;
try { pw = await import(PW); }
catch { console.error(`Playwright fehlt unter ${PW}`); process.exit(2); }

const SERVER = [
  'import sys, http.server, socketserver',
  'class S(socketserver.ThreadingMixIn, http.server.HTTPServer): daemon_threads = True',
  'h = http.server.SimpleHTTPRequestHandler',
  'h.log_message = lambda *a, **k: None',
  'S(("127.0.0.1", int(sys.argv[1])), h).serve_forever()',
].join('\n');
const server = spawn('python3', ['-c', SERVER, String(PORT)], { cwd: WURZEL, stdio: 'ignore' });
const aufraeumen = () => { try { server.kill(); } catch {} };
process.on('exit', aufraeumen);
process.on('SIGINT', () => { aufraeumen(); process.exit(130); });
await new Promise((r) => setTimeout(r, 1200));

let fehlerGesamt = 0;
const browser = await pw.chromium.launch();
for (const pfad of seiten) {
  const seite = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await seite.goto(`http://localhost:${PORT}${pfad}`, { waitUntil: 'load' });
  await seite.evaluate(() => document.fonts.ready);
  await seite.waitForTimeout(1400);
  const { fehler, hinweise } = await seite.evaluate(pruefeImBrowser);
  fehlerGesamt += fehler.length;
  console.log(`${fehler.length ? '🔴' : hinweise.length ? '🟡' : '🟢'} ${pfad.padEnd(26)} ${fehler.length} Fehler · ${hinweise.length} Hinweise`);
  for (const f of fehler) console.log('     ✗ ' + f);
  for (const h of hinweise.slice(0, 4)) console.log('     · ' + h);
  if (hinweise.length > 4) console.log(`     · … und ${hinweise.length - 4} weitere Hinweise`);
  await seite.close();
}
await browser.close();
aufraeumen();

console.log(`\n${fehlerGesamt ? fehlerGesamt + ' Fehler' : 'Keine Fehler'} über ${seiten.length} Seiten.`);
process.exit(fehlerGesamt ? 1 : 0);
