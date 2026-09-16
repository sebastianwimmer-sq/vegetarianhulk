#!/usr/bin/env python3
"""Liest GPX-Dateien ein und macht daraus die echte Spur einer Tour.

Ohne GPX zeigt die Karte den WEG nach OpenStreetMap (scripts/route-holen.py) —
eine ehrliche Naeherung, aber nicht das, was Sebi gegangen ist. Mit GPX wird
daraus seine Aufzeichnung: der ganze Rundweg statt nur des Aufstiegs, mit den
echten Umwegen.

WOHER DIE DATEI KOMMT
  Strava (am Rechner, nicht in der App): Aktivitaet oeffnen → ⋯ → GPX exportieren
  Apple Health: Profil → Alle Gesundheitsdaten exportieren → im ZIP liegt
                workout-routes/route_*.gpx, eine je Wanderung mit der Watch
  Bergfex:      Teilen → GPX

ZUORDNUNG
Die Tour wird nicht abgefragt, sondern erkannt: gewinnt die Tour, deren Gipfel
dem hoechsten Punkt der Spur am naechsten liegt. Ueber 2 km Abstand wird die
Datei abgelehnt statt der falschen Tour untergeschoben.

Aufruf:  python3 scripts/gpx-einlesen.py <datei-oder-ordner> [...]
Ausgabe: touren/<slug>/route.json  (ersetzt die OSM-Fassung)
         Danach: python3 scripts/hoehenkarte.py <slug>
                 python3 scripts/route-einbauen.py <slug>
"""

import json
import pathlib
import re
import sys
import xml.etree.ElementTree as ET
from datetime import date

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from routen_geometrie import meter

WURZEL = pathlib.Path(__file__).resolve().parent.parent

# Wie viele Punkte in der Seite landen. Eine Rundtour braucht mehr als ein
# Aufstieg, aber 4.000 Rohpunkte gehoeren nicht ins HTML.
ZIEL_PUNKTE = 150

# Ab hier passt die Spur nicht mehr zur Tour.
MAX_ABSTAND_M = 2000


def punkte_lesen(datei):
    """Alle <trkpt> in Reihenfolge. GPX-Dateien tragen einen Namensraum, den
    Strava, Apple und Bergfex jeweils etwas anders schreiben — deshalb ueber
    das Tag-Ende suchen statt ueber den vollen Namen."""
    baum = ET.parse(datei)
    punkte = []
    for el in baum.iter():
        if not el.tag.endswith("}trkpt") and el.tag != "trkpt":
            continue
        try:
            lat = float(el.attrib["lat"])
            lon = float(el.attrib["lon"])
        except (KeyError, ValueError):
            continue
        hoehe = None
        for kind in el:
            if kind.tag.endswith("}ele") or kind.tag == "ele":
                try:
                    hoehe = float(kind.text)
                except (TypeError, ValueError):
                    pass
        punkte.append((lat, lon, hoehe))
    return punkte


def strecke_km(punkte):
    return sum(meter(a[:2], b[:2]) for a, b in zip(punkte, punkte[1:])) / 1000


def ausduennen(punkte, ziel=ZIEL_PUNKTE):
    """Gleichmaessig nach STRECKE abtasten, nicht jeden N-ten Punkt nehmen.
    GPS-Geraete zeichnen im Stehen weiter auf — wer nach Index abtastet,
    verschwendet die Haelfte der Punkte auf die Gipfelpause."""
    if len(punkte) <= ziel:
        return punkte
    summe = [0.0]
    for a, b in zip(punkte, punkte[1:]):
        summe.append(summe[-1] + meter(a[:2], b[:2]))
    gesamt = summe[-1]

    heraus, n = [], 0
    for i in range(ziel):
        wunsch = gesamt * i / (ziel - 1)
        while n < len(summe) - 1 and summe[n + 1] < wunsch:
            n += 1
        heraus.append(punkte[n])
    heraus[-1] = punkte[-1]
    return [p for i, p in enumerate(heraus) if i == 0 or p != heraus[i - 1]]


def touren_gipfel():
    """Bekannte Gipfel aus den Seiten — Ziel der Zuordnung."""
    gipfel = {}
    for seite in sorted((WURZEL / "touren").glob("*/index.html")):
        html = seite.read_text(encoding="utf-8")
        lat = re.search(r'data-lat="([\d.]+)"', html)
        lon = re.search(r'data-lon="([\d.]+)"', html)
        if lat and lon:
            gipfel[seite.parent.name] = (float(lat.group(1)), float(lon.group(1)))
    return gipfel


