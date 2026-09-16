#!/usr/bin/env python3
"""Baut den Wegverlauf aus `touren/<slug>/route.json` in die Tour-Seite ein.

Das Gegenstueck zu route-holen.py: dort werden die Koordinaten geholt, hier
werden sie zu einer Zeichnung. Getrennt, damit das Neuzeichnen keinen
Netzzugriff braucht — Gestaltung aendern heisst dann nicht: OSM neu befragen.

MASSSTAB
--------
Die Karte wird NICHT verzerrt. `preserveAspectRatio="none"` waere beim
Hoehenprofil noch vertretbar (dort sind die Achsen verschieden), bei einer
Karte ist es eine falsche Aussage ueber das Gelaende: ein Steilhang saehe je
nach Fensterbreite flach oder scharf aus. Die viewBox bekommt deshalb das
echte Seitenverhaeltnis der Route, und der Massstabsbalken belegt es.

Aufruf:  python3 scripts/route-einbauen.py [slug ...]
"""

import json
import math
import pathlib
import re
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
BREITE = 900          # viewBox-Breite; die Hoehe folgt dem Seitenverhaeltnis
RAND = 0.09           # Luft rings um die Route, als Anteil der laengeren Seite
MIN_VERH, MAX_VERH = 0.50, 1.50   # Hoehe/Breite — dazwischen bleibt es lesbar

ANFANG = "<!-- WEGVERLAUF (erzeugt: scripts/route-einbauen.py) -->"
ENDE = "<!-- /WEGVERLAUF -->"


def meter(a, b):
    breite = math.radians((a[0] + b[0]) / 2)
    return math.hypot((b[0] - a[0]) * 111_320,
                      (b[1] - a[1]) * 111_320 * math.cos(breite))


def projizieren(punkte):
    """Lat/Lon in Meter (x nach Osten, y nach Sueden), Mittelpunkt als Ursprung.
    Fuer wenige Kilometer ist die einfache Zylinderprojektion genau genug —
    der Fehler liegt unter der Strichstaerke."""
    lat0 = sum(p[0] for p in punkte) / len(punkte)
    k = math.cos(math.radians(lat0))
    return [((p[1] - punkte[0][1]) * 111_320 * k,
             -(p[0] - punkte[0][0]) * 111_320) for p in punkte]


def rahmen(xy):
    """Seitenverhaeltnis der Route bestimmen und in die viewBox einpassen."""
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

    return nach_px, hoehe_px, skala


def strecken(punkte):
    """Aufsummierte Strecke in km an jedem Punkt."""
    summe = [0.0]
    for a, b in zip(punkte, punkte[1:]):
        summe.append(summe[-1] + meter(a, b) / 1000)
    return summe


def kilometer_marken(punkte, px, summe):
    """Alle vollen Kilometer auf der Strecke — die machen aus der Linie eine
    Karte, an der man ablesen kann, wo man nach einer Stunde ungefaehr war."""
    schritt = 1 if summe[-1] <= 12 else 2
    marken = []
    ziel = schritt
    for i in range(1, len(summe)):
        while ziel < summe[-1] and summe[i] >= ziel:
            # zwischen den beiden Punkten linear einhaengen
            spanne = summe[i] - summe[i - 1] or 1
            t = (ziel - summe[i - 1]) / spanne
            a, b = px[i - 1], px[i]
            marken.append((round(a[0] + (b[0] - a[0]) * t, 1),
                           round(a[1] + (b[1] - a[1]) * t, 1), ziel))
            ziel += schritt
    return marken


def massstab(skala, hoehe_px):
    """Runde Distanz waehlen, die 18–38 % der Kartenbreite einnimmt."""
    for km in (0.25, 0.5, 1, 2, 5):
        anteil = km * 1000 * skala / BREITE
        if 0.18 <= anteil <= 0.38:
            text = f"{km:g} km".replace(".", ",")
            return round(anteil * 100, 1), text
    return 25.0, "1 km"


