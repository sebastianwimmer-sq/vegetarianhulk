#!/usr/bin/env python3
"""Holt ein Hoehengitter fuer den Kartenausschnitt einer Tour.

WARUM KEIN SATELLITENBILD
-------------------------
Naheliegend waere ein Luftbild unter der Route. Geht nicht sauber: die
Tourseiten duerfen nur eigene Bilder laden (`img-src 'self' data:`), die Kacheln
muessten also ins Repo — und genau das untersagen Esri, Google und Bing in ihren
Nutzungsbedingungen. Dazu kaemen Megabytes pro Seite, und ein Luftbild unter der
dunkelgruenen Bildsprache sieht fremd aus.

Hoehendaten sind der bessere Tausch: sie sind offen (Copernicus DEM ueber
Open-Meteo, kostenlos und ohne Schluessel), sie wiegen als Hoehenlinien ein paar
Kilobyte statt Megabyte, und sie erzaehlen mehr als ein Luftbild — man sieht,
wo es steil wird.

Der Dienst ist derselbe, der schon das Wetter liefert; es kommt also kein neuer
Anbieter dazu. Geholt wird EINMAL zur Bauzeit.

Aufruf:  python3 scripts/hoehenkarte.py [slug ...]
Ausgabe: touren/<slug>/relief.json
"""

import json
import pathlib
import sys
import time
import urllib.parse
import urllib.request
from datetime import date

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from routen_geometrie import BREITE, nach_latlon, projizieren, rahmen

WURZEL = pathlib.Path(__file__).resolve().parent.parent
# OpenTopoData ist fuer Massenabfragen gemacht: 100 Punkte je Anfrage, eine
# Anfrage je Sekunde, 1.000 am Tag — fuer vier Touren brauchen wir gut 100.
# Open-Meteo (dasselbe Haus wie das Wetter) zaehlt dagegen JEDEN der 100 Punkte
# als eigenen Aufruf und lief nach zwei Dutzend Anfragen in 429. Es bleibt als
# Rueckfall drin, falls OpenTopoData mal nicht da ist.
TOPO = "https://api.opentopodata.org/v1/"
DATENSAETZE = ["eudem25m", "srtm30m"]   # 25 m fuer Europa, sonst 30 m weltweit
RUECKFALL = "https://api.open-meteo.com/v1/elevation"
UA = "vegetarianhulk-tourbau/1.0 (+https://vegetarianhulk.de)"

# Wie fein das Gitter wird. 64 Spalten ueber typisch 10 km sind ~160 m Abstand;
# das darunterliegende Modell (Copernicus GLO-90) loest 90 m auf. Feiner zu
# fragen bringt also keine Information mehr, kostet aber Anfragen.
SPALTEN = 64
PRO_ANFRAGE = 100   # Grenze des Dienstes


def _anfrage(url, versuche=3):
    fehler = None
    for n in range(versuche):
        try:
            a = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(a, timeout=60) as antwort:
                return json.load(antwort)
        except Exception as f:
            fehler = f
            if n < versuche - 1:
                time.sleep(5 * (n + 1))
    raise fehler


def hol(lats, lons, datensatz):
    """Hoehen fuer bis zu 100 Punkte. `None` im Ergebnis bedeutet: der Datensatz
    deckt diesen Punkt nicht ab — das darf NICHT als 0 m durchgehen, sonst
    zieht sich eine Hoehenlinie auf Meereshoehe durch die Alpen."""
    orte = "|".join(f"{a:.5f},{o:.5f}" for a, o in zip(lats, lons))
    daten = _anfrage(TOPO + datensatz + "?"
                     + urllib.parse.urlencode({"locations": orte}))
    werte = [r.get("elevation") for r in daten.get("results", [])]
    if len(werte) != len(lats):
        raise ValueError(f"{len(werte)} Werte fuer {len(lats)} Punkte")
    return werte


def hol_rueckfall(lats, lons):
    daten = _anfrage(RUECKFALL + "?" + urllib.parse.urlencode({
        "latitude": ",".join(f"{v:.5f}" for v in lats),
        "longitude": ",".join(f"{v:.5f}" for v in lons)}))
    werte = daten.get("elevation") or []
    if len(werte) != len(lats):
        raise ValueError(f"{len(werte)} Werte fuer {len(lats)} Punkte")
    return werte


