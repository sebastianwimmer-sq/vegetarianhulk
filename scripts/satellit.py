#!/usr/bin/env python3
"""Legt ein Satellitenbild unter die Routenkarte.

LIZENZ — der Grund, warum es DIESE Quelle ist
---------------------------------------------
Esri, Google und Bing untersagen das Zwischenspeichern und Weiterverteilen ihrer
Kacheln. Die Tourseiten duerfen aber nur eigene Bilder laden
(`img-src 'self' data:`), das Bild MUSS also ins Repo — mit diesen Anbietern
waere das ein Lizenzbruch.

**Sentinel-2 cloudless** von EOX steht unter **CC BY 4.0** und darf mit Nennung
weiterverwendet werden. Grundlage sind Copernicus-Sentinel-2-Daten der EU.
Aufloesung 10 m — fuer ein zurueckhaltendes Untergrundbild genau richtig, fuer
eine scharfe Luftaufnahme zu grob. Das ist hier kein Mangel: das Bild soll
Stimmung geben, nicht gelesen werden.

TON
Das Rohbild ist hellgruen-bunt und wuerde die dunkle Bildsprache der Seite
zerschlagen. Es wird deshalb entsaettigt, abgedunkelt und leicht ins Marken-
gruen gezogen — danach traegt es die Karte, statt mit ihr zu konkurrieren.

Aufruf:  python3 scripts/satellit.py [slug ...]
Ausgabe: touren/<slug>/gelaende.jpg
"""

import io
import json
import math
import pathlib
import sys
import time
import urllib.request

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from routen_geometrie import BREITE, nach_latlon, projizieren, rahmen

from PIL import Image, ImageEnhance

WURZEL = pathlib.Path(__file__).resolve().parent.parent
# Ausserhalb des Repos: Rohkacheln gehoeren nicht in die Versionierung.
CACHE = pathlib.Path.home() / ".cache" / "vh-satellit"
KACHELN = ("https://tiles.maps.eox.at/wmts/1.0.0/"
           "s2cloudless-2020_3857/default/g/{z}/{y}/{x}.jpg")
UA = "vegetarianhulk-tourbau/1.0 (+https://vegetarianhulk.de)"

ZOOM = 15          # ~4,8 m je Pixel; Sentinel-2 loest 10 m auf, mehr bringt nichts
ZIEL_BREITE = 1100  # Ausgabebreite in Pixeln
GUETE = 62          # JPEG-Qualitaet — das Bild liegt spaeter bei ~45 % Deckkraft

# Ton. Alle drei Werte sind bewusst kraeftig: ein unbehandeltes Luftbild sieht
# neben der dunkelgruenen Seite aus wie ein Fremdkoerper.
# Das Bild liegt spaeter bei ~35 % Deckkraft ueber dunklem Grund. Es hier
# zusaetzlich stark abzudunkeln hat es unsichtbar gemacht — die Feinregelung
# gehoert ins CSS, nicht ins Bild. Hier nur so weit behandeln, dass es nicht
# mehr bunt ist.
SAETTIGUNG = 0.50
HELLIGKEIT = 0.92
GRUENSTICH = 0.05   # Markenfarbe ueber dem Foto, bewusst unter 8 %
MARKE = (18, 53, 36)


def kachel_xy(lat, lon, z):
    """Web-Mercator-Kachelkoordinaten, als Fliesskomma (fuer exakten Zuschnitt)."""
    n = 2 ** z
    x = (lon + 180.0) / 360.0 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y


def hol_kachel(z, x, y, versuche=3):
    url = KACHELN.format(z=z, x=x, y=y)
    fehler = None
    for n in range(versuche):
        try:
            a = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(a, timeout=45) as antwort:
                return Image.open(io.BytesIO(antwort.read())).convert("RGB")
        except Exception as f:
            fehler = f
            if n < versuche - 1:
                time.sleep(3 * (n + 1))
    raise fehler


def zusammensetzen(nord, west, sued, ost, z):
    """Alle Kacheln des Ausschnitts holen und punktgenau zuschneiden."""
    x0, y0 = kachel_xy(nord, west, z)
    x1, y1 = kachel_xy(sued, ost, z)

    kx0, ky0 = math.floor(x0), math.floor(y0)
    kx1, ky1 = math.ceil(x1), math.ceil(y1)
    spalten, zeilen = kx1 - kx0, ky1 - ky0

    blatt = Image.new("RGB", (spalten * 256, zeilen * 256))
    anzahl = spalten * zeilen
    for i, kx in enumerate(range(kx0, kx1)):
        for j, ky in enumerate(range(ky0, ky1)):
            blatt.paste(hol_kachel(z, kx, ky), (i * 256, j * 256))
            time.sleep(0.12)   # freundlich bleiben, der Dienst ist gratis

    # Zuschnitt auf den echten Ausschnitt, in Pixeln des zusammengesetzten Blatts
    links = round((x0 - kx0) * 256)
    oben = round((y0 - ky0) * 256)
    rechts = round((x1 - kx0) * 256)
    unten = round((y1 - ky0) * 256)
    return blatt.crop((links, oben, rechts, unten)), anzahl