def bogen(px):
    """Weicher Pfad durch die Punkte. Eckige Polylinien sehen nach Rohdaten
    aus; eine leicht geglaettete Linie liest sich als Weg."""
    if len(px) < 3:
        return "M" + " L".join(f"{x},{y}" for x, y in px)
    teile = [f"M{px[0][0]},{px[0][1]}"]
    for i in range(1, len(px) - 1):
        mx = round((px[i][0] + px[i + 1][0]) / 2, 1)
        my = round((px[i][1] + px[i + 1][1]) / 2, 1)
        teile.append(f"Q{px[i][0]},{px[i][1]} {mx},{my}")
    teile.append(f"L{px[-1][0]},{px[-1][1]}")
    return " ".join(teile)


def hoehen(html):
    """Start- und Gipfelhoehe aus dem Hoehenprofil derselben Seite. Eine zweite
    Quelle dafuer anzulegen hiesse, dass die beiden auseinanderlaufen koennen."""
    m = re.search(r'data-punkte="([^"]+)"', html)
    if not m:
        return None, None
    werte = [(float(k), float(h)) for k, h in
             (q.split(",") for q in m.group(1).split())]
    return werte[0][1], max(w[1] for w in werte)


def zahl(n):
    return f"{int(n):,}".replace(",", ".")


def anker(x_anteil, y_anteil):
    """Schilder am Rand duerfen nicht aus dem Bild laufen. Statt sie immer zu
    zentrieren: nahe am Rand an der anderen Kante ausrichten, ganz oben nach
    unten klappen. Auf dem Handy war 'RISTFEUCHTHORN' sonst abgeschnitten."""
    if x_anteil > 0.66:
        waagrecht = "-100%"
    elif x_anteil < 0.34:
        waagrecht = "0"
    else:
        waagrecht = "-50%"
    senkrecht = "120%" if y_anteil < 0.16 else "-190%"
    return f"transform: translate({waagrecht}, {senkrecht})"


def gipfelname(html, slug):
    m = re.search(r'tour-profil__marke--gipfel"[^>]*>([^<]+)<', html)
    return m.group(1).strip() if m else slug.capitalize()


def freie_ecken(px, hoehe_px):
    """Die vier Ecken nach Belegung sortieren, freieste zuerst. Gezaehlt wird,
    wie viele Wegpunkte in das jeweilige Eckfeld fallen."""
    felder = []
    for waagrecht, x0, x1 in (("links", 0.0, 0.40), ("rechts", 0.60, 1.0)):
        for senkrecht, y0, y1 in (("oben", 0.0, 0.42), ("unten", 0.58, 1.0)):
            def drin(p):
                return (x0 * BREITE <= p[0] <= x1 * BREITE
                        and y0 * hoehe_px <= p[1] <= y1 * hoehe_px)

            treffer = sum(1 for p in px if drin(p))
            # Start und Gipfel tragen die grossen Schilder ("DRACHENWAND ·
            # 1.179 M") und wiegen darum viel schwerer als ein Wegpunkt. Ohne
            # das landete der Massstab auf dem Handy quer im Gipfelnamen.
            treffer += 25 * sum(1 for p in (px[0], px[-1]) if drin(p))
            felder.append((treffer, waagrecht, senkrecht))
    felder.sort()
    return [(w, sk) for _, w, sk in felder]


