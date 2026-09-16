#!/usr/bin/env python3
"""Holt echte Weg-Geometrie aus OpenStreetMap und legt sie als Quelldatei ab.

WARUM SO UND NICHT ANDERS
-------------------------
Die Tour-Seiten laufen unter `script-src 'self'` und `img-src 'self' data:`.
Ein Karten-Embed (Leaflet, Mapbox, Google) braucht fremdes JS UND fremde
Kachel-Bilder — beides ist gesperrt, und die CSP dafuer aufzureissen waere ein
schlechter Tausch fuer ein Bild. Ein Screenshot der Strava-Karte scheidet auch
aus: die Kacheln gehoeren nicht uns, und die Vorschauen sind 359 px breit.

Also: Geometrie EINMAL zur Bauzeit holen, in die Seite backen, selbst zeichnen.
Zur Laufzeit geht dann kein einziger fremder Aufruf raus.

WAHRHEIT
--------
Das hier ist der WEG nach OpenStreetMap, nicht Sebis GPS-Aufzeichnung. Solange
keine GPX-Datei da ist, darf die Seite auch nur das behaupten.

Der Startpunkt wird deshalb nicht geraten, sondern GEWAEHLT: aus allen
plausiblen Ausgangspunkten (Parkplaetze im Umkreis, der Ort aus dem Maps-Link)
gewinnt der, dessen gerouteter Aufstieg am besten zur aufgezeichneten Strecke
passt. Bleibt der beste Treffer weiter als TOLERANZ daneben, kommt gar nichts
raus — lieber keine Route als eine falsche.

Aufruf:  python3 scripts/route-holen.py [slug ...]
Ausgabe: touren/<slug>/route.json  +  touren/assets/routen-quellen.json
"""

import heapq
import json
import math
import pathlib
import re
import sys
import time
import urllib.parse
import urllib.request
from datetime import date

WURZEL = pathlib.Path(__file__).resolve().parent.parent
UA = "vegetarianhulk-tourbau/1.0 (+https://vegetarianhulk.de)"
SPIEGEL = ["https://overpass-api.de/api/interpreter",
           "https://overpass.kumi.systems/api/interpreter"]
NOMINATIM = "https://nominatim.openstreetmap.org/search"

# Wege, auf denen man zu Fuss geht. Autostrassen und Gleise fliegen raus, sonst
# routet Dijkstra die Bergtour ueber die Bundesstrasse.
ZU_FUSS = ("path|footway|track|steps|bridleway|cycleway|pedestrian|"
           "residential|unclassified|service|living_street")

# Ab wann der geroutete Aufstieg der gelaufenen Strecke nicht mehr aehnlich
# genug ist. 35 % Spielraum, weil OSM Serpentinen unterschiedlich fein erfasst
# und die Uhr anders misst. Darueber ist es eine ANDERE Route.
TOLERANZ = 0.35

# Bis hierhin schlaegt die Angabe der Seite (Maps-Link) den am besten passenden
# Parkplatz. Darueber ist der Geocoder zu ungenau getroffen — dann zaehlt die
# Laenge.
MAPS_VORRANG = 0.16

# Wie weit der letzte erreichbare Punkt hoechstens vom Gipfel weg sein darf.
MAX_LUECKE_M = 400


# ── Netz ────────────────────────────────────────────────────────────────────

def hol(url, daten=None, versuche=3, wartezeit=120):
    fehler = None
    for n in range(versuche):
        try:
            anfrage = urllib.request.Request(
                url, data=daten.encode() if daten else None,
                headers={"User-Agent": UA})
            with urllib.request.urlopen(anfrage, timeout=wartezeit) as antwort:
                return json.load(antwort)
        except Exception as f:
            fehler = f
            if n < versuche - 1:
                time.sleep(6 * (n + 1))
    raise fehler