def zuordnen(punkte, gipfel):
    """Die Tour gewinnt, deren Gipfel dem hoechsten Punkt der Spur am naechsten
    liegt. Hat die Datei keine Hoehen, zaehlt der naechste Punkt ueberhaupt."""
    mit_hoehe = [p for p in punkte if p[2] is not None]
    bezug = (max(mit_hoehe, key=lambda p: p[2])[:2] if mit_hoehe else None)

    bewertet = []
    for slug, ort in gipfel.items():
        if bezug:
            abstand = meter(bezug, ort)
        else:
            abstand = min(meter(p[:2], ort) for p in punkte)
        bewertet.append((abstand, slug))
    bewertet.sort()
    return bewertet[0]


def eine_datei(datei, gipfel):
    punkte = punkte_lesen(datei)
    if len(punkte) < 20:
        print(f"  ✗ {datei.name}: nur {len(punkte)} Trackpunkte — keine Spur")
        return None

    km = strecke_km(punkte)
    abstand, slug = zuordnen(punkte, gipfel)
    if abstand > MAX_ABSTAND_M:
        print(f"  ✗ {datei.name}: naechste Tour ist {slug}, aber "
              f"{abstand / 1000:.1f} km entfernt — nicht zugeordnet")
        return None

    duenn = ausduennen(punkte)
    hoehen = [p[2] for p in punkte if p[2] is not None]

    # Vergleichswert aus dem Hoehenprofil der Seite: stimmt die Laenge?
    html = (WURZEL / "touren" / slug / "index.html").read_text(encoding="utf-8")
    profil = re.search(r'data-punkte="([^"]+)"', html)
    erwartet = (float(profil.group(1).split()[-1].split(",")[0]) if profil else None)

    hinweis = ""
    if erwartet:
        ab = abs(km - erwartet) / erwartet * 100
        hinweis = f" · Seite sagt {erwartet:.2f} km ({ab:.0f} % ab)"
        if ab > 25:
            print(f"  ! {datei.name} → {slug}: {km:.2f} km gegen {erwartet:.2f} km "
                  f"laut Seite. Passt die Datei wirklich zu dieser Tour?")

    print(f"  ✓ {datei.name} → {slug}: {km:.2f} km, {len(punkte)} Punkte "
          f"→ {len(duenn)}{hinweis}")

    alt = WURZEL / "touren" / slug / "route.json"
    voriger_gipfel = None
    if alt.exists():
        voriger_gipfel = json.loads(alt.read_text(encoding="utf-8")).get("gipfel")

    return slug, {
        "slug": slug,
        "art": "spur",          # nicht "aufstieg" — das hier ist der ganze Weg
        "verworfen": False,
        "punkte": [[round(p[0], 5), round(p[1], 5)] for p in duenn],
        "start": [round(duenn[0][0], 5), round(duenn[0][1], 5)],
        # Der OSM-Gipfel bleibt: er ist genauer als der hoechste GPS-Punkt und
        # die Wetterabfrage der Seite haengt an denselben Koordinaten.
        "gipfel": voriger_gipfel or list(
            max((p for p in punkte if p[2] is not None),
                key=lambda p: p[2], default=duenn[-1])[:2]),
        "km": round(km, 2),
        "erwartet_km": round(erwartet, 2) if erwartet else None,
        "abweichung": round(abs(km - erwartet) / erwartet, 3) if erwartet else 0.0,
        "hoehe_min": round(min(hoehen)) if hoehen else None,
        "hoehe_max": round(max(hoehen)) if hoehen else None,
        "start_herkunft": f"GPX ({datei.name})",
        "osm_wege": [],
        "geholt_am": date.today().isoformat(),
        "quelle": "GPS-Aufzeichnung (GPX)",
    }


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        raise SystemExit(2)

    dateien = []
    for arg in sys.argv[1:]:
        pfad = pathlib.Path(arg).expanduser()
        if pfad.is_dir():
            dateien += sorted(pfad.rglob("*.gpx"))
        elif pfad.suffix.lower() == ".gpx":
            dateien.append(pfad)
    if not dateien:
        print("Keine .gpx gefunden.")
        raise SystemExit(1)

    gipfel = touren_gipfel()
    print(f"{len(dateien)} Datei(en), {len(gipfel)} bekannte Touren\n")

    geschrieben = []
    for datei in dateien:
        try:
            ergebnis = eine_datei(datei, gipfel)
        except ET.ParseError as fehler:
            print(f"  ✗ {datei.name}: keine lesbare GPX ({fehler})")
            continue
        if not ergebnis:
            continue
        slug, daten = ergebnis
        (WURZEL / "touren" / slug / "route.json").write_text(
            json.dumps(daten, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        geschrieben.append(slug)

    if geschrieben:
        liste = " ".join(sorted(set(geschrieben)))
        print(f"\nJetzt noch:\n"
              f"  python3 scripts/hoehenkarte.py {liste}\n"
              f"  python3 scripts/route-einbauen.py {liste}\n"
              f"  bash scripts/bump-asset-versions.sh")


if __name__ == "__main__":
    main()