def einfaerben(bild, hoehe_px):
    """Entsaettigen, abdunkeln, leicht ins Markengruen ziehen."""
    ziel = (ZIEL_BREITE, max(1, round(ZIEL_BREITE * hoehe_px / BREITE)))
    bild = bild.resize(ziel, Image.LANCZOS)
    bild = ImageEnhance.Color(bild).enhance(SAETTIGUNG)
    bild = ImageEnhance.Brightness(bild).enhance(HELLIGKEIT)
    schleier = Image.new("RGB", bild.size, MARKE)
    return Image.blend(bild, schleier, GRUENSTICH)


def eine_tour(slug):
    quelle = WURZEL / "touren" / slug / "route.json"
    if not quelle.exists():
        print(f"  {slug}: keine route.json — uebersprungen")
        return False

    route = json.loads(quelle.read_text(encoding="utf-8"))
    punkte = [tuple(p) for p in route["punkte"]]
    _, hoehe_px, _, ausschnitt = rahmen(projizieren(punkte))
    links, oben, rechts, unten = ausschnitt

    # Ecken des Kartenausschnitts in echte Koordinaten zurueckrechnen
    nord, west = nach_latlon(punkte, links, oben)
    sued, ost = nach_latlon(punkte, rechts, unten)

    # Zwischenspeicher: der Ton wird erfahrungsgemaess mehrfach nachgeregelt,
    # und dafuer 90 Kacheln erneut zu holen waere unhoeflich und langsam.
    # Der Schluessel muss den GANZEN Ausschnitt tragen. Mit nur der Nordwest-
    # Ecke traf er auch dann, wenn sich die Hoehe der Karte geaendert hatte —
    # das alte Bild wurde dann einfach auf das neue Format gezogen und lag
    # verzerrt unter der Route, ohne dass irgendetwas anschlug.
    schluessel = "_".join(f"{v:.5f}" for v in (nord, west, sued, ost))
    cache = CACHE / f"{slug}-z{ZOOM}-{schluessel}.png"
    if cache.exists():
        bild, kacheln = Image.open(cache).convert("RGB"), 0
        print(f"  {slug}: aus dem Zwischenspeicher")
    else:
        bild, kacheln = zusammensetzen(nord, west, sued, ost, ZOOM)
        CACHE.mkdir(parents=True, exist_ok=True)
        bild.save(cache)
    bild = einfaerben(bild, hoehe_px)

    ziel = WURZEL / "touren" / slug / "gelaende.jpg"
    bild.save(ziel, "JPEG", quality=GUETE, optimize=True, progressive=True)
    # Ausschnitt danebenlegen — sonst kann niemand feststellen, ob das Bild
    # noch zur Route passt. Beim Hoehengitter gab es diesen Nachweis schon;
    # beim Luftbild fehlte er, und ein verschobenes Luftbild sieht immer noch
    # aus wie Gelaende.
    (ziel.with_suffix(".json")).write_text(json.dumps({
        "slug": slug, "ausschnitt": [round(v, 1) for v in ausschnitt],
        "quelle": "Sentinel-2 cloudless (EOX), CC BY 4.0",
        "zoom": ZOOM, "groesse": list(bild.size),
    }, ensure_ascii=False) + "\n", encoding="utf-8")
    kb = ziel.stat().st_size / 1024
    print(f"  {slug}: {kacheln} Kacheln → {bild.size[0]}×{bild.size[1]} px, "
          f"{kb:.0f} kB → {ziel.relative_to(WURZEL)}")
    return True


def main():
    slugs = sys.argv[1:] or [
        p.name for p in sorted((WURZEL / "touren").iterdir())
        if (p / "route.json").exists()
    ]
    fertig = 0
    for slug in slugs:
        try:
            fertig += bool(eine_tour(slug))
        except Exception as fehler:
            print(f"  ✗ {slug}: {fehler}")
    print(f"\n{fertig} von {len(slugs)} Luftbildern gebaut")


if __name__ == "__main__":
    main()