def overpass(abfrage):
    """Der Hauptserver wirft unter Last regelmaessig 504/429 — dann beim
    Spiegel weitermachen, statt die Tour zu verlieren."""
    fehler = None
    for spiegel in SPIEGEL:
        try:
            return hol(spiegel, daten="data=" + urllib.parse.quote(abfrage),
                       versuche=2)["elements"]
        except Exception as f:
            print(f"    {spiegel.split('/')[2]} antwortet nicht ({f})")
            fehler = f
    raise fehler


def meter(a, b):
    """Abstand zweier (lat, lon) in Metern."""
    breite = math.radians((a[0] + b[0]) / 2)
    return math.hypot((b[0] - a[0]) * 111_320,
                      (b[1] - a[1]) * 111_320 * math.cos(breite))


# ── Die Seite als Quelle ────────────────────────────────────────────────────

def seite_lesen(slug):
    html = (WURZEL / "touren" / slug / "index.html").read_text(encoding="utf-8")

    lat = re.search(r'data-lat="([\d.]+)"', html)
    lon = re.search(r'data-lon="([\d.]+)"', html)
    if not (lat and lon):
        raise ValueError("kein data-lat/data-lon in der Seite")

    hoehe = re.search(r'data-hoehe="(\d+)"', html)
    punkte = re.search(r'data-punkte="([^"]+)"', html)

    gesamt = aufstieg = None
    if punkte:
        werte = [(float(k), float(h)) for k, h in
                 (p.split(",") for p in punkte.group(1).split())]
        gesamt = werte[-1][0]
        # Gipfelposition im Profil: dort ist der Aufstieg zu Ende. Genauer als
        # gesamt/2, weil Auf- und Abstieg selten gleich lang sind.
        aufstieg = max(werte, key=lambda w: w[1])[0]

    maps = re.search(r'https://www\.google\.com/maps/search/([^"]+)', html)

    return {
        "gipfel_grob": (float(lat.group(1)), float(lon.group(1))),
        "hoehe": int(hoehe.group(1)) if hoehe else None,
        "gesamt_km": gesamt,
        "aufstieg_km": aufstieg,
        "start_suche": urllib.parse.unquote_plus(maps.group(1)) if maps else None,
    }


# ── Endpunkte ───────────────────────────────────────────────────────────────

def gipfel_genau(slug, grob, hoehe):
    """`data-lat/lon` stehen auf zwei Nachkommastellen — die waren fuers Wetter
    gedacht und liegen bis zu 600 m daneben. Fuer einen Routenendpunkt ist das
    zu grob. Der echte Gipfel kommt aus OSM: Treffer zaehlt, wenn NAME oder
    HOEHE passt."""
    name = slug.capitalize()
    treffer = overpass(f'[out:json][timeout:60];'
                       f'node["natural"="peak"](around:6000,{grob[0]},{grob[1]});out;')

    kandidaten = []
    for t in treffer:
        t_name = (t.get("tags", {}).get("name") or "").strip()
        try:
            t_hoehe = float(t.get("tags", {}).get("ele", "nan"))
        except ValueError:
            t_hoehe = float("nan")
        # t_name MUSS gefuellt sein: ein leerer Name steckt sonst in jedem
        # anderen drin ("" in "fellhorn" ist wahr) und jeder namenlose Huegel
        # gilt als Treffer. Genau das ist hier einmal passiert — der "Gipfel"
        # lag danach 1,7 km neben dem echten.
        name_passt = bool(t_name) and (name.lower() in t_name.lower()
                                       or t_name.lower() in name.lower())
        hoehe_passt = bool(hoehe) and abs(t_hoehe - hoehe) <= 8
        if name_passt or hoehe_passt:
            kandidaten.append((not name_passt, meter((t["lat"], t["lon"]), grob),
                               t["lat"], t["lon"], t_name or "ohne Namen", t_hoehe))

    if not kandidaten:
        print("   ! Kein passender OSM-Gipfel — bleibe bei den groben Koordinaten")
        return grob

    kandidaten.sort()
    _, abstand, lat, lon, t_name, t_hoehe = kandidaten[0]
    print(f"   Gipfel: {t_name} ({t_hoehe:.0f} m) → {lat:.5f}, {lon:.5f} "
          f"· {abstand:.0f} m von der gerundeten Angabe")
    return (lat, lon)


