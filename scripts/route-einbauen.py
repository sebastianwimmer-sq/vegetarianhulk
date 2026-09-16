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

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

from routen_geometrie import BREITE, meter, projizieren, rahmen

WURZEL = pathlib.Path(__file__).resolve().parent.parent

ANFANG = "<!-- WEGVERLAUF (erzeugt: scripts/route-einbauen.py) -->"
ENDE = "<!-- /WEGVERLAUF -->"





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
    """Runde Distanz waehlen, die 14–27 % der Kartenbreite einnimmt —
    sie muss in den Beschriftungskasten passen (30 % breit)."""
    for km in (0.25, 0.5, 1, 2, 5):
        anteil = km * 1000 * skala / BREITE
        if 0.14 <= anteil <= 0.27:
            text = f"{km:g} km".replace(".", ",")
            return round(anteil * 100, 1), text
    return 20.0, "1 km"


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


def gipfelname(html, slug, kurz=False):
    """`kurz` laesst die Hoehe weg. Auf der Karte steht sie sonst dreimal:
    in der Kopfzeile, in der Legende und quer ueber dem Weg."""
    m = re.search(r'tour-profil__marke--gipfel"[^>]*>([^<]+)<', html)
    name = m.group(1).strip() if m else slug.capitalize()
    return name.split("·")[0].strip() if kurz else name


def _stufe(spanne, wunsch=12):
    """Runder Hoehenabstand, der etwa `wunsch` Linien ergibt. 37-Meter-Schritte
    liest niemand — 20, 50, 100, 200 schon."""
    for kandidat in (10, 20, 25, 50, 100, 200, 250, 500):
        if spanne / kandidat <= wunsch:
            return kandidat
    return 1000


def _vereinfachen(punkte, toleranz=1.2):
    """Douglas-Peucker. Ohne das traegt jede Hoehenlinie jeden Gitterschritt mit
    sich — bei zwoelf Linien sind das ueber 100 kB Pfaddaten in der Seite."""
    if len(punkte) < 3:
        return punkte
    ax, ay = punkte[0]
    bx, by = punkte[-1]
    dx, dy = bx - ax, by - ay
    laenge = math.hypot(dx, dy)
    schlimmster, abstand = 0, 0.0
    for i in range(1, len(punkte) - 1):
        x, y = punkte[i]
        d = (abs(dy * x - dx * y + bx * ay - by * ax) / laenge if laenge
             else math.hypot(x - ax, y - ay))
        if d > abstand:
            schlimmster, abstand = i, d
    if abstand <= toleranz:
        return [punkte[0], punkte[-1]]
    return (_vereinfachen(punkte[:schlimmster + 1], toleranz)[:-1]
            + _vereinfachen(punkte[schlimmster:], toleranz))


def _segmente(gitter, spalten, zeilen, hoehe, ecke):
    """Marching Squares: jede Gitterzelle liefert 0, 1 oder 2 Teilstuecke der
    Hoehenlinie. Klassisches Verfahren, hier auf das Noetige gekuerzt."""
    links, oben, rechts, unten = ecke
    sx = (rechts - links) / (spalten - 1)
    sy = (unten - oben) / (zeilen - 1)

    def ort(c, r):
        return (links + c * sx, oben + r * sy)

    def misch(p, a, q, b):
        """Wo genau zwischen zwei Gitterpunkten die Linie durchlaeuft."""
        t = 0.5 if a == b else (hoehe - a) / (b - a)
        return (p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t)

    heraus = []
    for r in range(zeilen - 1):
        for c in range(spalten - 1):
            v = [gitter[r * spalten + c], gitter[r * spalten + c + 1],
                 gitter[(r + 1) * spalten + c + 1], gitter[(r + 1) * spalten + c]]
            p = [ort(c, r), ort(c + 1, r), ort(c + 1, r + 1), ort(c, r + 1)]
            fall = sum((1 << i) for i in range(4) if v[i] > hoehe)
            if fall in (0, 15):
                continue
            # Kante i verbindet Ecke i mit Ecke (i+1) % 4
            kanten = [misch(p[i], v[i], p[(i + 1) % 4], v[(i + 1) % 4])
                      for i in range(4)]
            paare = {1: [(0, 3)], 2: [(0, 1)], 3: [(1, 3)], 4: [(1, 2)],
                     5: [(0, 1), (2, 3)], 6: [(0, 2)], 7: [(2, 3)],
                     8: [(2, 3)], 9: [(0, 2)], 10: [(0, 3), (1, 2)],
                     11: [(1, 2)], 12: [(1, 3)], 13: [(0, 1)], 14: [(0, 3)]}
            for a, b in paare[fall]:
                heraus.append((kanten[a], kanten[b]))
    return heraus


