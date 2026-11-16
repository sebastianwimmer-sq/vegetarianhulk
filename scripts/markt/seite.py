#!/usr/bin/env python3
"""Erzeugt die Radar-Seite in beiden Sprachen aus EINER Vorlage (1:1 dieselbe Fläche, eigener Wortlaut).

    python3 scripts/markt/seite.py
    → weihnachtsmarkt/index.html und en/christmas-markets/index.html

Danach: node scripts/sprachen-bauen.mjs und ./scripts/bump-asset-versions.sh
"""
from pathlib import Path

WURZEL = Path(__file__).resolve().parents[2]
NAV_BERG = ('<span class="mtn"><svg viewBox="0 0 72 56" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">'
            '<path d="M6 50 26 16l10 16 8-12 22 30"/><path d="M22 23.5 26 20l4 5" opacity="0.85"/><path d="M40.5 25.5 44 21.5l3.5 5" opacity="0.85"/>'
            '<circle cx="58" cy="11" r="4.5" opacity="0.9"/><path d="M12 50c8-4 16-3.4 22 0" opacity="0.45"/></svg></span>')

T = {
    'de': dict(
        lang='de', pfad='/weihnachtsmarkt/', ziel='weihnachtsmarkt/index.html', start='/', locale='de_DE',
        titel='Weihnachtsmarkt-Radar: Märkte in deiner Nähe mit Termin | VegetarianHulk',
        beschreibung='Postleitzahl eintippen und sehen, welche Weihnachtsmärkte, Christkindlmärkte und Adventsmärkte in deinem Umkreis offen haben. Mit Termin und Quelle, für ganz Deutschland.',
        bild_alt='Christkindlmarkt bei Nacht: ein Christbaum voller Lichter, davor eine Feuerschale mit Funken, darüber ein goldener Engel',
        h1='Wo riecht es heute nach Glühwein?', unter='Weihnachtsmärkte, Christkindlmärkte und Adventsmärkte in deiner Nähe, mit Termin.',
        halt='Funken anhalten', plz='Deine Postleitzahl', suchen='Suchen', umkreis='Umkreis', arten='Was für ein Markt?', tage_label='Tag wählen',
        r_frage='Hast du gefunden, was du gesucht hast?', r_ja='Ja', r_nein='Nein',
        r_ja_titel='Schön. Wie gefällt dir der Radar?', r_ja_text='Magst du noch was dazu sagen? (freiwillig)',
        r_nein_titel='Was hat gefehlt?', g1='Ein Markt fehlt', g2='Ein Termin stimmt nicht', g3='Etwas anderes',
        r_markt='Welcher Markt, in welchem Ort? (freiwillig)', r_nein_text='Schreib kurz, was gefehlt hat', senden='Abschicken', falle='Dieses Feld bitte leer lassen',
        r_hinweis='Mit dem Abschicken geht dein Text an mich, dazu die ersten zwei Ziffern deiner Postleitzahl und der Umkreis. Mehr in der <a href="/datenschutz.html#radar">Datenschutzerklärung</a>.',
        tisch_alt='Holztisch im Kerzenlicht mit Glühwein, Zimtsternen, Orangen mit Nelken und Zimtstangen',
        tisch_titel='Magst du mehr von draußen?', tisch_text='Im Letter schreibe ich, was ich am Berg und unterwegs erlebe. Zum Einstieg gibt es den Berg-Starter.',
        bilder='Die beiden Bilder auf dieser Seite sind mit KI erzeugt.',
        claim='Builder &amp; Creator. Disziplin über Hype.', legal='Rechtliches', impressum='Impressum', datenschutz='Datenschutz', recht_attr='',
        nav_label='Hauptnavigation', nav=[('/', 'Start'), ('/partner-picks/', 'P&amp;P'), ('/touren/', 'Hulk&nbsp;Hikes'), ('/newsletter', 'News'), ('/kooperationen.html', 'Brands')],
    ),
    'en': dict(
        lang='en', pfad='/en/christmas-markets/', ziel='en/christmas-markets/index.html', start='/en/', locale='en_GB',
        titel='Christmas Market Radar: German markets near you, with dates | VegetarianHulk',
        beschreibung='Type a German postcode and see which Christmas markets are open near you. With dates and sources, for all of Germany.',
        bild_alt='A Bavarian Christmas market at night: a tree full of lights, a fire bowl with sparks in front, a golden angel above',
        h1='Where does it smell of mulled wine today?', unter='Christmas markets in Germany near you, with dates.',
        halt='Pause sparks', plz='Your German postcode', suchen='Search', umkreis='Radius', arten='What kind of market?', tage_label='Pick a day',
        r_frage='Did you find what you were looking for?', r_ja='Yes', r_nein='No',
        r_ja_titel='Great. How do you like the radar?', r_ja_text='Anything you want to add? (optional)',
        r_nein_titel='What was missing?', g1='A market is missing', g2='A date is wrong', g3='Something else',
        r_markt='Which market, in which town? (optional)', r_nein_text='Tell me briefly what was missing', senden='Send', falle='Please leave this field empty',
        r_hinweis='When you send this, your text goes to me, together with the first two digits of your postcode and the radius. More in the <a href="/datenschutz.html#radar" hreflang="de">privacy policy (German)</a>.',
        tisch_alt='A wooden table in candlelight with mulled wine, cinnamon stars, clove-studded oranges and cinnamon sticks',
        tisch_titel='Want more from the outdoors?', tisch_text='In my letter I write about what I experience in the mountains and on the road. You get the Hike Starter to begin with.',
        bilder='Both images on this page are AI-generated.',
        claim='Builder &amp; creator. Discipline over hype.', legal='Legal', impressum='Legal notice (German)', datenschutz='Privacy (German)', recht_attr=' hreflang="de"',
        nav_label='Main navigation', nav=[('/en/', 'Home'), ('/en/partner-picks/', 'P&amp;P'), ('/en/hikes/', 'Hulk&nbsp;Hikes'), ('/en/newsletter/', 'News'), ('/en/brands/', 'Brands')],
    ),
}