def geokodieren(suche, naehe, max_km=12):
    """Der Maps-Link ist oft eine lange Phrase ('Drachenwand Klettersteig
    St. Lorenz Mondsee'), die Nominatim als Ganzes nicht kennt. Deshalb von
    hinten UND von vorn kuerzen — 'Maria Gern Berchtesgaden' findet man nur,
    wenn 'Wallfahrtskirche' faellt."""
    woerter = suche.split()
    fragen = []
    for n in range(len(woerter), 0, -1):
        fragen.append(" ".join(woerter[:n]))
        if n < len(woerter):
            fragen.append(" ".join(woerter[len(woerter) - n:]))

    gefunden = []
    for frage in dict.fromkeys(fragen):
        url = NOMINATIM + "?" + urllib.parse.urlencode(
            {"q": frage, "format": "json", "limit": 8})
        try:
            treffer = hol(url, versuche=2, wartezeit=30)
        except Exception:
            continue
        time.sleep(1.2)  # Nominatim erlaubt 1 Anfrage/Sekunde.
        for t in treffer:
            ort = (float(t["lat"]), float(t["lon"]))
            if meter(ort, naehe) <= max_km * 1000:
                gefunden.append((ort, f"Maps-Link ({frage})"))
        if gefunden:
            break
    return gefunden


def parkplaetze(gipfel, radius_m):
    """Alle Parkplaetze im Umkreis als moegliche Ausgangspunkte. Welcher es war,
    entscheidet nicht der Name, sondern die Weglaenge (s. beste_route)."""
    treffer = overpass(
        f'[out:json][timeout:70];'
        f'(node["amenity"="parking"](around:{radius_m},{gipfel[0]},{gipfel[1]});'
        f' way["amenity"="parking"](around:{radius_m},{gipfel[0]},{gipfel[1]}););'
        f'out center;')
    orte = []
    for t in treffer:
        mitte = t.get("center") or t
        if "lat" in mitte:
            name = (t.get("tags", {}).get("name") or "ohne Namen").strip()
            orte.append(((mitte["lat"], mitte["lon"]), f"Parkplatz ({name})"))
    return orte


# ── Wegenetz ────────────────────────────────────────────────────────────────

def wege_holen(gipfel, radius_m):
    rand = radius_m / 111_320
    fenster = (f"{gipfel[0] - rand:.4f},{gipfel[1] - rand * 1.5:.4f},"
               f"{gipfel[0] + rand:.4f},{gipfel[1] + rand * 1.5:.4f}")
    abfrage = (f'[out:json][timeout:90];'
               f'way["highway"~"^({ZU_FUSS})$"]["foot"!="no"]'
               f'["access"!="private"]["access"!="no"]({fenster});'
               f'out geom;')
    return overpass(abfrage), fenster


def graph_bauen(wege):
    """Knoten sind gerundete Koordinaten — so treffen sich Wege an Kreuzungen."""
    nachbarn = {}
    for weg in wege:
        punkte = [(round(p["lat"], 6), round(p["lon"], 6))
                  for p in weg.get("geometry", [])]
        for a, b in zip(punkte, punkte[1:]):
            if a == b:
                continue
            laenge = meter(a, b)
            nachbarn.setdefault(a, []).append((b, laenge, weg["id"]))
            nachbarn.setdefault(b, []).append((a, laenge, weg["id"]))
    return nachbarn


