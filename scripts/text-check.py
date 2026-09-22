#!/usr/bin/env python3
"""Verbietet Erklaer-Fussnoten, die den Besucher nichts angehen.

WARUM
Sebi am 22.09.2026: "bitte lasse so doofe erklaerungen weg wie bei den
4 kreuzen 'OSM kennt es als Wegkreuz, nicht als Gipfel'. das is so zu
viel explaining. also mehrwert ja aber das juckt niemand, das bei vielen
punkten oft so drunter wo du was erklaerst was den besucher nichts
angeht."

Er hat recht, und es war ein Muster, kein Einzelfall. Unter fast jedem
Element stand eine Zeile, die MEINE ARBEIT erklaert: woher eine Zahl
stammt, wie ein Verlauf nachgezeichnet wurde, was eine Datenbank anders
sieht. Das ist Belegkette — sie gehoert in die Quelldateien und in die
Notizen, nicht auf die Seite.

DER TEST, DER ENTSCHEIDET
    Hilft dieser Satz dem Besucher, etwas zu TUN oder zu ENTSCHEIDEN?
    Oder verteidigt er meine Arbeit?

  BLEIBT   "Zum Ablesen drueberfahren"            → sagt, wie man es bedient
  BLEIBT   "bis zum Gipfel — der Rueckweg lief    → beantwortet eine Frage,
            nicht mit"                              die das BILD aufwirft
  BLEIBT   "Amazon-Partnerlink: ... Provision"    → § 5a Abs. 4 UWG
  BLEIBT   "Sentinel-2 cloudless (EOX, CC BY 4.0)"→ Lizenzpflicht
  BLEIBT   "Aufgezeichnet mit Apple Watch+Strava" → EINMAL je Seite, unter
                                                    den Zahlen: das ist das
                                                    Versprechen der Seite
  RAUS     "OSM kennt es als Wegkreuz"            → Herkunfts-Erklaerung
  RAUS     "Werte aus Strava, Verlauf             → Methodik
            nachgezeichnet"
  RAUS     "· GPS 13,46 km, Uhr 15,10 km"         → interne Abweichung
  RAUS     "Ankunftszeiten aus der eigenen        → steht schon im Hero
            GPX-Aufzeichnung"                       ("selbst getrackt")

WAS DIESES TOR PRUEFEN KANN
"Ist das Meta?" ist maschinell nicht entscheidbar. Pruefbar ist die
Form, in der es bisher IMMER aufgetreten ist: eine Datenquelle wird im
sichtbaren Text genannt. Erlaubt ist das genau an den Stellen, die eine
Lizenz oder das Versprechen der Seite verlangen — und dort hoechstens
EINMAL je Seite.

Aufruf:  python3 scripts/text-check.py [--selbsttest]
"""

import html as html_mod
import pathlib
import re
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent

# Datenquellen, deren Nennung im sichtbaren Text erklaerungsverdaechtig ist.
QUELLEN = re.compile(
    r"\b(OSM|OpenStreetMap|Strava|Bergfex|GPX|EU-?DEM|Sentinel-2|Overpass|"
    r"Open-Meteo|Nominatim|Apple\s+Watch)\b", re.I)

# Die zwei Stellen, an denen Herkunft hingehoert — und warum.
ERLAUBTE_TRAEGER = {
    # EINE Stelle je Seite, ganz unten vor dem Fuss. Vorher waren es vier.
    "tour-quellen__punkt": "Quellenblock vor dem Fuss (Lizenz + Versprechen)",
    "tour-quellen__liste": "Quellenblock vor dem Fuss",
    # Open-Meteo steht unter CC BY 4.0 — die Nennung am Messwert ist
    # Lizenzpflicht, nicht Erklaerung.
    "tk-live__src": "Lizenznennung am Live-Wetter (CC BY 4.0)",
    "hud-src": "Live-Wetter — die Quelle gehoert an den Messwert",
    "gb-quelle": "Bibelstelle, keine Datenquelle",
}

