#!/usr/bin/env python3
"""Sammelt alle Quellenangaben einer Tourseite in EINE Zeile vor dem Fuss.

WARUM
Sebi am 22.09.2026: "das is so zu viel explaining ... das bei vielen
punkten oft so drunter wo du was erklaerst was den besucher nichts
angeht" — und auf Rueckfrage: "ja dann mach unten vor dem footer quellen
oder so idk haha aber des andere viele zeug text nervt und stoert beim
betrachten einfach."

Vorher stand die Herkunft verteilt: unter den Zahlen, unter der Karte,
unter jedem Kreuz. Vier Fussnoten auf einer Seite, die alle dasselbe
sagen — woher wir das wissen. Beim Ansehen stoert das, und beim Lesen
beantwortet es eine Frage, die niemand gestellt hat.

Jetzt: eine unaufdringliche Zeile ganz unten. Wer sie sucht, findet sie;
wer die Tour ansieht, stolpert nicht mehr darueber.

RECHTLICH BLEIBT ALLES ERFUELLT. CC BY 4.0 und ODbL verlangen eine
Nennung, die dem Medium ANGEMESSEN ist — ein Quellen-Block am Seitenende
ist die uebliche und anerkannte Form. Der Wortlaut ist vorgeschrieben und
steht deshalb als Konstante hier, nicht als Prosa: "OpenStreetMap-
Mitwirkende" (nicht "OpenStreetMap"), "EOX", "CC BY 4.0".

Aufruf:  python3 scripts/quellen-einbauen.py [slug ...]
         python3 scripts/quellen-einbauen.py --selbsttest
"""

import json
import pathlib
import re
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
ANFANG = "<!-- QUELLEN (erzeugt: scripts/quellen-einbauen.py) -->"
ENDE = "<!-- /QUELLEN -->"

# Pflicht-Wortlaute. Beim Kuerzen von Fussnoten wurde daraus schon einmal
# "© OpenStreetMap" — die ODbL verlangt die erste Form. Lizenzangaben sind
# Zeichenketten mit vorgeschriebenem Wortlaut, keine Prosa.
ODBL = "© OpenStreetMap-Mitwirkende"
EOX = "Sentinel-2 cloudless von EOX (CC BY 4.0)"
DEM = "Höhenlinien aus EU-DEM (Copernicus)"


def posten(slug, html):
    """Nur nennen, was die Seite WIRKLICH verwendet."""
    p = []
    ordner = WURZEL / "touren" / slug

    if "Apple Watch" in html or "Strava" in html or (ordner / "route.json").exists():
        quelle = "Apple Watch + Strava"
        if "Bergfex" in html:
            quelle = "Apple Watch + Bergfex"
        p.append(f"Zahlen und Spur selbst aufgezeichnet ({quelle})")

    if (ordner / "gelaende.jpg").exists():
        p.append(EOX)
    if (ordner / "relief.json").exists():
        p.append(DEM)

    r = ordner / "route.json"
    if r.exists():
        try:
            d = json.loads(r.read_text(encoding="utf-8"))
        except ValueError:
            d = {}
        # Nur wo die Linie tatsaechlich aus OpenStreetMap kommt. Bei einer
        # eigenen GPS-Spur waere die Nennung falsch — und eine Lizenzangabe
        # fuer etwas, das man nicht benutzt, ist keine Sorgfalt, sondern Laerm.
        if d.get("art") != "spur" or d.get("osm_wege"):
            p.append(f"Wegverlauf {ODBL}")
    if "Open-Meteo" in html or "data-wetter" in html:
        p.append("Live-Wetter von Open-Meteo (CC BY 4.0)")
    return p


def bauen(liste):
    zeilen = "<span class=\"tour-quellen__punkt\">" + \
             "</span><span class=\"tour-quellen__punkt\">".join(liste) + "</span>"
    return f'''{ANFANG}
  <aside class="tour-quellen" aria-label="Quellen">
    <span class="tour-quellen__label">Quellen</span>
    <p class="tour-quellen__liste">{zeilen}</p>
  </aside>
  {ENDE}'''