VORLAGE = '''<!DOCTYPE html>
<html lang="{lang}">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self' https://challenges.cloudflare.com https://*.challenges.cloudflare.com https://vh-forms.peaking.workers.dev; base-uri 'none'; form-action 'self'; frame-src https://challenges.cloudflare.com">
<meta name="referrer" content="strict-origin-when-cross-origin">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>{titel}</title>
<meta name="description" content="{beschreibung}">
<link rel="canonical" href="https://vegetarianhulk.de{pfad}">
<meta name="theme-color" content="#1a0907">
<meta property="og:type" content="website">
<meta property="og:title" content="{titel}">
<meta property="og:description" content="{beschreibung}">
<meta property="og:url" content="https://vegetarianhulk.de{pfad}">
<meta property="og:image" content="https://vegetarianhulk.de/weihnachtsmarkt/img/christbaum.webp">
<meta property="og:locale" content="{locale}">
<meta property="og:site_name" content="VegetarianHulk">
<meta name="twitter:card" content="summary_large_image">

<link rel="icon" href="/favicon-96.png" sizes="96x96" type="image/png">
<link rel="icon" href="/favicon-48.png" sizes="48x48" type="image/png">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">

<link rel="preload" href="/fonts/playfair-normal-latin.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/weihnachtsmarkt/img/christbaum.webp" as="image" fetchpriority="high">
<link rel="stylesheet" href="/fonts.css?v=0">
<link rel="stylesheet" href="/v3.css?v=0">
<link rel="stylesheet" href="/weihnachtsmarkt/radar.css?v=0">
<script src="/newsletter-form.js?v=0" defer></script>
</head>
<body class="wm-seite">
<main>
  <section class="wm-szene">
    <img src="/weihnachtsmarkt/img/christbaum.webp" alt="{bild_alt}" width="1500" height="1500" fetchpriority="high">
    <div class="wm-schleier"></div>
    <canvas aria-hidden="true"></canvas>
    <header class="topbar">
      <span class="brandbox">
        <a class="wordmark" href="{start}">VEGETARIAN<b>HULK</b></a>
      </span>
    </header>
    <div class="wm-kopf">
      <h1>{h1}</h1>
      <p>{unter}</p>
    </div>
    <button class="wm-halt" type="button">{halt}</button>
  </section>

  <div class="wrap">
    <form class="wm-such" id="wm-form" novalidate>
      <label for="wm-plz">{plz}</label>
      <div class="wm-zeile">
        <input id="wm-plz" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="5" autocomplete="postal-code" placeholder="84489">
        <button class="wm-knopf" type="submit">{suchen}</button>
      </div>
      <p class="wm-fehler" role="alert" hidden></p>
      <div class="wm-gruppe" id="wm-umkreis" role="group" aria-label="{umkreis}">
        <span>{umkreis}</span>
        <button class="wm-wahl" type="button" data-km="10" aria-pressed="false">10 km</button>
        <button class="wm-wahl" type="button" data-km="25" aria-pressed="true">25 km</button>
        <button class="wm-wahl" type="button" data-km="50" aria-pressed="false">50 km</button>
        <button class="wm-wahl" type="button" data-km="100" aria-pressed="false">100 km</button>
      </div>
      <div class="wm-gruppe" id="wm-arten" role="group" aria-label="{arten}" hidden>
        <span>{arten}</span>
      </div>
    </form>

    <div class="wm-tage" role="group" aria-label="{tage_label}" hidden></div>
    <h2 class="wm-zahl" aria-live="polite"></h2>
    <div class="wm-liste"></div>
    <details class="wm-offen" hidden></details>
    <p class="wm-stand"></p>

    <section class="wm-rueck" hidden>
      <div class="wm-r-frage">
        <h2>{r_frage}</h2>
        <div class="wm-zeile">
          <button class="wm-knopf" type="button" id="wm-r-ja">{r_ja}</button>
          <button class="wm-knopf" type="button" id="wm-r-nein">{r_nein}</button>
        </div>
      </div>
      <form class="wm-r-ja" hidden novalidate>
        <h2>{r_ja_titel}</h2>
        <div class="wm-sterne" role="group" aria-label="{r_ja_titel}"></div>
        <label for="wm-r-text-ja">{r_ja_text}</label>
        <textarea id="wm-r-text-ja" maxlength="1500"></textarea>
        <div class="wm-falle" aria-hidden="true"><label>{falle}<input type="text" tabindex="-1" autocomplete="off"></label></div>
        <button class="wm-knopf" type="submit">{senden}</button>
        <p>{r_hinweis}</p>
      </form>
      <form class="wm-r-nein" hidden novalidate>
        <h2>{r_nein_titel}</h2>
        <div class="wm-gruppe" role="radiogroup" aria-label="{r_nein_titel}">
          <label><input type="radio" name="wm-grund" value="markt-fehlt" checked> {g1}</label>
          <label><input type="radio" name="wm-grund" value="termin-falsch"> {g2}</label>
          <label><input type="radio" name="wm-grund" value="anderes"> {g3}</label>
        </div>
        <label for="wm-r-markt">{r_markt}</label>
        <input id="wm-r-markt" type="text" maxlength="160">
        <label for="wm-r-text-nein">{r_nein_text}</label>
        <textarea id="wm-r-text-nein" maxlength="1500"></textarea>
        <div class="wm-falle" aria-hidden="true"><label>{falle}<input type="text" tabindex="-1" autocomplete="off"></label></div>
        <button class="wm-knopf" type="submit">{senden}</button>
        <p>{r_hinweis}</p>
      </form>
      <p class="wm-r-fertig" role="status" hidden></p>
      <p class="wm-r-meldung wm-fehler" role="alert" hidden></p>
    </section>
  </div>

  <section class="wm-tisch">
    <img src="/weihnachtsmarkt/img/tisch.webp" alt="{tisch_alt}" width="1200" height="891" loading="lazy">
    <div class="wrap">
      <h2>{tisch_titel}</h2>
      <p>{tisch_text}</p>
      <div class="wm-brief"><vh-newsletter-form></vh-newsletter-form></div>
      <p class="wm-bild-hinweis">{bilder}</p>
    </div>
  </section>
</main>

<footer>
  <div class="inner">
    <a class="wordmark" href="{start}">VEGETARIAN<b>HULK</b></a>
    <p class="claim">{claim}</p>
    <nav class="legal" aria-label="{legal}">
      <a href="/impressum.html"{recht_attr}>{impressum}</a>
      <a href="/datenschutz.html"{recht_attr}>{datenschutz}</a>
      <span>© 2026 Sebastian Wimmer</span>
    </nav>
  </div>
</footer>

<nav class="nav" aria-label="{nav_label}">
{nav_html}
</nav>

<script src="/weihnachtsmarkt/radar.js?v=0" defer></script>
<script src="/v3.js?v=0" defer></script>
</body>
</html>
'''


def nav(eintraege):
    zeilen = []
    for i, (ziel, name) in enumerate(eintraege):
        if i == 2:
            zeilen.append(f'  <a class="center" href="{ziel}">\n    {NAV_BERG}\n    {name}\n  </a>')
        else:
            zeilen.append(f'  <a href="{ziel}">{name}</a>')
    return '\n'.join(zeilen)


def main():
    for t in T.values():
        ziel = WURZEL / t['ziel']
        ziel.parent.mkdir(parents=True, exist_ok=True)
        ziel.write_text(VORLAGE.format(nav_html=nav(t['nav']), **{k: v for k, v in t.items() if k != 'nav'}), encoding='utf-8')
        print('geschrieben', t['ziel'])


if __name__ == '__main__':
    main()
