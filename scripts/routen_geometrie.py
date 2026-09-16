#!/usr/bin/env python3
"""Gemeinsame Geometrie fuer alles, was auf der Routenkarte liegt.

Drei Stellen rechnen dieselbe Projektion: `route-einbauen.py` (Weg, Marken,
Schilder), `hoehenkarte.py` (Gitter fuer die Hoehenlinien) und `tour.js` im
Browser. Liegen die auseinander, schwebt die Route neben ihrem eigenen Relief —
und das sieht man erst im Bild, nicht im Code. Deshalb steht die Rechnung hier
EINMAL; tour.js traegt dieselben Formeln als Kommentar-Verweis auf diese Datei.
"""

import math

BREITE = 900          # viewBox-Breite; die Hoehe folgt dem Seitenverhaeltnis
RAND = 0.09           # Luft rings um die Route, als Anteil der laengeren Seite
MIN_VERH, MAX_VERH = 0.50, 1.50   # Hoehe/Breite — dazwischen bleibt es lesbar


def meter(a, b):
    """Abstand zweier (lat, lon) in Metern."""
    breite = math.radians((a[0] + b[0]) / 2)
    return math.hypot((b[0] - a[0]) * 111_320,
                      (b[1] - a[1]) * 111_320 * math.cos(breite))


def projizieren(punkte):
    """Lat/Lon in Meter (x nach Osten, y nach Sueden), SCHWERPUNKT als Ursprung.

    Frueher war der erste Punkt der Ursprung — damit haing die Lage des
    Hoehengitters daran, in welcher Richtung die Route gespeichert war. Der
    Schwerpunkt ist von der Reihenfolge unabhaengig.
    Fuer wenige Kilometer ist die einfache Zylinderprojektion genau genug — der
    Fehler liegt unter der Strichstaerke."""
    lat0 = sum(p[0] for p in punkte) / len(punkte)
    lon0 = sum(p[1] for p in punkte) / len(punkte)
    k = math.cos(math.radians(lat0))
    return [((p[1] - lon0) * 111_320 * k,
             -(p[0] - lat0) * 111_320) for p in punkte]


def rahmen(xy):
    """Seitenverhaeltnis der Route bestimmen und in die viewBox einpassen.

    Gibt zurueck: (nach_px, hoehe_px, skala, ausschnitt). `ausschnitt` ist der
    sichtbare Bereich in Metern — (links, oben, rechts, unten) relativ zum
    Projektionsursprung. Die Hoehenkarte braucht genau den, sonst endet ihr
    Relief am Rand der Route statt am Rand des Bildes."""
    xs = [p[0] for p in xy]
    ys = [p[1] for p in xy]
    breite_m = max(max(xs) - min(xs), 1.0)
    hoehe_m = max(max(ys) - min(ys), 1.0)

    rand = max(breite_m, hoehe_m) * RAND
    breite_m += 2 * rand
    hoehe_m += 2 * rand

    # Extrem schmale Routen (fast gerade Linie) wuerden sonst zu einem
    # briefkastenflachen Streifen. Statt zu verzerren: die kurze Seite
    # grosszuegiger polstern, der Massstab bleibt dabei korrekt.
    verhaeltnis = hoehe_m / breite_m
    if verhaeltnis > MAX_VERH:
        breite_m = hoehe_m / MAX_VERH
    elif verhaeltnis < MIN_VERH:
        hoehe_m = breite_m * MIN_VERH

    mitte_x = (max(xs) + min(xs)) / 2
    mitte_y = (max(ys) + min(ys)) / 2
    skala = BREITE / breite_m
    hoehe_px = round(BREITE * hoehe_m / breite_m)

    def nach_px(p):
        return (round((p[0] - mitte_x) * skala + BREITE / 2, 1),
                round((p[1] - mitte_y) * skala + hoehe_px / 2, 1))

    ausschnitt = (mitte_x - breite_m / 2, mitte_y - hoehe_m / 2,
                  mitte_x + breite_m / 2, mitte_y + hoehe_m / 2)
    return nach_px, hoehe_px, skala, ausschnitt


def nach_latlon(punkte, x_m, y_m):
    """Umkehrung von projizieren(): Meter zurueck in lat/lon. Die Hoehenkarte
    braucht echte Koordinaten, um beim Hoehendienst danach zu fragen."""
    lat0 = sum(p[0] for p in punkte) / len(punkte)
    lon0 = sum(p[1] for p in punkte) / len(punkte)
    k = math.cos(math.radians(lat0))
    return (lat0 - y_m / 111_320, lon0 + x_m / (111_320 * k))