def abschnitt_bauen(slug, route, html):
    punkte = [tuple(p) for p in route["punkte"]]
    xy = projizieren(punkte)
    nach_px, hoehe_px, skala = rahmen(xy)
    px = [nach_px(p) for p in xy]

    summe = strecken(punkte)
    marken = kilometer_marken(punkte, px, summe)
    balken_anteil, balken_text = massstab(skala, hoehe_px)

    start_px, gipfel_px = px[0], px[-1]
    name = gipfelname(html, slug)
    start_hoehe, gipfel_hoehe = hoehen(html)
    km_text = f"{route['km']:.2f}".replace(".", ",")
    abw = route["abweichung"] * 100

    # Kilometermarken direkt auf Start oder Gipfel verdecken die beiden
    # wichtigsten Punkte der Karte — die 8 lag genau auf dem Gipfelkreuz.
    marken = [m for m in marken
              if math.dist(m[:2], start_px) > 26 and math.dist(m[:2], gipfel_px) > 26]

    kreise = "\n            ".join(
        f'<circle class="tour-route__km" cx="{x}" cy="{y}" r="4.5"/>'
        f'<text class="tour-route__kmtext" x="{x}" y="{y - 11}">{k:g}</text>'
        for x, y, k in marken)

    # Legende und Massstab kommen in die freiesten ECKEN. Der erste Versuch
    # ("leerere Haelfte", nach dem Schwerpunkt der Route) war zu grob: bei der
    # Kneifelspitze lag der Schwerpunkt rechts, der Gipfel aber oben LINKS —
    # und die Legende damit mitten auf dem Weg.
    ecken = freie_ecken(px, hoehe_px)
    legende_ecke = ecken[0]
    # Massstab und Legende bleiben ZUSAMMEN in derselben Ecke. Vorher stand der
    # Massstab in der zweitfreiesten Ecke — und lag dort quer unter dem
    # Startpunkt. Kartenbeschriftung gehoert an einen Ort, nicht verteilt.

    hoehen_zeile = (f"{zahl(start_hoehe)} → {zahl(gipfel_hoehe)} m"
                    if start_hoehe and gipfel_hoehe else "")
    hoehen_block = (f"""
            <div class="tour-route__fakt">
              <span class="tour-route__fakt-label">Höhe</span>
              <span class="tour-route__fakt-wert">{hoehen_zeile}</span>
            </div>""" if hoehen_zeile else "")

    # Wie nah die geroutete Laenge an der aufgezeichneten liegt, steht im Text.
    # Ohne diese Zahl waere "nach OpenStreetMap" eine Behauptung ohne Beleg.
    # Der Abstand zur Aufzeichnung gehoert in den Satz — sonst waere "nach
    # OpenStreetMap" eine Behauptung ohne Beleg. Und er gilt der LINIE, nicht
    # der Person: was Sebi unterwegs gegangen ist, weiss diese Karte nicht.
    unterschied = abs(route["km"] - route["erwartet_km"]) * 1000
    if unterschied < 25:
        naehe = "Sie deckt sich mit der Aufzeichnung."
    elif unterschied < 120:
        naehe = f"Sie deckt sich bis auf {unterschied:.0f} Meter mit der Aufzeichnung."
    else:
        weiter = "länger" if route["km"] > route["erwartet_km"] else "kürzer"
        km_diff = f"{unterschied / 1000:.1f}".replace(".", ",")
        naehe = (f"Eingezeichnet ist der kürzeste Weg — die Aufzeichnung ist "
                 f"{km_diff} km {'kürzer' if weiter == 'länger' else 'länger'}.")

    return f"""{ANFANG}
      <section class="tour-route flaeche-wald" style="--span: 8">
        <div class="tour-kopf">
          <span class="tour-kopf__label">Wegverlauf<span class="hsep" aria-hidden="true"></span>Aufstieg</span>
          <span class="tour-kopf__meta">Start → {name}</span>
        </div>
        <div class="tour-route__flaeche">
          <svg class="tour-route__svg" viewBox="0 0 {BREITE} {hoehe_px}" fill="none"
               role="img"
               aria-label="Wegverlauf {name}: {km_text} Kilometer vom Start zum Gipfel, nach OpenStreetMap"
               data-route="{' '.join(f'{a},{b}' for a, b in punkte)}"
               data-km="{route['km']}">
            <!-- Statische Pfade = Fallback ohne JS. tour.js rechnet sie aus
                 data-route neu; ohne sie bliebe die Karte leer. -->
            <path class="tour-route__schatten" d="{bogen(px)}"/>
            <path class="tour-route__weg" pathLength="1" d="{bogen(px)}"/>
            <g class="tour-route__kms" aria-hidden="true">
            {kreise}
            </g>
            <circle class="tour-route__start" cx="{start_px[0]}" cy="{start_px[1]}" r="7"/>
            <path class="tour-route__gipfel" d="M{gipfel_px[0]},{gipfel_px[1] + 9} V{gipfel_px[1] - 13} M{gipfel_px[0] - 7},{gipfel_px[1] - 6} H{gipfel_px[0] + 7}"/>
          </svg>

          <span class="tour-route__wert" aria-hidden="true"></span>
          <span class="tour-route__schild tour-route__schild--start"
                style="left: {start_px[0] / BREITE * 100:.1f}%; top: {start_px[1] / hoehe_px * 100:.1f}%; {anker(start_px[0] / BREITE, start_px[1] / hoehe_px)}">Start</span>
          <span class="tour-route__schild tour-route__schild--gipfel"
                style="left: {gipfel_px[0] / BREITE * 100:.1f}%; top: {gipfel_px[1] / hoehe_px * 100:.1f}%; {anker(gipfel_px[0] / BREITE, gipfel_px[1] / hoehe_px)}">{name}</span>

          <!-- Kartenrand: Norden, Legende, Massstab. Zusammen in einer Ecke,
               nicht ueber die Flaeche verstreut. -->
          <span class="tour-route__norden" aria-hidden="true">
            <svg viewBox="0 0 12 22" fill="none" aria-hidden="true">
              <path d="M6,1 L10,9 L6,7 L2,9 Z" fill="currentColor"/>
            </svg>N</span>

          <div class="tour-route__legende tour-route__legende--{legende_ecke[0]} tour-route__legende--{legende_ecke[1]}">
            <div class="tour-route__fakt">
              <span class="tour-route__fakt-label">Aufstieg</span>
              <span class="tour-route__fakt-wert">{km_text} km</span>
            </div>{hoehen_block}
          </div>

          <!-- Der Massstab liegt DIREKT in der Kartenflaeche, nicht in der
               Legende: seine Breite ist ein Anteil der KARTE. In der Legende
               waere '%' ein Anteil des Kastens gewesen — der Balken haette
               dann irgendeine Laenge gehabt und den Massstab widerlegt. -->
          <span class="tour-route__massstab tour-route__massstab--{legende_ecke[0]} tour-route__massstab--{legende_ecke[1]}"
                style="--balken: {balken_anteil}%; --legende-hoehe: {96 if hoehen_zeile else 46}px">
            <i aria-hidden="true"></i><em>{balken_text}</em>
          </span>
        </div>
        <p class="tour-route__hint">
          <span class="tour-route__hint-satz">Der Weg nach oben, aus OpenStreetMap-Daten gezeichnet — keine GPS-Spur. {naehe}</span>
          <span class="tour-route__quelle">Kartendaten © OpenStreetMap-Mitwirkende, ODbL</span>
        </p>
      </section>
      {ENDE}"""