def _zu_zuegen(segmente):
    """Teilstuecke zu durchgehenden Linien verketten. Einzelne Segmente ergaeben
    tausende winziger Pfade — verkettet sind es ein paar Dutzend."""
    offen = {}
    for a, b in segmente:
        ka = (round(a[0], 2), round(a[1], 2))
        kb = (round(b[0], 2), round(b[1], 2))
        offen.setdefault(ka, []).append(kb)
        offen.setdefault(kb, []).append(ka)

    gesehen, zuege = set(), []
    for start in list(offen):
        if start in gesehen:
            continue
        # Von einem Endpunkt aus loslaufen (Grad 1), sonst irgendwo im Ring.
        if len(offen[start]) != 1:
            continue
        zug, hier = [start], start
        gesehen.add(hier)
        while True:
            weiter = [n for n in offen.get(hier, []) if n not in gesehen]
            if not weiter:
                break
            hier = weiter[0]
            gesehen.add(hier)
            zug.append(hier)
        if len(zug) > 2:
            zuege.append(zug)

    # Geschlossene Ringe haben keinen Endpunkt — die bleiben uebrig.
    for start in list(offen):
        if start in gesehen:
            continue
        zug, hier = [start], start
        gesehen.add(hier)
        while True:
            weiter = [n for n in offen.get(hier, []) if n not in gesehen]
            if not weiter:
                break
            hier = weiter[0]
            gesehen.add(hier)
            zug.append(hier)
        if len(zug) > 3:
            zug.append(zug[0])
            zuege.append(zug)
    return zuege


