"""Quellen des Weihnachtsmarkt-Radars. Jede liefert Rohmaerkte im selben Format.

Neue Quelle = neue Funktion + Eintrag in QUELLEN + Vermerk in VERMERKE.
"""
import json
import re
from datetime import datetime, timezone

import kuratiert
import quelle_dzt
from datum import _gueltig, aus_feld
from netz import hole, overpass

VERMERKE = {
    'osm': {'name': 'OpenStreetMap', 'vermerk': '© OpenStreetMap-Mitwirkende', 'lizenz': 'ODbL 1.0',
            'url': 'https://www.openstreetmap.org/copyright'},
    'essen': {'name': 'Stadt Essen, Open Data', 'vermerk': 'Stadt Essen, Datenlizenz Deutschland – Namensnennung – Version 2.0',
              'lizenz': 'dl-de/by-2-0', 'url': 'https://opendata.essen.de/'},
    'dzt': {'name': 'Knowledge Graph der Deutschen Zentrale für Tourismus',
            'vermerk': 'Offene Daten der Landestourismus-Organisationen über die Deutsche Zentrale für Tourismus; Lizenz und Urheber stehen je Eintrag',
            'lizenz': 'CC0, CC BY oder CC BY-SA je Eintrag', 'url': 'https://open-data-germany.org/'},
}
ABFRAGE_MAERKTE = ('[out:json][timeout:200];area["ISO3166-1"="DE"][admin_level=2]->.de;'
                   'nwr["xmas:feature"="market"](area.de);out tags center;')
ABFRAGE_PLZ = ('[out:json][timeout:240];area["ISO3166-1"="DE"][admin_level=2]->.de;'
               'relation["boundary"="postal_code"]["postal_code"](area.de);out tags center;')
ESSEN_URL = 'https://opendata.essen.de/sites/default/files/Weihnachtsmaerkte_2026_opendata.geojson'
ESSEN_SEITE = 'https://opendata.essen.de/dataset/winter-und-weihnachtsm%C3%A4rkte-essen-2026'
MARKTWORT = re.compile(r'markt|weihnacht|advent|christkind|nikolaus|winter|zauber|budenzauber', re.I)


def _roh(kennung, name, lat, lon, **mehr):
    return {'id': kennung, 'name': (name or '').strip(), 'lat': lat, 'lon': lon, 'termine': [],
            'zeiten': '', 'link': '', 'quelle': '', 'quelle_url': '', 'beleg': '', **mehr}


def osm(jahr, frisch=False):
    maerkte = []
    for e in overpass(ABFRAGE_MAERKTE, frisch)['elements']:
        t = e.get('tags', {})
        ort = e.get('center') or e
        if 'lat' not in ort:
            continue
        name = t.get('xmas:name') or (t.get('name') if MARKTWORT.search(t.get('name', '')) else '')
        feld = t.get('xmas:day_date', '')
        termine, _ = aus_feld(feld, jahr)
        link = t.get('xmas:url') or t.get('website') or ''
        m = _roh(f"osm-{e['type'][0]}{e['id']}", name, ort['lat'], ort['lon'],
                 link=link if link.startswith('http') else '',
                 platz=t.get('xmas:location', ''), eintritt=t.get('xmas:fee', ''))
        if termine:
            # Oeffnungszeiten nur uebernehmen, wenn derselbe Eintrag auch den Termin dieses Jahres traegt
            m.update(termine=termine, zeiten=t.get('xmas:opening_hours', ''), quelle='osm',
                     quelle_url=f"https://www.openstreetmap.org/{e['type']}/{e['id']}", beleg=feld)
        maerkte.append(m)
    return maerkte


def essen(jahr, frisch=False):
    status, text = hole(ESSEN_URL, frisch=frisch)
    if status != '200':
        raise SystemExit(f'Essen: Abruf {status} – nicht gemessen.')
    maerkte = []
    for f in json.loads(text)['features']:
        p = f['properties']
        von, bis = (datetime.fromtimestamp(p[k] / 1000, timezone.utc).date() for k in ('ZEITRAUM_S', 'ZEITRAUM_E'))
        termine, _ = aus_feld(f'{von.isoformat()}/{bis.isoformat()}', jahr)
        lon, lat = f['geometry']['coordinates'][:2]
        maerkte.append(_roh(f"essen-{p['OBJECTID']}", p['NAME'], lat, lon, termine=termine,
                            zeiten=(p.get('ÖFFNUNGSZ') or '').strip(), link=(p.get('WEBSITE') or '').strip(),
                            quelle='essen' if termine else '', quelle_url=ESSEN_SEITE,
                            beleg=f'{von.isoformat()} bis {bis.isoformat()}', platz=p.get('STANDORT', ''),
                            eintritt='' if p.get('EINTRITT_F') == 'Ja' else 'yes'))
    return maerkte


def plz(frisch=False):
    """PLZ → (lat, lon, Ortsvermerk) aus den PLZ-Gebieten in OpenStreetMap."""
    aus = {}
    for e in overpass(ABFRAGE_PLZ, frisch)['elements']:
        nr = e['tags'].get('postal_code', '')
        if re.fullmatch(r'\d{5}', nr) and 'center' in e:
            ort = re.sub(r'^\d{5}\s*', '', e['tags'].get('note', '')).strip()
            aus[nr] = (e['center']['lat'], e['center']['lon'], ort)
    return aus


def dzt(jahr, frisch=False):
    liste, bilanz = quelle_dzt.maerkte(jahr, lambda von, bis: _gueltig(von, bis, jahr), frisch)
    print('  DZT-Bilanz:', bilanz)
    return liste


def hand(jahr, frisch=False):
    """Von Hand gepflegte Maerkte (kuratiert.json): nur Name, Ort und Seite des Veranstalters, nie ein Termin."""
    return [_roh(m['id'], m['name'], m['lat'], m['lon'], link=m['link'], platz=m.get('platz', ''), ort=m['ort'])
            for m in kuratiert.lade()]


# Reihenfolge = Vorrang beim Zusammenfuehren: Stadtdaten, dann Tourismus-Datenbank, dann die von Hand
# gepflegten Veranstalterseiten (ihr Link schlaegt den aus OpenStreetMap), dann OpenStreetMap.
QUELLEN = [('essen', essen), ('dzt', dzt), ('hand', hand), ('osm', osm)]