def dijkstra(nachbarn, von):
    """Einmal vom Gipfel aus ueber das ganze Netz. Danach ist die Entfernung zu
    JEDEM erreichbaren Punkt bekannt — jeder Startkandidat kostet dann nur noch
    einen Nachschlag statt eines eigenen Laufs."""
    weite = {von: 0.0}
    davor = {}
    schlange = [(0.0, von)]
    fertig = set()

    while schlange:
        d, knoten = heapq.heappop(schlange)
        if knoten in fertig:
            continue
        fertig.add(knoten)
        for nachbar, laenge, weg_id in nachbarn.get(knoten, []):
            neu = d + laenge
            if neu < weite.get(nachbar, float("inf")):
                weite[nachbar] = neu
                davor[nachbar] = (knoten, weg_id)
                heapq.heappush(schlange, (neu, nachbar))
    return weite, davor, fertig


def pfad_zurueck(davor, ziel):
    pfad, wege_ids, knoten = [ziel], set(), ziel
    while knoten in davor:
        knoten, weg_id = davor[knoten]
        wege_ids.add(weg_id)
        pfad.append(knoten)
    return pfad, sorted(wege_ids)


def ausduennen(pfad, ziel_anzahl=90):
    """Gleichmaessig nach Strecke abtasten, nicht jeden N-ten Punkt nehmen —
    sonst werden dicht erfasste Serpentinen ueber- und gerade Stuecke
    untergewichtet."""
    if len(pfad) <= ziel_anzahl:
        return pfad
    strecken = [0.0]
    for a, b in zip(pfad, pfad[1:]):
        strecken.append(strecken[-1] + meter(a, b))
    gesamt = strecken[-1]

    heraus, n = [], 0
    for i in range(ziel_anzahl):
        wunsch = gesamt * i / (ziel_anzahl - 1)
        while n < len(strecken) - 1 and strecken[n + 1] < wunsch:
            n += 1
        heraus.append(pfad[n])
    heraus[-1] = pfad[-1]
    return [p for i, p in enumerate(heraus) if i == 0 or p != heraus[i - 1]]


# ── Auswahl ─────────────────────────────────────────────────────────────────

