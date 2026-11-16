#!/usr/bin/env python3
"""Baut die Daten des Weihnachtsmarkt-Radars aus allen oeffentlichen Quellen.

    python3 scripts/markt/bauen.py            # mit Zwischenablage
    python3 scripts/markt/bauen.py --frisch   # alles neu abrufen (woechentlicher Lauf)

Schreibt weihnachtsmarkt/daten/{maerkte,plz,stand}.json. Danach pruefen.py.
"""
import json
import math
import re
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from datum import THEMA, aus_seite, klartext  # noqa: E402
from netz import hole  # noqa: E402
import quellen  # noqa: E402

JAHR = 2026
ZIEL = Path(__file__).resolve().parents[2] / 'weihnachtsmarkt' / 'daten'
ORTE = Path(__file__).parent / 'orte.json'
GLEICHER_MARKT_M = 150
ABRUFE_GLEICHZEITIG = 8
NOMINATIM = 'https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&accept-language=de&lat={lat}&lon={lon}'
NOMINATIM_PAUSE_S = 1.1
ARTEN = [('christkind', 'Christkindlmarkt'), ('advent', 'Adventsmarkt'), ('nikolaus', 'Nikolausmarkt'),
         ('mittelalter', 'Mittelalterlicher Weihnachtsmarkt'), ('winter', 'Wintermarkt')]