def hoehenlinien(relief, nach_px):
    """Aus dem Hoehengitter fertige SVG-Pfade machen, in Bildkoordinaten."""
    gitter = relief["hoehen"]
    spalten, zeilen = relief["spalten"], relief["zeilen"]
    ecke = relief["ausschnitt"]
    tief, hoch = relief["min"], relief["max"]
    stufe = _stufe(hoch - tief)

    # Jede fuenfte Linie wird staerker gezeichnet — so liest man ein Relief,
    # ohne jede Linie beschriften zu muessen.
    betont = stufe * 5

    linien = []
    h = (tief // stufe + 1) * stufe
    while h < hoch:
        for zug in _zu_zuegen(_segmente(gitter, spalten, zeilen, h, ecke)):
            in_px = _vereinfachen([nach_px(q) for q in zug])
            if len(in_px) < 2:
                continue
            d = "M" + " L".join(f"{round(x)},{round(y)}" for x, y in in_px)
            linien.append((h, h % betont == 0, d))
        h += stufe
    return linien, stufe


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
    # Liegt eine GPX vor, ist die Linie die AUFZEICHNUNG — dann darf und muss
    # der Text etwas anderes sagen als bei der OSM-Naeherung.
    ist_spur = route.get("art") == "spur"
    xy = projizieren(punkte)
    nach_px, hoehe_px, skala, ausschnitt = rahmen(xy)
    px = [nach_px(p) for p in xy]

    # Hoehenlinien, falls ein Gitter da ist (scripts/hoehenkarte.py).
    # Fehlt es, bleibt die Karte schlicht — das ist kein Fehler, nur weniger.
    relief_datei = WURZEL / "touren" / slug / "relief.json"
    relief_pfade, relief_stufe = "", None
    if relief_datei.exists():
        relief = json.loads(relief_datei.read_text(encoding="utf-8"))
        # Das Gitter wurde fuer EINEN Kartenausschnitt geholt. Aendert sich die
        # Route (anderer Startpunkt, neue GPX), verschiebt sich der Ausschnitt —
        # und die alten Hoehenlinien laegen daneben, ohne dass etwas auffaellt:
        # es waeren ja Linien da. Lieber keine als falsche.
        passt = all(abs(a - b) < 1.0
                    for a, b in zip(relief.get("ausschnitt", []), ausschnitt))
        if not passt:
            print(f"  ! {slug}: relief.json passt nicht mehr zum Ausschnitt — "
                  f"Hoehenlinien weggelassen. Bitte hoehenkarte.py {slug} laufen lassen.")
            relief = None
        if relief:
            linien, relief_stufe = hoehenlinien(relief, nach_px)
            relief_pfade = "\n            ".join(
                f'<path class="tour-route__hoehenlinie'
                f'{" tour-route__hoehenlinie--betont" if betont else ""}" d="{d}"/>'
                for _, betont, d in linien)

    summe = strecken(punkte)
    marken = kilometer_marken(punkte, px, summe)
    balken_anteil, balken_text = massstab(skala, hoehe_px)

    # WAECHTER. Am 16.09. stand bei allen vier Touren der Start-Punkt auf dem
    # Gipfel und das Gipfelkreuz am Parkplatz — ein reverse() zu viel im Router.
    # Die Linie sah dabei vollkommen richtig aus, nur ihre Enden logen, und
    # genau deshalb ist das hier eine Pruefung und keine stille Korrektur.
    if not ist_spur:
        vom_start = meter(punkte[0], route["start"])
        zum_gipfel = meter(punkte[-1], route["gipfel"])
        if vom_start > 400 or zum_gipfel > 400:
            raise ValueError(
                f"{slug}: Route laeuft verkehrt herum — punkte[0] ist "
                f"{vom_start:.0f} m vom Start und punkte[-1] {zum_gipfel:.0f} m "
                f"vom Gipfel entfernt. Erwartet wird Start → Gipfel.")

    start_px = px[0]
    if ist_spur:
        # Rundtour: das Ende liegt wieder am Auto. Das Kreuz gehoert an den
        # Punkt der Spur, der dem Gipfel am naechsten kommt.
        gipfel_px = min(zip(px, punkte),
                        key=lambda paar: meter(paar[1], route["gipfel"]))[0]
    else:
        gipfel_px = px[-1]
    name = gipfelname(html, slug)
    kurz_name = gipfelname(html, slug, kurz=True)
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
    if ist_spur:
        satz = ("Die tatsächlich gegangene Spur, aus der GPS-Aufzeichnung. "
                "Kilometermarken je nach Länge alle 1 oder 2 km.")
        kopf_label, kopf_zusatz = "Gegangene Spur", f"{km_text} km"
    else:
        satz = None
        kopf_label, kopf_zusatz = "Aufstieg", None

    unterschied = abs(route["km"] - route["erwartet_km"]) * 1000 if route.get("erwartet_km") else 0
    if unterschied < 25:
        naehe = "Sie deckt sich mit der Aufzeichnung."
    elif unterschied < 120:
        naehe = f"Sie deckt sich bis auf {unterschied:.0f} Meter mit der Aufzeichnung."
    else:
        weiter = "länger" if route["km"] > route["erwartet_km"] else "kürzer"
        km_diff = f"{unterschied / 1000:.1f}".replace(".", ",")
        naehe = (f"Eingezeichnet ist der kürzeste Weg — die Aufzeichnung ist "
                 f"{km_diff} km {'kürzer' if weiter == 'länger' else 'länger'}.")

    relief_quelle = (f" · Höhenlinien alle {relief_stufe} m aus EU-DEM (Copernicus)"
                     if relief_stufe else "")

    if satz:
        hinweis_satz = satz
    else:
        hinweis_satz = ("Der Weg nach oben, aus OpenStreetMap-Daten gezeichnet — "
                        f"keine GPS-Spur. {naehe}")

    quelle_weg = ("GPS-Aufzeichnung" if ist_spur
                  else "Kartendaten © OpenStreetMap-Mitwirkende, ODbL")

    return f"""{ANFANG}
      <section class="tour-route flaeche-wald" style="--span: 8">
        <div class="tour-kopf">
          <span class="tour-kopf__label">Wegverlauf<span class="hsep" aria-hidden="true"></span>{kopf_label}</span>
          <span class="tour-kopf__meta">Start → {name}</span>
        </div>
        <div class="tour-route__flaeche">
          <svg class="tour-route__svg" viewBox="0 0 {BREITE} {hoehe_px}" fill="none"
               role="img"
               aria-label="Wegverlauf {name}: {km_text} Kilometer vom Start zum Gipfel, nach OpenStreetMap"
               data-route="{' '.join(f'{a},{b}' for a, b in punkte)}"
               data-km="{route['km']}">
            <!-- Hoehenlinien aus EU-DEM, zur Bauzeit gerechnet. Sie liegen
                 GANZ unten, damit der Weg darueber liest. -->
            <g class="tour-route__relief" aria-hidden="true">
            {relief_pfade}
            </g>
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
                style="left: {gipfel_px[0] / BREITE * 100:.1f}%; top: {gipfel_px[1] / hoehe_px * 100:.1f}%; {anker(gipfel_px[0] / BREITE, gipfel_px[1] / hoehe_px)}">{kurz_name}</span>

          <!-- Kartenrand: Norden, Zahlen, Massstab — ALLES in einem Kasten
               in der freiesten Ecke. Vorher stand der Nordpfeil fest oben
               rechts und lag dort im Wort "START". Und der Kasten hat eine
               feste Breite (30 % der Karte), damit der Massstabsbalken darin
               ein exaktes Prozent haben kann: `%` bezieht sich auf den Kasten,
               nicht auf die Karte. -->
          <div class="tour-route__kartenrand tour-route__kartenrand--{legende_ecke[0]} tour-route__kartenrand--{legende_ecke[1]}">
            <div class="tour-route__fakten">
              <div class="tour-route__fakt">
                <span class="tour-route__fakt-label">{"Strecke" if ist_spur else "Aufstieg"}</span>
                <span class="tour-route__fakt-wert">{km_text} km</span>
              </div>{hoehen_block}
            </div>
            <span class="tour-route__massstab" aria-hidden="true"
                  style="--balken: {balken_anteil / 30 * 100:.1f}%">
              <i></i><em>{balken_text}</em>
            </span>
            <span class="tour-route__norden" aria-hidden="true">
              <svg viewBox="0 0 12 22" fill="none" aria-hidden="true">
                <path d="M6,1 L10,9 L6,7 L2,9 Z" fill="currentColor"/>
              </svg>N
            </span>
          </div>
        </div>
        <p class="tour-route__hint">
          <span class="tour-route__hint-satz">{hinweis_satz}</span>
          <span class="tour-route__quelle">{quelle_weg}{relief_quelle}</span>
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


def selbsttest():
    """Beweist, dass die beiden Waechter anschlagen. Ein Waechter, den man nie
    hat anschlagen sehen, ist keiner — und beide bewachen Fehler, die man dem
    Bild NICHT ansieht: eine verkehrt herum gespeicherte Route sieht genauso
    aus wie eine richtige, verschobene Hoehenlinien sehen aus wie Gelaende."""
    import copy
    quellen = sorted((WURZEL / "touren").glob("*/route.json"))
    if not quellen:
        print("  keine route.json — nichts zu testen")
        return 1

    route = json.loads(quellen[0].read_text(encoding="utf-8"))
    slug = route["slug"]
    html = (WURZEL / "touren" / slug / "index.html").read_text(encoding="utf-8")
    fehler = 0

    # 1) Verkehrt herum MUSS abbrechen
    verdreht = copy.deepcopy(route)
    verdreht["punkte"] = list(reversed(verdreht["punkte"]))
    try:
        abschnitt_bauen(slug, verdreht, html)
        print("  ✗ NICHT ERKANNT: Route verkehrt herum")
        fehler = 1
    except ValueError:
        print("  ✓ erkannt: Route verkehrt herum")

    # 2) Richtig herum MUSS durchgehen
    try:
        abschnitt_bauen(slug, route, html)
        print("  ✓ unveraenderte Route bleibt gruen")
    except ValueError as f:
        print(f"  ✗ FALSCH ROT bei unveraenderter Route: {f}")
        fehler = 1

    # 3) Ein Gitter mit fremdem Ausschnitt MUSS uebersprungen werden
    relief = WURZEL / "touren" / slug / "relief.json"
    if relief.exists():
        echt = json.loads(relief.read_text(encoding="utf-8"))
        gespeichert = relief.read_text(encoding="utf-8")
        echt["ausschnitt"] = [v + 900 for v in echt["ausschnitt"]]
        relief.write_text(json.dumps(echt, ensure_ascii=False,
                                     separators=(",", ":")) + "\n", encoding="utf-8")
        try:
            gebaut = abschnitt_bauen(slug, route, html)
            if "tour-route__hoehenlinie" in gebaut:
                print("  ✗ NICHT ERKANNT: veraltetes Hoehengitter wurde benutzt")
                fehler = 1
            else:
                print("  ✓ erkannt: veraltetes Hoehengitter uebersprungen")
        finally:
            relief.write_text(gespeichert, encoding="utf-8")
    return fehler


def main():
    if "--selbsttest" in sys.argv:
        raise SystemExit(selbsttest())

    slugs = sys.argv[1:] or [
        p.name for p in sorted((WURZEL / "touren").iterdir())
        if (p / "route.json").exists()
    ]
    geaendert = sum(eine_tour(s) for s in slugs)
    print(f"\n{geaendert} von {len(slugs)} Seiten geaendert")


if __name__ == "__main__":
    main()