def beste_route(nachbarn, gipfel, kandidaten, erwartet_km):
    """Aus allen Ausgangspunkten den waehlen, dessen Weg zum Gipfel am besten
    zur aufgezeichneten Aufstiegsstrecke passt. Das ersetzt das Raten: ein
    falscher Parkplatz faellt durch die Laenge auf."""
    gipfel_knoten = min(nachbarn, key=lambda k: meter(k, gipfel))
    luecke = meter(gipfel_knoten, gipfel)
    if luecke > MAX_LUECKE_M:
        return None, f"Gipfel {luecke:.0f} m vom naechsten Weg entfernt"

    weite, davor, erreichbar = dijkstra(nachbarn, gipfel_knoten)
    print(f"   {len(erreichbar)} von {len(nachbarn)} Knoten vom Gipfel aus erreichbar")

    bewertet = []
    for ort, herkunft in kandidaten:
        nahe = [k for k in erreichbar if meter(k, ort) < 250]
        if not nahe:
            continue
        knoten = min(nahe, key=lambda k: meter(k, ort))
        km = weite[knoten] / 1000
        if km < 0.3:
            continue  # direkt am Gipfel = kein Ausgangspunkt
        abweichung = abs(km - erwartet_km) / erwartet_km
        bewertet.append((abweichung, km, knoten, ort, herkunft, meter(knoten, ort)))

    if not bewertet:
        return None, "kein Ausgangspunkt ans Wegenetz angeschlossen"

    # Was die SEITE sagt, schlaegt was am besten passt. Der Maps-Link auf der
    # Tourseite ist Sebis eigene Angabe ("Unten in Blindau, 5 € Tagesticket") —
    # ein namenloser Parkplatz, dessen Weglaenge zufaellig besser trifft, ist
    # trotzdem der falsche Ausgangspunkt. Am 16.09. starteten so alle vier
    # Karten woanders als im Text; beim Fellhorn lag der gewaehlte Parkplatz
    # suedlich des Gipfels, waehrend Blindau noerdlich liegt.
    # Die Laenge bleibt Pruefung — nur nicht mehr Auswahlkriterium erster Wahl.
    # ... aber nur, wenn die Angabe auch plausibel ist. Nominatim liefert fuer
    # "Maria Gern" das Ortszentrum, nicht den Parkplatz gegenueber der Kirche —
    # das waeren 35 % Abweichung gegen 3 % beim richtigen Parkplatz. Deshalb
    # gilt der Vorrang nur innerhalb eines engen Bandes; darueber entscheidet
    # wieder die Laenge.
    bewertet.sort(key=lambda e: (not (e[4].startswith("Maps-Link")
                                      and e[0] <= MAPS_VORRANG), e[0]))

    print(f"   {len(bewertet)} Ausgangspunkte geprueft, die drei besten:")
    for abw, km, _, _, herkunft, _ in bewertet[:3]:
        print(f"     {km:5.2f} km ({abw * 100:3.0f} % ab) — {herkunft}")

    # Aus der Liste den ersten nehmen, der die Toleranz haelt: erst die Angabe
    # der Seite, dann die Parkplaetze.
    treffer = next((e for e in bewertet if e[0] <= TOLERANZ), None)
    if not treffer:
        abweichung, km = bewertet[0][0], bewertet[0][1]
        return None, (f"bester Treffer {km:.2f} km gegen {erwartet_km:.2f} km "
                      f"aufgezeichnet ({abweichung * 100:.0f} % ab)")
    abweichung, km, knoten, ort, herkunft, versatz = treffer
    if not herkunft.startswith("Maps-Link"):
        print(f"   ! Der Ort aus dem Maps-Link der Seite passt nicht "
              f"(oder fehlt) — es gilt: {herkunft}")

    # pfad_zurueck laeuft VOM Startknoten ueber `davor` zurueck zur Dijkstra-
    # Wurzel (dem Gipfel) und haengt dabei an — das Ergebnis ist also schon
    # Start → Gipfel. Das zusaetzliche reverse() hier drehte es um, und danach
    # sass der Start-Punkt auf dem Gipfel und das Gipfelkreuz am Parkplatz.
    # Die Linie sah dabei voellig richtig aus; nur ihre Enden logen.
    pfad, wege_ids = pfad_zurueck(davor, knoten)
    return {
        "pfad": pfad, "wege_ids": wege_ids, "km": km, "abweichung": abweichung,
        "start": ort, "herkunft": herkunft, "versatz_m": versatz,
        "luecke_m": luecke,
    }, None


# ── Eine Tour ───────────────────────────────────────────────────────────────

def eine_tour(slug):
    print(f"\n── {slug}")
    seite = seite_lesen(slug)
    if not seite["aufstieg_km"]:
        raise ValueError("kein Hoehenprofil in der Seite — keine Vergleichsstrecke")

    gipfel = gipfel_genau(slug, seite["gipfel_grob"], seite["hoehe"])
    erwartet = seite["aufstieg_km"]
    radius = max(3000, erwartet * 1400)
    print(f"   Aufstieg laut Profil: {erwartet:.2f} km → Suchradius {radius / 1000:.1f} km")

    kandidaten = []
    if seite["start_suche"]:
        kandidaten += geokodieren(seite["start_suche"], gipfel)
    kandidaten += parkplaetze(gipfel, radius)
    print(f"   {len(kandidaten)} moegliche Ausgangspunkte")

    wege, fenster = wege_holen(gipfel, radius)
    nachbarn = graph_bauen(wege)
    print(f"   {len(wege)} Wege · {len(nachbarn)} Knoten im Fenster {fenster}")

    ergebnis, grund = beste_route(nachbarn, gipfel, kandidaten, erwartet)
    if not ergebnis:
        print(f"   ✗ {grund} — wird NICHT veroeffentlicht.")
        return {"slug": slug, "verworfen": True, "grund": grund}

    duenn = ausduennen(ergebnis["pfad"])
    print(f"   ✓ {ergebnis['km']:.2f} km · {len(duenn)} Punkte · "
          f"{len(ergebnis['wege_ids'])} OSM-Wege · Start {ergebnis['herkunft']}")

    return {
        "slug": slug,
        "verworfen": False,
        "punkte": [[round(p[0], 5), round(p[1], 5)] for p in duenn],
        "start": [round(ergebnis["start"][0], 5), round(ergebnis["start"][1], 5)],
        "gipfel": [round(gipfel[0], 5), round(gipfel[1], 5)],
        "km": round(ergebnis["km"], 2),
        "erwartet_km": round(erwartet, 2),
        "abweichung": round(ergebnis["abweichung"], 3),
        "start_herkunft": ergebnis["herkunft"],
        "luecke_m": round(ergebnis["luecke_m"]),
        "osm_wege": ergebnis["wege_ids"],
        "geholt_am": date.today().isoformat(),
        "quelle": "OpenStreetMap (ODbL 1.0)",
    }