# Formulierungen, die IMMER Methodik sind, egal wo sie stehen.
IMMER_RAUS = [
    (re.compile(r"nachgezeichnet", re.I), "wie etwas gezeichnet wurde, ist Werkstatt"),
    (re.compile(r"\bskaliert\b", re.I), "Rechenweg statt Inhalt"),
    (re.compile(r"auf \d+\s*m gerundet", re.I), "Rundungsregel ist Werkstatt"),
    (re.compile(r"\bkennt es als\b|\blaut (?:OSM|OpenStreetMap)\b", re.I),
     "was eine Datenbank anders sieht, geht den Besucher nichts an"),
    (re.compile(r"GPS\s*[\d.,]+\s*km,\s*Uhr\s*[\d.,]+\s*km", re.I),
     "interne Messabweichung"),
    (re.compile(r"\bamtlich\b\s*[\d.]+\s*m", re.I), "Katasterwert als Fussnote"),
]

# Die Rechtsseiten sind die DESIGNIERTE Stelle fuer die ganze Belegkette:
# Impressum traegt die Lizenz-Nachweise (ODbL, CC BY, Copernicus), Datenschutz
# muss jeden Drittanbieter namentlich nennen. Ein Tor, das dort rot wird,
# waere rot fuer genau das, was Pflicht ist — und wuerde danach ignoriert.
RECHTSSEITEN = {"impressum.html", "datenschutz.html"}

TAG = re.compile(r"<[^>]+>")
SKRIPT = re.compile(r"<(script|style)\b.*?</\1>", re.S | re.I)
KOMMENTAR = re.compile(r"<!--.*?-->", re.S)


def sichtbarer_text(rohes_html):
    """Nur, was der Besucher liest. Kommentare, Skripte und Attribute nicht:
    dort DARF die Belegkette stehen — sie gehoert sogar dorthin."""
    t = KOMMENTAR.sub(" ", SKRIPT.sub(" ", rohes_html))
    return t


def traeger_von(text, pos):
    """Die class des Elements, in dem eine Fundstelle steht."""
    auf = text.rfind("<", 0, pos)
    while auf != -1:
        zu = text.find(">", auf)
        if zu != -1 and zu < pos:
            m = re.search(r'class="([^"]*)"', text[auf:zu])
            if m:
                return m.group(1).split()
        auf = text.rfind("<", 0, auf)
        if pos - auf > 600:
            break
    return []


def datei_pruefen(pfad, rohes_html):
    if pathlib.PurePath(pfad).name in RECHTSSEITEN:
        return []
    befunde = []
    t = sichtbarer_text(rohes_html)

    for regel, grund in IMMER_RAUS:
        for m in regel.finditer(TAG.sub(" ", t)):
            befunde.append((pfad, grund, m.group(0)[:50]))

    gezaehlt = {}
    for m in QUELLEN.finditer(t):
        # Nur was zwischen den Tags steht, nicht in Attributen (alt, title,
        # href) — dort ist eine Quellennennung sachlich und oft noetig.
        vor_auf = t.rfind("<", 0, m.start())
        vor_zu = t.rfind(">", 0, m.start())
        if vor_auf > vor_zu:
            continue
        klassen = traeger_von(t, m.start())
        erlaubt = [k for k in klassen if k in ERLAUBTE_TRAEGER]
        if erlaubt:
            k = erlaubt[0]
            gezaehlt[k] = gezaehlt.get(k, 0) + 1
            continue
        befunde.append((pfad, f"Datenquelle '{m.group(0)}' im Fliesstext — "
                              f"Herkunft gehoert in die Belegkette, nicht auf die Seite",
                        t[max(0, m.start() - 40):m.end() + 40].replace("\n", " ")[:80]))

    # Die Zahl der genannten Quellen ist NICHT der Punkt — ein Quellenblock
    # listet naturgemaess mehrere. Gezaehlt wird, wie oft der BLOCK vorkommt:
    # zweimal auf einer Seite hiesse, die Angabe steht wieder verteilt.
    for traeger in ("tour-quellen__liste", "tk-live__src", "hud-src"):
        n = rohes_html.count(f'class="{traeger}"')
        if n > 1:
            befunde.append((pfad, f".{traeger} steht {n}× auf der Seite — "
                                  "die Herkunft gehoert an EINE Stelle", ""))
    return befunde