def eine_tour(slug):
    quelle = WURZEL / "touren" / slug / "route.json"
    if not quelle.exists():
        print(f"  {slug}: keine route.json — uebersprungen")
        return False

    route = json.loads(quelle.read_text(encoding="utf-8"))
    punkte = [tuple(p) for p in route["punkte"]]
    xy = projizieren(punkte)
    _, hoehe_px, _, ausschnitt = rahmen(xy)

    links, oben, rechts, unten = ausschnitt
    zeilen = max(2, round(SPALTEN * hoehe_px / BREITE))

    # Gitterpunkte auf die MITTE der Zellen legen waere falsch: die Hoehenlinien
    # sollen bis an den Bildrand laufen, also auch dort Stuetzstellen haben.
    lats, lons = [], []
    for zeile in range(zeilen):
        y = oben + (unten - oben) * zeile / (zeilen - 1)
        for spalte in range(SPALTEN):
            x = links + (rechts - links) * spalte / (SPALTEN - 1)
            lat, lon = nach_latlon(punkte, x, y)
            lats.append(lat)
            lons.append(lon)

    print(f"  {slug}: {SPALTEN}×{zeilen} = {len(lats)} Punkte "
          f"({(rechts - links) / 1000:.1f} × {(unten - oben) / 1000:.1f} km, "
          f"~{(rechts - links) / SPALTEN:.0f} m Raster)")

    # Datensatz einmal an einem Punkt pruefen, statt mitten im Lauf zu scheitern.
    datensatz = None
    for kandidat in DATENSAETZE:
        try:
            probe = hol(lats[:1], lons[:1], kandidat)
            if probe and probe[0] is not None:
                datensatz = kandidat
                break
        except Exception:
            pass
        time.sleep(1.2)
    if not datensatz:
        raise RuntimeError("kein Hoehendatensatz deckt diesen Ausschnitt ab")
    print(f"    Datensatz: {datensatz}")

    hoehen = []
    anfragen = (len(lats) + PRO_ANFRAGE - 1) // PRO_ANFRAGE
    for i in range(0, len(lats), PRO_ANFRAGE):
        teil = lats[i:i + PRO_ANFRAGE], lons[i:i + PRO_ANFRAGE]
        try:
            werte = hol(*teil, datensatz)
        except Exception as fehler:
            print(f"    {datensatz} streikt ({fehler}) — Rueckfall Open-Meteo")
            werte = hol_rueckfall(*teil)
        hoehen += werte
        if (i // PRO_ANFRAGE) % 10 == 9:
            print(f"    {i // PRO_ANFRAGE + 1}/{anfragen} Anfragen …")
        time.sleep(1.15)   # OpenTopoData erlaubt eine Anfrage je Sekunde

    # Luecken FUELLEN statt sie als 0 m stehen zu lassen: Nachbarwert nehmen.
    # Ein einzelnes fehlendes Feld waere sonst ein Loch bis auf Meereshoehe.
    luecken = sum(1 for h in hoehen if h is None)
    if luecken:
        print(f"    {luecken} Luecken im Gitter — mit Nachbarwerten gefuellt")
        letzte = next((h for h in hoehen if h is not None), 0)
        for i, h in enumerate(hoehen):
            if h is None:
                hoehen[i] = letzte
            else:
                letzte = h

    ziel = WURZEL / "touren" / slug / "relief.json"
    ziel.write_text(json.dumps({
        "slug": slug,
        "spalten": SPALTEN,
        "zeilen": zeilen,
        # Der Ausschnitt in Metern, damit route-einbauen.py die Werte GENAU dort
        # hinlegt, wo sie hergeholt wurden — er rechnet mit demselben rahmen().
        "ausschnitt": [round(v, 1) for v in ausschnitt],
        "hoehen": [round(h) for h in hoehen],
        "min": round(min(hoehen)),
        "max": round(max(hoehen)),
        "geholt_am": date.today().isoformat(),
        "quelle": datensatz,
        "luecken": luecken,
    }, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    kb = ziel.stat().st_size / 1024
    print(f"    ✓ {min(hoehen):.0f}–{max(hoehen):.0f} m · {kb:.0f} kB "
          f"→ {ziel.relative_to(WURZEL)}")
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
    print(f"\n{fertig} von {len(slugs)} Hoehengittern geholt")


if __name__ == "__main__":
    main()
