#!/usr/bin/env python3
"""seo-check.py — haelt die Marken-Signale fuer die Suche nach "vegetarianhulk".

Am 27.09.2026 kam bei der Suche nach dem eigenen Namen die Website nicht vor.
Gefunden: Favicon nur als data:-URI (Google zeigt so etwas nicht an — im
Ergebnis stand eine Weltkugel), og:site_name nur auf der Startseite, Autor der
Touren ohne Bezug zur Marke. Dieses Tor haelt das fest, damit eine neue Seite
(Touren entstehen als Kopie) nicht wieder zurueckfaellt.

  python3 scripts/seo-check.py
  python3 scripts/seo-check.py --selbsttest
"""
import json
import pathlib
import re
import sys
import tempfile

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from importlib import import_module  # noqa: E402

sitemap = import_module("sitemap-bauen")

MARKE = "VegetarianHulk"
FAVICON_DATEIEN = ["favicon.svg", "favicon-48.png", "favicon-96.png", "apple-touch-icon.png", "favicon.ico"]
RE_LD = re.compile(r'<script type="application/ld\+json">(.*?)</script>', re.S)


def pruefe_seite(text):
    fehler = []
    titel = re.search(r"<title>([^<]*)</title>", text)
    if not titel or MARKE.lower() not in titel.group(1).lower():
        fehler.append(f"Titel ohne {MARKE}")
    if 'property="og:site_name"' not in text:
        fehler.append("og:site_name fehlt")
    if not re.search(r'<meta name="description" content="[^"]{50,}', text):
        fehler.append("meta description fehlt oder unter 50 Zeichen")
    if 'rel="icon" href="data:' in text:
        fehler.append("Favicon als data:-URI (zeigt Google nicht an)")
    # Google unterstuetzt BMP, GIF, ICO, PNG, JPEG, PPM, TIFF — kein SVG
    # (developers.google.com/search/docs/appearance/favicon-in-search, 27.09.2026).
    # Das ERSTE Icon muss also ein Rasterformat sein.
    erstes = re.search(r'<link rel="icon" href="([^"]+)"', text)
    if not erstes or not re.search(r"\.(png|ico)$", erstes.group(1)):
        fehler.append("erstes Favicon ist kein PNG/ICO (Google liest kein SVG)")
    if 'name="twitter:card"' not in text:
        fehler.append("twitter:card fehlt")
    if len(re.findall(r"<h1[\s>]", text)) != 1:
        fehler.append("nicht genau eine <h1>")
    for blk in RE_LD.findall(text):
        try:
            json.loads(blk)
        except json.JSONDecodeError as e:
            fehler.append(f"JSON-LD ungueltig: {e}")
    return fehler


def profil_ok(text):
    for blk in RE_LD.findall(text):
        try:
            d = json.loads(blk)
        except json.JSONDecodeError:
            continue
        haupt = d.get("mainEntity", {}) if isinstance(d, dict) else {}
        if d.get("@type") == "ProfilePage" and haupt.get("@type") == "Person" and haupt.get("name"):
            return True
    return False


def pruefe(wurzel):
    befunde = []
    for datei in FAVICON_DATEIEN:
        if not (wurzel / datei).is_file():
            befunde.append(f"✗ {datei} fehlt im Wurzelordner")
    start = wurzel / "index.html"
    if start.is_file():
        t = start.read_text(encoding="utf-8")
        if not re.search(r'"@type": "WebSite",[^}]*"name": "' + MARKE + '"', t, re.S):
            befunde.append(f"✗ index.html: WebSite-Schema mit name {MARKE} fehlt (Seitenname im Suchergebnis)")
        # Google: "An 'About Me' page" ist ein Einsatzfall fuer ProfilePage —
        # die Startseite traegt Sebis O-Ton und ist dieses Profil.
        if not profil_ok(t):
            befunde.append("✗ index.html: ProfilePage mit mainEntity Person fehlt")
    anzahl = 0
    for pfad, _url in sitemap.seiten(wurzel):
        anzahl += 1
        for f in pruefe_seite(pfad.read_text(encoding="utf-8", errors="replace")):
            befunde.append(f"✗ {pfad.relative_to(wurzel)}: {f}")
    return anzahl, befunde


def selbsttest():
    host = sitemap.HOST
    gut = ('<html><head><title>Tour | VegetarianHulk</title>'
           '<meta name="description" content="' + "x" * 60 + '">'
           '<meta property="og:site_name" content="VegetarianHulk">'
           f'<link rel="canonical" href="{host}touren/a/">'
           '<link rel="icon" href="/favicon-96.png" type="image/png">'
           '<meta name="twitter:card" content="summary_large_image">'
           '<script type="application/ld+json">{"a":1}</script></head><body><h1>A</h1></body></html>')
    faelle = {
        "sauber": (gut, 0),
        "data-Favicon": (gut.replace('<link rel="icon" href="/favicon-96.png"', '<link rel="icon" href="data:image/svg+xml,x"'), 2),
        "SVG zuerst": (gut.replace('<link rel="icon" href="/favicon-96.png" type="image/png">', '<link rel="icon" href="/favicon.svg"><link rel="icon" href="/favicon-96.png">'), 1),
        "ohne twitter:card": (gut.replace('name="twitter:card"', 'name="x"'), 1),
        "ohne Marke im Titel": (gut.replace("Tour | VegetarianHulk", "Tour"), 1),
        "ohne site_name": (gut.replace('property="og:site_name"', 'property="og:x"'), 1),
        "zwei h1": (gut.replace("<h1>A</h1>", "<h1>A</h1><h1>B</h1>"), 1),
        "kaputtes JSON-LD": (gut.replace('{"a":1}', '{"a":}'), 1),
    }
    kaputt = 0
    for name, (html, soll) in faelle.items():
        ist = len(pruefe_seite(html))
        if ist != soll:
            print(f"✗ Selbsttest '{name}': {ist} Befunde, erwartet {soll}")
            kaputt += 1
    with tempfile.TemporaryDirectory() as tmp:
        w = pathlib.Path(tmp)
        (w / "touren/a").mkdir(parents=True)
        (w / "touren/a/index.html").write_text(gut.replace('href="/favicon-96.png"', 'href="data:x"'))
        _, befunde = pruefe(w)
        if not any("favicon.svg fehlt" in b for b in befunde) or not any("touren/a" in b for b in befunde):
            print("✗ Selbsttest Baum: fehlende Favicon-Datei oder kaputte Seite nicht gemeldet")
            kaputt += 1
    profil = '<script type="application/ld+json">{"@type":"ProfilePage","mainEntity":{"@type":"Person","name":"S"}}</script>'
    if not profil_ok(profil) or profil_ok(profil.replace("ProfilePage", "WebPage")) or profil_ok(profil.replace('"name":"S"', '"x":1')):
        print("✗ Selbsttest ProfilePage: Erkennung falsch")
        kaputt += 1
    if kaputt:
        return 1
    print(f"✓ Selbsttest: {len(faelle)} Seitenfaelle + Baum in beide Richtungen korrekt")
    return 0


def main():
    if "--selbsttest" in sys.argv:
        return selbsttest()
    anzahl, befunde = pruefe(sitemap.WURZEL)
    for b in befunde:
        print(b)
    if befunde:
        return 1
    print(f"✓ Marken-Signale auf allen {anzahl} indexierbaren Seiten")
    return 0


if __name__ == "__main__":
    sys.exit(main())