def main():
    # Nur das Inhaltsverzeichnis neu ableiten, ohne OSM zu befragen.
    nur_verzeichnis = "--nur-verzeichnis" in sys.argv
    argumente = [a for a in sys.argv[1:] if not a.startswith("--")]
    slugs = [] if nur_verzeichnis else argumente or [
        p.name for p in sorted((WURZEL / "touren").iterdir())
        if (p / "index.html").exists()
    ]

    # Das Verzeichnis wird aus den route.json ABGELEITET, nicht angesammelt.
    # Vorher hat ein Einzellauf (`route-holen.py drachenwand`) die Eintraege
    # aller anderen Touren stillschweigend geloescht — weil die Datei das
    # Gedaechtnis war statt nur die Anzeige. Jetzt sind die route.json die
    # Wahrheit und diese Datei nur ihr Inhaltsverzeichnis.
    verzeichnis = WURZEL / "touren" / "assets" / "routen-quellen.json"
    quellen = {}
    for datei in sorted((WURZEL / "touren").glob("*/route.json")):
        r = json.loads(datei.read_text(encoding="utf-8"))
        quellen[r["slug"]] = {k: r[k] for k in
                              ("km", "erwartet_km", "abweichung", "start_herkunft",
                               "luecke_m", "geholt_am") if k in r}
        quellen[r["slug"]]["punkte"] = len(r["punkte"])
        quellen[r["slug"]]["osm_wege"] = r["osm_wege"]

    for slug in slugs:
        try:
            ergebnis = eine_tour(slug)
        except Exception as fehler:
            print(f"   ✗ {slug}: {fehler}")
            quellen[slug] = {"fehler": str(fehler)}
            continue

        if ergebnis["verworfen"]:
            quellen[slug] = {"verworfen": True, "grund": ergebnis["grund"]}
            continue

        ziel = WURZEL / "touren" / slug / "route.json"
        ziel.write_text(json.dumps(ergebnis, ensure_ascii=False, indent=1) + "\n",
                        encoding="utf-8")
        quellen[slug] = {k: ergebnis[k] for k in
                         ("km", "erwartet_km", "abweichung", "start_herkunft",
                          "luecke_m", "geholt_am")}
        quellen[slug]["punkte"] = len(ergebnis["punkte"])
        quellen[slug]["osm_wege"] = ergebnis["osm_wege"]
        quellen.pop(slug + "__alt", None)
        print(f"   → {ziel.relative_to(WURZEL)}")

    verzeichnis.write_text(
        json.dumps({
            "hinweis": "Weg-Geometrie aus OpenStreetMap, einmal zur Bauzeit geholt. "
                       "Kein Laufzeit-Aufruf, keine fremden Kacheln. Das ist der WEG, "
                       "nicht die GPS-Aufzeichnung.",
            "lizenz": "© OpenStreetMap-Mitwirkende, ODbL 1.0",
            "toleranz": TOLERANZ,
            "auswahl": "Startpunkt = der Kandidat, dessen gerouteter Aufstieg am "
                       "besten zur aufgezeichneten Strecke passt.",
            "touren": dict(sorted(quellen.items())),
        }, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("\n✓ touren/assets/routen-quellen.json")


if __name__ == "__main__":
    main()