def eine_tour(slug):
    seite = WURZEL / "touren" / slug / "index.html"
    if not seite.exists():
        return False
    t = seite.read_text(encoding="utf-8")

    # Bestehenden Block ersetzen statt anhaengen.
    if ANFANG in t:
        block = re.search(r"[ \t]*\n?\s*" + re.escape(ANFANG) + r".*?"
                          + re.escape(ENDE) + r"[ \t]*\n?", t, re.S)
        if not block:
            raise ValueError(f"{slug}: Marker ohne Gegenstueck")
        t = t[:block.start()] + "\n" + t[block.end():]

    # Die verstreuten Fussnoten einsammeln und entfernen.
    entfernt = 0
    for muster in (r'\s*<p class="src">[^<]*</p>',
                   r'\s*<span class="tour-route__quelle">[^<]*</span>'):
        t, n = re.subn(muster, "", t)
        entfernt += n

    liste = posten(slug, t)
    if not liste:
        seite.write_text(t, encoding="utf-8")
        print(f"  {slug}: nichts zu belegen")
        return False

    anker = t.find("<footer")
    if anker == -1:
        raise ValueError(f"{slug}: kein <footer> — wo soll der Block hin?")
    neu = t[:anker] + bauen(liste) + "\n\n" + t[anker:]
    neu = re.sub(r"\n[ \t]+\n", "\n\n", neu)
    neu = re.sub(r"\n{3,}", "\n\n", neu)
    seite.write_text(neu, encoding="utf-8")
    print(f"  {slug}: {len(liste)} Quelle(n) unten, {entfernt} Fussnote(n) entfernt")
    return True


def selbsttest():
    g = bauen(["Zahlen selbst aufgezeichnet", EOX, f"Wegverlauf {ODBL}"])
    if "© OpenStreetMap-Mitwirkende" not in g:
        print('✗ SELBSTTEST: ODbL verlangt OpenStreetMap-Mitwirkende, Wortlaut verloren')
        return 1
    if "CC BY 4.0" not in g or "EOX" not in g:
        print("✗ SELBSTTEST: CC-BY-Nennung fehlt")
        return 1
    if re.search(r"©\s*OpenStreetMap(?!-Mitwirkende)", g):
        print('✗ SELBSTTEST: verkuerzte OSM-Angabe, rechtlich nicht ausreichend')
        return 1

    # Eine eigene GPS-Spur ohne OSM-Wege darf OSM NICHT nennen.
    import tempfile
    with tempfile.TemporaryDirectory() as tmp:
        d = pathlib.Path(tmp) / "touren" / "probe"
        d.mkdir(parents=True)
        (d / "route.json").write_text(json.dumps({"art": "spur", "osm_wege": []}))
        global WURZEL
        merk, WURZEL = WURZEL, pathlib.Path(tmp)
        try:
            p_spur = posten("probe", "<p>Apple Watch</p>")
            (d / "route.json").write_text(json.dumps({"art": "osm", "osm_wege": [1]}))
            p_osm = posten("probe", "<p>Apple Watch</p>")
        finally:
            WURZEL = merk
    if any("OpenStreetMap" in x for x in p_spur):
        print('✗ SELBSTTEST: eigene Spur nennt OSM, Lizenzangabe fuer etwas Unbenutztes')
        return 1
    if not any("OpenStreetMap" in x for x in p_osm):
        print('✗ SELBSTTEST: OSM-Route nennt OSM NICHT, Lizenzverstoss')
        return 1


    # IDEMPOTENZ am ECHTEN Baum. Genau hier lief es am 22.09.2026 vorbei:
    # der Selbsttest prueft Fixtures, und das WACHSEN der Datei zeigt sich
    # erst, wenn man dieselbe Seite zweimal baut. kern.md: erst wenn Lauf 2
    # und Lauf 3 byte-gleich sind, ist der Umbau stabil.
    import hashlib, shutil, tempfile
    beispiel = None
    for k in sorted((WURZEL / "touren").iterdir()):
        if (k / "index.html").exists() and ANFANG in (k / "index.html").read_text(encoding="utf-8"):
            beispiel = k
            break
    if beispiel:
        with tempfile.TemporaryDirectory() as tmp:
            sicher = pathlib.Path(tmp) / "vorher.html"
            shutil.copy(beispiel / "index.html", sicher)
            try:
                eine_tour(beispiel.name)
                a = hashlib.md5((beispiel / "index.html").read_bytes()).hexdigest()
                eine_tour(beispiel.name)
                b = hashlib.md5((beispiel / "index.html").read_bytes()).hexdigest()
            finally:
                shutil.copy(sicher, beispiel / "index.html")
        if a != b:
            print(f"✗ SELBSTTEST: zweiter Lauf aendert die Datei erneut ({beispiel.name}) — "
                  "der Einbau haeuft Leerraum an und die Seite waechst bei jedem Bau.")
            return 1

    print("✓ Selbsttest: Pflicht-Wortlaute stehen, OSM nur wo benutzt, "
          "verkuerzte Angabe wird erkannt, zweiter Lauf stabil.")
    return 0


def main():
    if "--selbsttest" in sys.argv:
        return selbsttest()
    slugs = [a for a in sys.argv[1:] if not a.startswith("-")] or [
        p.name for p in sorted((WURZEL / "touren").iterdir())
        if (p / "index.html").exists()
    ]
    n = sum(bool(eine_tour(s)) for s in slugs)
    print(f"\n{n} von {len(slugs)} Seiten mit Quellenblock")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
