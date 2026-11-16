#!/usr/bin/env python3
"""Von Hand gepflegte Märkte: Name, Ort und die Seite des Veranstalters – der Termin NICHT.

Sebi 16.11.2026: Oberbayern und Niederbayern sind im Radar dünn („viele aus meiner Zielgruppe“);
17.11.2026: dazu grenznahe Märkte in Oberösterreich und Salzburg (Kandidat mit "land").
Offene Daten gibt es dort kaum, die Märkte haben aber eigene Seiten. Hier steht deshalb nur, WO
der Termin zu lesen ist; gelesen wird er bei jedem Lauf frisch von der Seite (bauen.py ›
termine_von_seiten), mit Beleg und Prüfdatum. Steht dort kein Termin 2026, bleibt der Markt „offen“.

    python3 scripts/markt/kuratiert.py --neu <kandidaten.json>   # Kandidaten aufnehmen, Ort einmal nachschlagen
    python3 scripts/markt/kuratiert.py --pruefen                 # Datei gegen die Regeln prüfen, Exit 1 bei Befund

Kandidaten: {"maerkte": [{"name", "ort", "platz", "link"}]}. Koordinaten kommen von einem Markt
gleichen Namens im Bestand (dann fällt er beim Zusammenführen mit ihm zusammen), sonst von Nominatim.
"""
import json
import re
import sys
import time
import unicodedata
import urllib.parse
from pathlib import Path

HIER = Path(__file__).parent
DATEI = HIER / 'kuratiert.json'
BESTAND = HIER.parents[1] / 'weihnachtsmarkt' / 'daten' / 'maerkte.json'
SUCHE = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=de,at&accept-language=de&q='
PAUSE_S = 1.1
DE = {'lat': (47.2, 55.1), 'lon': (5.8, 15.1)}
PFLICHT = ('id', 'name', 'ort', 'link', 'lat', 'lon')
SAMMELPORTALE = ('festivalsindeutschland.', 'tradefairdates.', 'weihnachtsmarkt-deutschland.', 'freizeitmonster.',
                 'tourispo.', 'bahn.de', 'adac.de', 'wikipedia.org', 'tripadvisor.', 'facebook.com', 'instagram.com')


def kennung(name, ort):
    roh = unicodedata.normalize('NFKD', f'{ort} {name}'.lower().replace('ß', 'ss')).encode('ascii', 'ignore').decode()
    return 'hand-' + re.sub(r'[^a-z0-9]+', '-', roh).strip('-')[:60]


def befunde(liste):
    """Regeln der Datei; leere Liste heißt sauber."""
    aus, gesehen, links = [], set(), set()
    for m in liste:
        wer = m.get('id') or m.get('name') or '?'
        fehlt = [f for f in PFLICHT if m.get(f) in (None, '')]
        if fehlt:
            aus.append(f'{wer}: Feld fehlt: {", ".join(fehlt)}')
            continue
        if not re.fullmatch(r'hand-[a-z0-9-]{3,60}', m['id']):
            aus.append(f'{wer}: Kennung passt nicht zum Muster hand-…')
        if m['id'] in gesehen:
            aus.append(f'{wer}: Kennung doppelt')
        gesehen.add(m['id'])
        if not re.match(r'https://[^\s/]+\.[a-z]{2,}(/\S*)?$', m['link']):
            aus.append(f'{wer}: Adresse ist keine https-Adresse')
        if any(p in m['link'].lower() for p in SAMMELPORTALE):
            aus.append(f'{wer}: Adresse ist ein Sammelportal, keine Seite des Veranstalters')
        if m['link'] in links:
            aus.append(f'{wer}: Adresse steht doppelt (eine Seite, ein Markt)')
        links.add(m['link'])
        if not (isinstance(m['lat'], float) and isinstance(m['lon'], float)
                and DE['lat'][0] <= m['lat'] <= DE['lat'][1] and DE['lon'][0] <= m['lon'] <= DE['lon'][1]):
            aus.append(f'{wer}: Koordinate liegt nicht in Deutschland')
        if any(k in m for k in ('termine', 'termin', 'datum')):
            aus.append(f'{wer}: Termine gehören nicht in diese Datei, sie werden von der Seite gelesen')
    return aus


