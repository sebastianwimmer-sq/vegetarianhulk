/* radar-test.mjs — der Weihnachtsmarkt-Radar im Browser, am Ergebnis gemessen.
 *
 *   node scripts/markt/radar-test.mjs            # prueft, Exit 1 bei Befund
 *   node scripts/markt/radar-test.mjs --bilder   # legt zusaetzlich Bildschirmfotos nach $TMPDIR/radar-bilder
 *
 * Gemessen wird, was ein Mensch sieht: Karten nach der Suche, Wirkung der Filter,
 * Fehlermeldung bei falscher Postleitzahl, Quittung der Rueckmeldung erst nach Server-OK.
 */
import { pruefserver } from '../pruefserver.mjs';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const PW = '/opt/homebrew/lib/node_modules/playwright/index.mjs';
const { chromium, webkit, devices } = await import(PW);
const WURZEL = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const BILDER = process.argv.includes('--bilder') ? join(tmpdir(), 'radar-bilder') : null;
if (BILDER) mkdirSync(BILDER, { recursive: true });
const maerkte = JSON.parse(readFileSync(join(WURZEL, 'weihnachtsmarkt/daten/maerkte.json'), 'utf8'));
const PLZ = '84489';                      // Burghausen: dort kennen wir Maerkte in jedem Umkreis
const befunde = [];
const pruef = (ok, text) => { if (!ok) befunde.push(text); };

const { basis, schliessen } = await pruefserver(WURZEL);
const karten = (s) => s.locator('.wm-karte').count();

