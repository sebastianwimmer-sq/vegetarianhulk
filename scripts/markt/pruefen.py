#!/usr/bin/env python3
"""Tor fuer die Daten des Weihnachtsmarkt-Radars. Exit 1 bei jedem Befund.

    python3 scripts/markt/pruefen.py [ordner]     # Standard: weihnachtsmarkt/daten

Geprueft wird der Inhalt, nicht die Form allein: ein bestaetigter Markt ohne
Quelle, ein Termin ausserhalb der Saison oder ein leerer Lauf halten an.
"""
import json
import sys
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from datum import saison  # noqa: E402

DE = {'lat': (47.2, 55.1), 'lon': (5.8, 15.1)}
MIN_MAERKTE = 300
MIN_BESTAETIGT = 100
MIN_PLZ = 8000
PFLICHT_VERMERK = '© OpenStreetMap-Mitwirkende'
QUELLEN = {'osm', 'essen', 'veranstalter', 'dzt'}
OFFENE_LIZENZ = ('creativecommons.org/publicdomain/', 'creativecommons.org/licenses/by/', 'creativecommons.org/licenses/by-sa/')
PFLICHT = ('id', 'name', 'ort', 'lat', 'lon', 'status', 'termine')


def befunde_markt(m, jahr):
    aus = []
    m = {'termine': [], **m}
    fehlt = [f for f in PFLICHT if m.get(f) in (None, '')]
    if fehlt:
        return [f"{m.get('id', '?')}: Pflichtfeld leer: {', '.join(fehlt)}"]
    if not (DE['lat'][0] <= m['lat'] <= DE['lat'][1] and DE['lon'][0] <= m['lon'] <= DE['lon'][1]):
        aus.append(f"{m['id']}: Koordinate außerhalb Deutschlands ({m['lat']}, {m['lon']})")
    auf, zu = saison(jahr)
    for paar in m['termine']:
        try:
            von, bis = (date.fromisoformat(x) for x in paar)
        except (ValueError, TypeError):
            aus.append(f"{m['id']}: Termin nicht lesbar: {paar}")
            continue
        if not (auf <= von <= bis <= zu):
            aus.append(f"{m['id']}: Termin außerhalb der Saison {jahr}: {paar}")
    if m['status'] == 'bestaetigt':
        if not m['termine']:
            aus.append(f"{m['id']}: bestätigt, aber ohne Termin")
        if m.get('quelle') not in QUELLEN or not str(m.get('quelle_url', '')).startswith('http'):
            aus.append(f"{m['id']}: bestätigt, aber ohne belegte Quelle")
        if m.get('quelle') == 'dzt' and not (any(x in m.get('lizenz', '') for x in OFFENE_LIZENZ) and m.get('vermerk')):
            aus.append(f"{m['id']}: aus der Tourismus-Datenbank, aber ohne offene Lizenz oder Vermerk")
        if not m.get('geprueft'):
            aus.append(f"{m['id']}: bestätigt, aber ohne Prüfdatum")
    elif m['status'] == 'offen':
        if m['termine'] or m.get('zeiten'):
            aus.append(f"{m['id']}: offen, zeigt aber Termin oder Öffnungszeiten")
    else:
        aus.append(f"{m['id']}: unbekannter Status {m['status']!r}")
    if m.get('link') and not m['link'].startswith('http'):
        aus.append(f"{m['id']}: Link ist keine Adresse")
    return aus


def befunde(ordner):
    aus = []
    try:
        maerkte, plz, stand = (json.loads((ordner / f).read_text(encoding='utf-8'))
                               for f in ('maerkte.json', 'plz.json', 'stand.json'))
    except (OSError, ValueError) as fehler:
        return [f'nicht gemessen: Datei fehlt oder ist kein JSON ({fehler})']
    jahr = stand.get('jahr', 0)
    for m in maerkte:
        aus += befunde_markt(m, jahr)
    kennungen = [m.get('id') for m in maerkte]
    doppelt = {k for k in kennungen if kennungen.count(k) > 1}
    if doppelt:
        aus.append(f'doppelte Kennungen: {sorted(doppelt)[:5]}')
    bestaetigt = sum(1 for m in maerkte if m.get('status') == 'bestaetigt')
    if len(maerkte) < MIN_MAERKTE:
        aus.append(f'nicht gemessen: nur {len(maerkte)} Märkte (Schwelle {MIN_MAERKTE}) – Quelle ausgefallen?')
    if bestaetigt < MIN_BESTAETIGT:
        aus.append(f'nicht gemessen: nur {bestaetigt} bestätigte Märkte (Schwelle {MIN_BESTAETIGT})')
    if len(plz) < MIN_PLZ:
        aus.append(f'nicht gemessen: nur {len(plz)} Postleitzahlen (Schwelle {MIN_PLZ})')
    if (stand.get('maerkte'), stand.get('bestaetigt')) != (len(maerkte), bestaetigt):
        aus.append(f"stand.json zählt anders als die Daten: {stand.get('maerkte')}/{stand.get('bestaetigt')} gegen {len(maerkte)}/{bestaetigt}")
    if PFLICHT_VERMERK not in json.dumps(stand, ensure_ascii=False):
        aus.append(f'Pflicht-Vermerk fehlt in stand.json: {PFLICHT_VERMERK}')
    return aus


def main():
    ordner = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[2] / 'weihnachtsmarkt' / 'daten'
    liste = befunde(ordner)
    for zeile in liste[:40]:
        print('ROT ', zeile)
    if liste:
        print(f'{len(liste)} Befunde in {ordner}')
        sys.exit(1)
    stand = json.loads((ordner / 'stand.json').read_text(encoding='utf-8'))
    print(f"GRÜN {stand['maerkte']} Märkte, {stand['bestaetigt']} bestätigt, {stand['plz']} Postleitzahlen, Stand {stand['gebaut']}")


if __name__ == '__main__':
    main()