def lade():
    return json.loads(DATEI.read_text(encoding='utf-8')) if DATEI.exists() else []


def _kern(name):
    return {w for w in re.findall(r'[a-zäöüß]{4,}', name.lower())
            if w not in ('weihnachtsmarkt', 'christkindlmarkt', 'adventsmarkt', 'markt')}


def _ort_im_bestand(kandidat, bestand):
    """Koordinate eines Marktes im Bestand, der im selben Ort liegt und im Namen verwandt ist."""
    gleicher_ort = [m for m in bestand if m.get('ort', '').lower() == kandidat['ort'].lower()]
    for m in gleicher_ort:
        if _kern(m['name']) & _kern(kandidat['name']) or (len(gleicher_ort) == 1 and not _kern(kandidat['name']) - {kandidat['ort'].lower()}):
            return float(m['lat']), float(m['lon'])
    return None


def _ort_nachschlagen(kandidat, hole):
    for frage in ([f"{kandidat['platz']}, {kandidat['ort']}, {kandidat.get('land') or 'Bayern'}"] if kandidat.get('platz') else []) + [f"{kandidat['ort']}, {kandidat.get('land') or 'Bayern'}"]:
        status, text = hole(SUCHE + urllib.parse.quote(frage))
        time.sleep(PAUSE_S)
        treffer = json.loads(text) if status == '200' and text.startswith('[') else []
        if treffer:
            return round(float(treffer[0]['lat']), 5), round(float(treffer[0]['lon']), 5)
    return None


def aufnehmen(kandidaten, alt, bestand, hole):
    """Neue Liste aus alt + Kandidaten (alt bleibt unverändert). Gibt (liste, meldungen) zurück."""
    liste, meldungen = [dict(m) for m in alt], []
    da_ids, da_links = {m['id'] for m in liste}, {m['link'] for m in liste}
    for k in kandidaten:
        if not (k.get('name') and k.get('ort') and k.get('link')):
            meldungen.append(f"übersprungen (Name, Ort oder Adresse fehlt): {k.get('name') or k.get('ort')}")
            continue
        eintrag = {'id': kennung(k['name'], k['ort']), 'name': k['name'].strip(), 'ort': k['ort'].strip(),
                   'platz': (k.get('platz') or '').strip(), 'link': k['link'].strip()}
        suche = {**eintrag, 'land': k.get('land', '')}
        if eintrag['id'] in da_ids or eintrag['link'] in da_links:
            meldungen.append(f"schon da: {eintrag['name']}")
            continue
        ort = _ort_im_bestand(eintrag, bestand) or _ort_nachschlagen(suche, hole)
        if not ort:
            meldungen.append(f"übersprungen (Ort nicht gefunden): {eintrag['name']}, {eintrag['ort']}")
            continue
        eintrag['lat'], eintrag['lon'] = ort
        if befunde([eintrag]):
            meldungen.append('übersprungen: ' + '; '.join(befunde([eintrag])))
            continue
        liste.append(eintrag)
        da_ids.add(eintrag['id']); da_links.add(eintrag['link'])
    return sorted(liste, key=lambda m: m['id']), meldungen


def main():
    if '--pruefen' in sys.argv:
        rot = befunde(lade())
        for b in rot:
            print('ROT ', b)
        print(f'{len(lade())} Märkte von Hand, {len(rot)} Befunde')
        return 1 if rot else 0
    if '--neu' in sys.argv:
        sys.path.insert(0, str(HIER))
        from netz import hole
        quelle = json.loads(Path(sys.argv[sys.argv.index('--neu') + 1]).read_text(encoding='utf-8'))
        bestand = json.loads(BESTAND.read_text(encoding='utf-8')) if BESTAND.exists() else []
        liste, meldungen = aufnehmen(quelle.get('maerkte', []), lade(), bestand, hole)
        DATEI.write_text(json.dumps(liste, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        for m in meldungen:
            print(' ', m)
        print(f'{len(liste)} Märkte in {DATEI.name}')
        return 1 if befunde(liste) else 0
    print(__doc__)
    return 1


if __name__ == '__main__':
    sys.exit(main())