async function ablauf(browser, kontext, pfad, name, sprache) {
  const k = await browser.newContext(kontext);
  const s = await k.newPage();
  const fehler = [];
  let quittung = { status: 200, body: '{"ok":true}' };
  s.on('pageerror', (e) => fehler.push(String(e)));
  // Ladefehler zaehlt die Antwort selbst (mit Adresse); die eigenen Proben (simulierter 500er, gesperrtes Turnstile) nimmt das Tor aus.
  s.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) fehler.push(m.text()); });
  s.on('response', (r) => { if (r.status() >= 400 && !/vh-forms\.peaking\.workers\.dev/.test(r.url())) fehler.push(`${r.status()} ${r.url()}`); });
  s.on('requestfailed', (r) => { if (!/challenges\.cloudflare\.com|vh-forms\.peaking/.test(r.url())) fehler.push(`nicht geladen ${r.url()}`); });
  await s.route('**/vh-forms.peaking.workers.dev/**', (r) => r.fulfill({ ...quittung, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' } }));
  await s.route('**/challenges.cloudflare.com/**', (r) => r.abort());
  await s.goto(basis + pfad);
  pruef((await s.locator('html').getAttribute('lang')) === sprache, `${name}: Sprache der Seite ist nicht ${sprache}`);

  // Erste Handlung ueber dem Falz
  const knopf = await s.locator('#wm-form .wm-knopf').boundingBox();
  pruef(knopf && knopf.y + knopf.height <= s.viewportSize().height, `${name}: „Suchen“ liegt unter dem Falz (${Math.round(knopf?.y ?? -1)} px bei ${s.viewportSize().height})`);
  pruef(await s.locator('.wm-rueck').isHidden(), `${name}: Rückmeldung ist vor der Suche sichtbar`);
  pruef(await s.locator('.wm-arbeit').isHidden(), `${name}: Filter und Treffer sind vor der Suche sichtbar`);
  await s.waitForFunction(() => /\d/.test(document.querySelector('.wm-vertrauen').textContent), null, { timeout: 5000 }).catch(() => pruef(false, `${name}: Zeile unter der Suche nennt keine Zahl`));

  // Falsche Eingabe sagt, was zu tun ist
  await s.fill('#wm-plz', '123'); await s.click('#wm-form .wm-knopf');
  pruef(await s.locator('#wm-form .wm-fehler').isVisible(), `${name}: keine Meldung bei dreistelliger Postleitzahl`);
  await s.fill('#wm-plz', '00000'); await s.click('#wm-form .wm-knopf');
  await s.waitForFunction(() => !document.querySelector('#wm-form .wm-fehler').hidden);
  pruef((await karten(s)) === 0, `${name}: Karten trotz unbekannter Postleitzahl`);

  // Suche liefert Karten mit Name, Termin und Quelle
  await s.fill('#wm-plz', PLZ); await s.click('#wm-form .wm-knopf');
  await s.waitForFunction(() => document.querySelectorAll('.wm-karte').length > 0);
  // endliche Bewegung zu Ende fahren, dann messen: was danach unsichtbar ist, ist ein Befund
  await s.evaluate(() => document.getAnimations().forEach((a) => { if (a.effect?.getComputedTiming().iterations !== Infinity) a.finish(); }));
  const sicht = await s.locator('.wm-karte').first().evaluate((e) => ({ o: getComputedStyle(e).opacity, h: e.getBoundingClientRect().height }));
  pruef(sicht.o === '1' && sicht.h > 80, `${name}: erste Karte nach der Bewegung nicht sichtbar (Deckkraft ${sicht.o}, Höhe ${Math.round(sicht.h)})`);
  const n25 = await s.locator('.wm-tag').first().locator('span').last().innerText();
  const erste = s.locator('.wm-karte').first();
  pruef((await erste.locator('h3').innerText()).length > 3, `${name}: erste Karte ohne Namen`);
  pruef(/\d/.test(await erste.locator('.wm-wann').innerText()), `${name}: erste Karte ohne Termin`);
  pruef((await erste.locator('.wm-quelle').innerText()).length > 12, `${name}: erste Karte ohne Quelle`);
  pruef(new URL(s.url()).searchParams.get('plz') === PLZ, `${name}: Postleitzahl steht nicht in der Adresse`);
  // Ordnung: breit steht die Filterleiste links neben der Tafel, schmal steht die Zahl über den Filtern und die über der Tafel
  const lage = await s.evaluate(() => { const r = (q) => document.querySelector(q).getBoundingClientRect(); return { zahl: r('.wm-zahl'), filter: r('.wm-filter'), liste: r('.wm-liste'), breit: innerWidth >= 900 }; });
  if (lage.breit) pruef(lage.filter.right <= lage.liste.left && lage.filter.top < lage.liste.top + 200, `${name}: Filterleiste steht nicht links neben den Treffern (Filter rechts ${Math.round(lage.filter.right)}, Tafel links ${Math.round(lage.liste.left)})`);
  else pruef(lage.zahl.bottom <= lage.filter.top && lage.filter.bottom <= lage.liste.top, `${name}: Reihenfolge Zahl, Filter, Tafel stimmt nicht (${Math.round(lage.zahl.bottom)}, ${Math.round(lage.filter.top)}, ${Math.round(lage.filter.bottom)}, ${Math.round(lage.liste.top)})`);
  // Kalender: der erste Tag steht breit in der Spalte seines Wochentags (Montag = 1)
  const spalte = await s.evaluate(() => { const t = document.querySelectorAll('.wm-tag')[1], k = document.querySelectorAll('.wm-kalkopf'); const m = t.getBoundingClientRect(); return [...k].findIndex((e) => { const r = e.getBoundingClientRect(); return r.width && Math.abs((r.left + r.right) / 2 - (m.left + m.right) / 2) < 3; }) + 1; });
  if (lage.breit) pruef(spalte === (new Date().getDay() + 6) % 7 + 1, `${name}: erster Kalendertag steht in Spalte ${spalte}, heute wäre ${(new Date().getDay() + 6) % 7 + 1}`);
  // Trefferfläche der Wege reicht fürs Tippen
  const weg = await s.locator('.wm-karte .wm-wege a').first().boundingBox();
  pruef(weg && weg.height >= 44, `${name}: „Karte“ ist nur ${Math.round(weg?.height ?? 0)} px hoch`);
  if (BILDER) await s.screenshot({ path: join(BILDER, `${name}-suche.png`), fullPage: true });

  // Umkreis: 10 km zeigt nie mehr als 25 km, 100 km nie weniger
  const zahl = async () => parseInt(await s.locator('.wm-tag').first().locator('span').last().innerText(), 10);
  const z25 = await zahl();
  await s.click('#wm-umkreis [data-km="10"]'); const z10 = await zahl();
  await s.click('#wm-umkreis [data-km="100"]'); const z100 = await zahl();
  pruef(z10 <= z25 && z25 <= z100 && z100 > z10, `${name}: Umkreis wirkt nicht (10 km ${z10}, 25 km ${z25}, 100 km ${z100}; erste Angabe ${n25})`);

  // Art: ein Filter verkleinert die Menge und laesst nur passende Namen uebrig
  const art = s.locator('#wm-arten .wm-wahl').first();
  pruef(await art.isVisible(), `${name}: kein Art-Filter bei 100 km`);
  await art.click(); const zArt = await zahl();
  pruef(zArt > 0 && zArt < z100, `${name}: Art-Filter wirkt nicht (${zArt} von ${z100})`);
  await art.click();

  // Tag: eine goldene Kugel zeigt nur Maerkte, die an dem Tag offen sind
  const kugel = s.locator('.wm-tag.wm-hat').nth(1);
  if (await kugel.count()) {
    const angabe = parseInt(await kugel.locator('span').last().innerText(), 10);
    await kugel.click();
    const sichtbar = await karten(s), mehr = await s.locator('.wm-mehr').count();
    pruef(mehr ? sichtbar === 12 : sichtbar === angabe, `${name}: Tag zeigt ${sichtbar} Karten, die Kugel sagt ${angabe}`);
    await s.locator('.wm-tag').first().click();
  } else pruef(false, `${name}: nicht gemessen – kein Tag mit offenem Markt in 100 km um ${PLZ}`);

  // Rueckmeldung: Fehler vom Server zeigt keine Quittung, Erfolg schon
  await s.locator('.wm-rueck').scrollIntoViewIfNeeded();
  await s.click('#wm-r-nein');
  await s.click('.wm-r-nein .wm-knopf');
  pruef(await s.locator('.wm-r-meldung').isVisible(), `${name}: „Nein“ ohne Text wird angenommen`);
  await s.fill('#wm-r-text-nein', 'Probe aus dem Prüflauf');
  quittung = { status: 500, body: '{"ok":false}' };
  await s.click('.wm-r-nein .wm-knopf');
  await s.waitForFunction(() => !document.querySelector('.wm-r-meldung').hidden && /@/.test(document.querySelector('.wm-r-meldung').textContent));
  pruef(await s.locator('.wm-r-fertig').isHidden(), `${name}: Quittung trotz Serverfehler`);
  quittung = { status: 200, body: '{"ok":true}' };
  await s.click('.wm-r-nein .wm-knopf');
  await s.waitForFunction(() => !document.querySelector('.wm-r-fertig').hidden);
  if (BILDER) await s.screenshot({ path: join(BILDER, `${name}-ende.png`), fullPage: true });

  pruef(await s.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${name}: Seite ist breiter als der Schirm`);
  pruef(fehler.length === 0, `${name}: Konsolenfehler: ${fehler.slice(0, 3).join(' | ')}`);
  await k.close();
}

pruef(maerkte.length > 300, `nicht gemessen: nur ${maerkte.length} Märkte in den Daten`);
const chrom = await chromium.launch(), safari = await webkit.launch();
try {
  await ablauf(chrom, { viewport: { width: 1280, height: 900 } }, '/weihnachtsmarkt/', 'desktop-de', 'de');
  await ablauf(safari, devices['iPhone 15 Pro'], '/weihnachtsmarkt/', 'iphone-de', 'de');
  await ablauf(safari, devices['iPhone SE'], '/en/christmas-markets/', 'iphone-se-en', 'en');
  // Ruhig: kein Halte-Knopf, Karten trotzdem sichtbar
  const k = await chrom.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const s = await k.newPage();
  await s.goto(`${basis}/weihnachtsmarkt/?plz=${PLZ}`);
  await s.waitForFunction(() => document.querySelectorAll('.wm-karte').length > 0);
  pruef(await s.locator('.wm-halt').isHidden(), 'ruhig: Halte-Knopf sichtbar, obwohl nichts läuft');
  pruef((await s.locator('.wm-karte').first().evaluate((e) => getComputedStyle(e).opacity)) === '1', 'ruhig: erste Karte nicht voll sichtbar');
  await k.close();
} catch (e) {
  befunde.push(`Lauf abgebrochen (nicht gemessen): ${String(e).slice(0, 300)}`);
} finally {
  await chrom.close(); await safari.close(); await schliessen();
}
for (const b of befunde) console.log('ROT ', b);
if (befunde.length) { console.log(`${befunde.length} Befunde`); process.exit(1); }
console.log('GRÜN Radar: Suche, Umkreis, Art, Tag, Rückmeldung, drei Geräte, ruhig' + (BILDER ? ` · Bilder in ${BILDER}` : ''));