def eine_tour(slug):
    quelle = WURZEL / "touren" / slug / "route.json"
    seite = WURZEL / "touren" / slug / "index.html"
    if not quelle.exists():
        print(f"  {slug}: keine route.json — uebersprungen")
        return False

    route = json.loads(quelle.read_text(encoding="utf-8"))
    html = seite.read_text(encoding="utf-8")
    block = abschnitt_bauen(slug, route, html)

    if ANFANG in html:
        neu = re.sub(re.escape(ANFANG) + r".*?" + re.escape(ENDE), block, html,
                     flags=re.S)
    else:
        # Direkt hinter das Hoehenprofil: erst die Zahlen, dann der Weg.
        # Anker ist die SEKTION, nicht der Kommentar darueber — den hatte nur
        # Fellhorn, und drei Touren fielen dadurch stumm aus dem Einbau.
        treffer = re.search(r'<section[^>]*class="[^"]*tour-profil[^"]*"', html)
        if not treffer:
            print(f"  {slug}: keine Profil-Sektion gefunden — nicht eingebaut")
            return False
        stelle = treffer.start()
        ende = html.find("</section>", stelle)
        if ende < 0:
            print(f"  {slug}: Profil-Sektion nicht abgeschlossen")
            return False
        ende += len("</section>")
        neu = html[:ende] + "\n\n      " + block + html[ende:]

    if neu == html:
        print(f"  {slug}: unveraendert")
        return False
    seite.write_text(neu, encoding="utf-8")
    print(f"  {slug}: Wegverlauf eingebaut ({route['km']} km, "
          f"{len(route['punkte'])} Punkte)")
    return True


def main():
    slugs = sys.argv[1:] or [
        p.name for p in sorted((WURZEL / "touren").iterdir())
        if (p / "route.json").exists()
    ]
    geaendert = sum(eine_tour(s) for s in slugs)
    print(f"\n{geaendert} von {len(slugs)} Seiten geaendert")


if __name__ == "__main__":
    main()