def meter(a, b):
    r = 6371000.0
    p1, p2 = math.radians(a['lat']), math.radians(b['lat'])
    h = math.sin((p2 - p1) / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(math.radians(b['lon'] - a['lon']) / 2) ** 2
    return 2 * r * math.asin(math.sqrt(h))


ALLERWELT = {'weihnachtsmarkt', 'christkindlmarkt', 'christkindlesmarkt', 'adventsmarkt', 'nikolausmarkt', 'markt',
             'der', 'die', 'das', 'dem', 'den', 'und', 'auf', 'bei', 'mit', 'vor', 'romantischer', 'traditioneller',
             'historischer', 'kleiner', 'großer', 'unser', 'weihnachtsmärkte'}
SELBER_PLATZ_M = 40
ENGLISCH = re.compile(r'\b(market|christmas|fair)\b', re.I)
FELDER_ERGAENZEN = ('name', 'link', 'platz', 'zeiten', 'eintritt', 'ort', 'plz', 'kreis', 'bezirk', 'land')
FELDER_TERMIN = ('termine', 'quelle', 'quelle_url', 'beleg', 'zeiten', 'lizenz', 'vermerk')


def kernworte(name):
    return {w for w in re.findall(r'[a-zäöüß]{3,}', name.lower()) if w not in ALLERWELT}


def gleich(a, b):
    """Derselbe Markt? Nah beieinander und im Namen verwandt – oder am selben Fleck aus zwei Quellen."""
    if abs(a['lat'] - b['lat']) > 0.002:
        return False
    abstand = meter(a, b)
    if abstand >= GLEICHER_MARKT_M:
        return False
    ka, kb = kernworte(a['name']), kernworte(b['name'])
    if not ka or not kb or ka & kb:
        return True
    return abstand < SELBER_PLATZ_M and a['id'].split('-')[0] != b['id'].split('-')[0]


def zusammenfuehren(listen):
    """Frueher genannte Quellen haben Vorrang; spaetere ergaenzen nur, was fehlt."""
    alle = []
    for liste in listen:
        for neu in liste:
            alt = next((m for m in alle if gleich(m, neu)), None)
            if alt is None:
                alle.append(dict(neu))
                continue
            # dieselbe Veranstaltung steht in der Tourismus-Datenbank oft deutsch und englisch: der deutsche Name gewinnt
            if ENGLISCH.search(alt['name']) and neu['name'] and not ENGLISCH.search(neu['name']):
                alt['name'] = neu['name']
            for feld in FELDER_ERGAENZEN:
                alt[feld] = alt.get(feld) or neu.get(feld, '')
            if not alt['termine'] and neu['termine']:
                alt.update({k: neu[k] for k in FELDER_TERMIN if k in neu})
    return alle


def termine_von_seiten(maerkte, frisch):
    """Fuer Maerkte ohne Termin die Veranstalterseite lesen. Jede Adresse nur einmal."""
    offen = [m for m in maerkte if not m['termine'] and m['link']]
    adressen = sorted({m['link'] for m in offen})
    with ThreadPoolExecutor(ABRUFE_GLEICHZEITIG) as pool:
        antworten = dict(zip(adressen, pool.map(lambda u: hole(u, sekunden=15, frisch=frisch), adressen)))
    zaehler = {}
    for m in offen:
        status, text = antworten[m['link']]
        if status != '200':
            m['link_tot'], grund = True, 'Link tot'
        else:
            termine, grund, beleg = aus_seite(text, JAHR)
            # Sammelseiten (viele Maerkte, ein Link) duerfen nicht allen denselben Termin geben
            teilen = sum(1 for x in offen if x['link'] == m['link'])
            if termine and teilen > 1:
                termine, grund = [], 'Link von mehreren Märkten geteilt'
            if termine:
                m.update(termine=termine, quelle='veranstalter', quelle_url=m['link'], beleg=beleg[:160])
            elif not THEMA.search(klartext(text)[:20000]):
                m['link_tot'], grund = True, 'Seite ohne Weihnachtsthema'
        zaehler[grund] = zaehler.get(grund, 0) + 1
    return zaehler


def orte(maerkte, frisch):
    """Ort, PLZ, Landkreis, Bezirk und Bundesland je Markt.

    Ein Ort wandert nicht: was einmal nachgeschlagen ist, steht in orte.json im Repo. Nur neue
    Koordinaten gehen an Nominatim (1 Abruf je Sekunde) – sonst schlaegt der Wochenlauf auf
    dem GitHub-Server jedes Mal alle Orte neu nach und laeuft ins Zeitlimit (16.11.2026: 45 min).
    """
    bekannt = json.loads(ORTE.read_text(encoding='utf-8')) if ORTE.exists() else {}
    neu = 0
    for m in maerkte:
        if m.get('ort') and m.get('land') and (m['land'] != 'Bayern' or m.get('bezirk')):
            continue
        ecke = f"{round(m['lat'], 5)},{round(m['lon'], 5)}"
        if ecke not in bekannt:
            status, text = hole(NOMINATIM.format(lat=round(m['lat'], 5), lon=round(m['lon'], 5)))
            time.sleep(NOMINATIM_PAUSE_S)
            a = json.loads(text).get('address', {}) if status == '200' and text.startswith('{') else {}
            if not a:
                continue                       # kein Ergebnis: beim naechsten Lauf erneut versuchen
            ort = a.get('city') or a.get('town') or a.get('village') or a.get('municipality') or a.get('hamlet') or ''
            bekannt[ecke] = {'ort': ort, 'plz': a.get('postcode', '') if re.fullmatch(r'\d{5}', a.get('postcode', '')) else '',
                             'kreis': a.get('county', '') or (ort if a.get('city') else ''), 'bezirk': a.get('state_district', ''),
                             'land': a.get('state', '') or a.get('city', '')}
            neu += 1
        for feld, wert in bekannt[ecke].items():
            m[feld] = m.get(feld) or wert
    ORTE.write_text(json.dumps(bekannt, ensure_ascii=False, sort_keys=True, indent=0) + '\n', encoding='utf-8')
    print(f'Orte: {len(bekannt)} bekannt, {neu} neu nachgeschlagen')


def fertig(m, heute):
    name = m['name'] or (f"Weihnachtsmarkt in {m['ort']}" if m['ort'] else '')
    art = next((titel for wort, titel in ARTEN if wort in name.lower()), 'Weihnachtsmarkt')
    aus = {
        'id': m['id'], 'name': name, 'name_abgeleitet': not m['name'], 'art': art,
        'ort': m['ort'], 'plz': m['plz'], 'kreis': m['kreis'], 'bezirk': m['bezirk'], 'land': m['land'],
        'platz': m.get('platz', ''), 'lat': round(m['lat'], 5), 'lon': round(m['lon'], 5),
        'status': 'bestaetigt' if m['termine'] else 'offen',
        'termine': [[v.isoformat(), b.isoformat()] for v, b in m['termine']],
        'zeiten': m['zeiten'] if m['termine'] else '',
        'eintritt': m.get('eintritt', ''),
        'link': '' if m.get('link_tot') else m['link'],
        'quelle': m['quelle'], 'quelle_url': m['quelle_url'],
        'lizenz': m.get('lizenz', '') if m['termine'] else '', 'vermerk': m.get('vermerk', '') if m['termine'] else '',
        'geprueft': heute if m['termine'] else '',
    }
    # leere Felder nicht ausliefern: die Datei laedt am Handy
    return {k: v for k, v in aus.items() if v not in ('', [], False)}


def zaehle(maerkte, feld):
    """Je Wert: [bestaetigt, gesamt]."""
    aus = {}
    for m in maerkte:
        paar = aus.setdefault(m.get(feld) or 'unbekannt', [0, 0])
        paar[0] += m['status'] == 'bestaetigt'
        paar[1] += 1
    return dict(sorted(aus.items()))


def main():
    frisch = '--frisch' in sys.argv
    heute = date.today().isoformat()
    listen = []
    for name, lade in quellen.QUELLEN:
        liste = lade(JAHR, frisch)
        print(f'Quelle {name}: {len(liste)} Einträge, {sum(1 for m in liste if m["termine"])} mit Termin {JAHR}')
        listen.append(liste)
    maerkte = zusammenfuehren(listen)
    print(f'Zusammengeführt: {len(maerkte)} Märkte')
    print('Veranstalterseiten:', termine_von_seiten(maerkte, frisch))
    orte(maerkte, frisch)
    raus = sorted((fertig(m, heute) for m in maerkte), key=lambda m: m['id'])
    raus = [m for m in raus if m.get('name') and m.get('ort')]
    # Postleitzahlen aendern sich selten: vorhandene Datei behalten, neu holen nur mit --plz
    alt_plz = ZIEL / 'plz.json'
    plz = quellen.plz() if '--plz' in sys.argv or not alt_plz.exists() else json.loads(alt_plz.read_text(encoding='utf-8'))
    stand = {
        'gebaut': heute, 'jahr': JAHR, 'maerkte': len(raus),
        'bestaetigt': sum(1 for m in raus if m['status'] == 'bestaetigt'),
        'je_quelle': {q: sum(1 for m in raus if m.get('quelle') == q) for q in ('essen', 'dzt', 'osm', 'veranstalter')},
        'je_land': zaehle(raus, 'land'),
        'bayern_je_bezirk': zaehle([m for m in raus if m.get('land') == 'Bayern'], 'bezirk'),
        'plz': len(plz),
        'vermerke': [quellen.VERMERKE[k] for k in ('osm', 'dzt', 'essen')],
    }
    ZIEL.mkdir(parents=True, exist_ok=True)
    schreibe = lambda datei, wert: (ZIEL / datei).write_text(
        json.dumps(wert, ensure_ascii=False, separators=(',', ':'), sort_keys=True) + '\n', encoding='utf-8')
    schreibe('maerkte.json', raus)
    schreibe('plz.json', {k: [round(v[0], 4), round(v[1], 4), v[2]] for k, v in sorted(plz.items())})  # idempotent: gerundet bleibt gerundet
    schreibe('stand.json', stand)
    print(json.dumps(stand, ensure_ascii=False)[:400])


if __name__ == '__main__':
    main()