def selbsttest():
    kaputt = [
        ('<span class="tour-kreuz__osm">OSM kennt es als Wegkreuz, nicht als Gipfel</span>',
         "Herkunfts-Fussnote"),
        ('<p class="tour-profil__hint">Zum Ablesen drüberfahren · Werte aus Strava, '
         'Verlauf nachgezeichnet.</p>', "Methodik"),
        ('<p class="hint">Aufgezeichnete Spur · GPS 13,46 km, Uhr 15,10 km</p>',
         "interne Abweichung"),
        ('<p class="x">Verlauf aus dem Bergfex-Profil nachgezeichnet, auf 10 m gerundet.</p>',
         "Rundungsregel"),
    ]
    for probe, name in kaputt:
        if not datei_pruefen("FIXTURE", probe):
            print(f"✗ SELBSTTEST: {name} wird NICHT erkannt — das Tor ist blind.")
            return 1

    sauber = [
        '<p class="tour-profil__hint">Zum Ablesen drüberfahren</p>',
        '<p class="tour-route__hint-satz">Aufgezeichnete Spur bis zum Gipfel — '
        'der Rückweg lief nicht mit.</p>',
        '<p class="tour-quellen__liste"><span class="tour-quellen__punkt">Sentinel-2 '
        'cloudless von EOX (CC BY 4.0)</span></p>',
        '<p class="pp-fine">Amazon-Partnerlink: Wenn du darüber kaufst, erhalte ich '
        'eine Provision. Für dich entstehen keine Mehrkosten.</p>',
        # In Attributen und Kommentaren darf die Belegkette stehen.
        '<img alt="Screenshot aus Strava mit dem Höhenprofil">',
        '<!-- Werte aus der eigenen GPX-Aufzeichnung, siehe route.json -->',
    ]
    # Die Rechtsseiten duerfen und muessen alles nennen.
    # Ein Quellenblock darf mehrere Quellen listen — das ist sein Zweck.
    viele = ('<p class="tour-quellen__liste">'
             '<span class="tour-quellen__punkt">Apple Watch + Strava</span>'
             '<span class="tour-quellen__punkt">Sentinel-2 von EOX (CC BY 4.0)</span>'
             '<span class="tour-quellen__punkt">EU-DEM</span>'
             '<span class="tour-quellen__punkt">Open-Meteo</span></p>')
    if datei_pruefen("FIXTURE", viele):
        print("✗ SELBSTTEST: ein Quellenblock mit mehreren Quellen wird gemeldet — "
              "genau dafuer ist er da.")
        return 1
    # Zweimal derselbe Block auf einer Seite ist dagegen wieder Verteilung.
    if not datei_pruefen("FIXTURE", viele + viele):
        print("✗ SELBSTTEST: zwei Quellenbloecke auf einer Seite werden nicht erkannt.")
        return 1

    if datei_pruefen("impressum.html",
                     '<p>Kartendaten: OpenStreetMap-Mitwirkende, ODbL. '
                     'Luftbild: Sentinel-2 cloudless von EOX, CC BY 4.0.</p>'):
        print("✗ SELBSTTEST: Rechtsseite gemeldet — dort ist die Nennung Pflicht.")
        return 1
    for probe in sauber:
        b = datei_pruefen("FIXTURE", probe)
        if b:
            print(f"✗ SELBSTTEST: erlaubter Fall gemeldet — {probe[:56]!r}\n    {b[0][1]}")
            return 1

    print("✓ Selbsttest: Herkunfts-Fussnoten und Methodik werden erkannt; "
          "Bedienhilfe, Lizenz, Pflichthinweis, Attribute und Kommentare bleiben grün.")
    return 0


def main():
    if "--selbsttest" in sys.argv:
        return selbsttest()

    dateien = [p for p in WURZEL.rglob("*.html")
               if ".git" not in p.parts and "node_modules" not in p.parts]
    befunde = []
    for p in dateien:
        befunde += datei_pruefen(str(p.relative_to(WURZEL)),
                                 p.read_text(encoding="utf-8", errors="replace"))

    if befunde:
        print(f"✗ text-check: {len(befunde)} Erklaer-Fussnote(n) auf {len(dateien)} Seiten:")
        for pfad, grund, stelle in befunde[:14]:
            print(f"    {pfad}")
            print(f"      {grund}")
            if stelle:
                print(f"      … {stelle.strip()} …")
        print("\n  Test: hilft der Satz dem Besucher, etwas zu TUN oder zu ENTSCHEIDEN?")
        print("  Oder verteidigt er unsere Arbeit? Belegkette gehoert in die Quelldateien.")
        return 1

    print(f"✓ text-check: {len(dateien)} Seiten, keine Erklaer-Fussnoten.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
