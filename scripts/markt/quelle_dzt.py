"""Quelle: Knowledge Graph der Deutschen Zentrale fuer Tourismus (open-data-germany.org).

Schluessel: Umgebungsvariable DZT_KEY, sonst macOS-Schluesselbund 'dzt-knowledge-graph-key'.
Er steht nie im Repo und nie in einer Ausgabe (AGB § 4: Weitergabe untersagt).

Uebernommen wird nur, was eine offene Lizenz traegt (CC0, Public Domain Mark, CC BY, CC BY-SA);
der Lizenzvermerk des Anbieters wandert in jeden Eintrag (AGB § 3).
"""
import hashlib
import json
import os
import re
import shutil
import subprocess
from datetime import date, timedelta

from netz import KENNUNG, _pfad

ENDPUNKT = 'https://proxy.opendatagermany.io/api/ts/v1/kg/sparql'
SUCHSEITE = 'https://open-data-germany.org/datenbestand-such-widget/'
NAMEN = ('weihnachtsm[aä]rkt|christkindl|christkindlesm|adventsm[aä]rkt|adventm[aä]rkt|nikolausm[aä]rkt|'
         'weihnachtsdorf|waldweihnacht|schlossweihnacht|burgweihnacht|bergweihnacht|wintermarkt|lichtermarkt|'
         'striezelmarkt|sternenmarkt|engerlmarkt|altstadtweihnacht|dorfweihnacht|hofweihnacht')
KEIN_MARKT = re.compile(r'f(?:ü|ue)hrung|rundgang|konzert|fahrt|reise|\bbus|workshop|\btour\b|stammtisch|'
                        r'anmeld|bewerb|sitzung|er(?:ö|oe)ffnung|aufbau|lesung|gottesdienst|theater|kino|wander|\bzum \w*(?:markt|weihnacht)|\bnach [A-ZÄÖÜ]', re.I)
LIZENZEN = [('creativecommons.org/publicdomain/zero', 'CC0 1.0'), ('creativecommons.org/publicdomain/mark', 'Public Domain Mark 1.0'),
            ('creativecommons.org/licenses/by-sa/', 'CC BY-SA 4.0'), ('creativecommons.org/licenses/by/', 'CC BY 4.0')]
GLEICHER_PLATZ_GRAD = 0.003       # rund 300 m
LUECKE_TAGE = 2                   # ein Ruhetag trennt keinen Zeitraum
MAX_TEILE = 6
KOPF = 'PREFIX schema: <https://schema.org/>\n'
FILTER = ('?e a schema:Event ; schema:name ?name ; schema:startDate ?start .\n'
          'FILTER(STR(?start) >= "{auf}" && STR(?start) < "{zu}")\n'
          'FILTER(REGEX(STR(?name), "' + NAMEN + '", "i"))\n')
ABFRAGE_KERN = KOPF + '''SELECT ?e ?name ?start ?end ?lat ?lon ?plz ?ort ?platz ?url ?sl ?lic ?notiz ?pub WHERE {
%s
  OPTIONAL { ?e schema:endDate ?end }
  OPTIONAL { ?e schema:mainEntityOfPage/schema:url ?url }
  OPTIONAL { ?e schema:sdLicense ?sl . OPTIONAL { ?sl schema:license ?lic } OPTIONAL { ?sl schema:copyrightNotice ?notiz } }
  OPTIONAL { ?e schema:sdPublisher/schema:name ?pub }
  OPTIONAL { ?e schema:location ?l .
    OPTIONAL { ?l schema:name ?platz }
    OPTIONAL { ?l schema:geo ?g . ?g schema:latitude ?lat ; schema:longitude ?lon }
    OPTIONAL { ?l schema:address ?a . OPTIONAL{?a schema:postalCode ?plz} OPTIONAL{?a schema:addressLocality ?ort} } }
} LIMIT 40000'''
ABFRAGE_LAGE = KOPF + '''SELECT ?e ?url ?same ?land ?bezirk ?kreis WHERE {
%s
  OPTIONAL { ?e schema:url ?url }
  OPTIONAL { ?e schema:sameAs ?same }
  OPTIONAL { ?e schema:location/schema:containedInPlace ?b . FILTER(CONTAINS(STR(?b),"/bundeslaender/")) ?b schema:name ?land }
  OPTIONAL { ?e schema:location/schema:containedInPlace ?r . FILTER(CONTAINS(STR(?r),"/regierungsbezirke/")) ?r schema:name ?bezirk }
  OPTIONAL { ?e schema:location/schema:containedInPlace ?k . FILTER(CONTAINS(STR(?k),"/landkreise/")) ?k schema:name ?kreis }
} LIMIT 40000'''


def schluessel():
    wert = os.environ.get('DZT_KEY', '').strip()
    if not wert and shutil.which('security'):
        lauf = subprocess.run(['security', 'find-generic-password', '-s', 'dzt-knowledge-graph-key', '-w'],
                              capture_output=True, text=True)
        wert = lauf.stdout.strip()
    return wert


def frage(abfrage, frisch=False):
    """SPARQL-Abruf; der Schluessel geht ueber die Standardeingabe an curl, nie ueber die Befehlszeile."""
    pfad = _pfad('dzt' + abfrage, '.json')
    if pfad.exists() and not frisch:
        return json.loads(pfad.read_text(encoding='utf-8'))
    wert = schluessel()
    if not wert:
        raise SystemExit('DZT: kein Schlüssel (DZT_KEY oder Schlüsselbund) – nicht gemessen.')
    kopf = f'header = "x-api-key: {wert}"\nheader = "accept: application/sparql-results+json"\nheader = "content-type: text/plain"\n'
    lauf = subprocess.run(['curl', '-s', '-m', '280', '-A', KENNUNG, '--config', '-', '--data-binary', abfrage, ENDPUNKT],
                          input=kopf.encode(), capture_output=True, timeout=300)
    try:
        zeilen = json.loads(lauf.stdout)['results']['bindings']
    except (ValueError, KeyError):
        raise SystemExit(f'DZT: Antwort nicht lesbar ({lauf.stdout[:120]!r}) – nicht gemessen.')
    flach = [{k: v['value'] for k, v in z.items()} for z in zeilen]
    pfad.write_text(json.dumps(flach), encoding='utf-8')
    return flach


def lizenz(z):
    """(Kurzname, Adresse) der offenen Lizenz eines Eintrags, sonst None."""
    for wert in (z.get('lic', ''), z.get('sl', '')):
        for teil, kurz in LIZENZEN:
            if teil in wert:
                return kurz, wert
    return None


def _tag(wert):
    try:
        return date.fromisoformat(wert[:10])
    except ValueError:
        return None


def verbinde(bereiche):
    """Tagesweise gelieferte Termine zu Zeitraeumen fuegen; zu viele Teile → ein Gesamtzeitraum."""
    aus = []
    for von, bis in sorted(set(bereiche)):
        if aus and von <= aus[-1][1] + timedelta(days=LUECKE_TAGE):
            aus[-1] = (aus[-1][0], max(aus[-1][1], bis))
        else:
            aus.append((von, bis))
    return aus if len(aus) <= MAX_TEILE else [(aus[0][0], aus[-1][1])]


def _norm(name):
    return re.sub(r'[^a-zäöüß]+', ' ', re.sub(r'\b20\d\d\b', '', name.lower())).strip()


def maerkte(jahr, gueltig, frisch=False):
    """Liefert (Maerkte, Bilanz). gueltig(von, bis) entscheidet, ob ein Termin in die Saison passt."""
    teil = FILTER.format(auf=f'{jahr}-11-05', zu=f'{jahr + 1}-01-11')
    kern, lage = {}, {}
    for z in frage(ABFRAGE_KERN % teil, frisch):
        kern.setdefault(z['e'], {}).update({k: v for k, v in z.items() if k not in kern.get(z['e'], {})})
    for z in frage(ABFRAGE_LAGE % teil, frisch):
        lage.setdefault(z['e'], {}).update({k: v for k, v in z.items() if k not in lage.get(z['e'], {})})
    bilanz = {'einträge': len(kern), 'ohne Lizenz': 0, 'kein Markt': 0, 'ohne Lage': 0, 'Termin ungültig': 0}
    gruppen = {}
    for kennung, z in kern.items():
        z = {**lage.get(kennung, {}), **z}
        frei = lizenz(z)
        von, bis = _tag(z.get('start', '')), _tag(z.get('end', '') or z.get('start', ''))
        if not frei:
            bilanz['ohne Lizenz'] += 1
        elif KEIN_MARKT.search(z['name']):
            bilanz['kein Markt'] += 1
        elif 'lat' not in z or not (47.2 <= float(z['lat']) <= 55.1 and 5.8 <= float(z['lon']) <= 15.1):
            bilanz['ohne Lage'] += 1
        elif not von or not bis or not gueltig(von, bis):
            bilanz['Termin ungültig'] += 1
        else:
            lat, lon = float(z['lat']), float(z['lon'])
            g = next((x for x in gruppen.get(_norm(z['name']), [])
                      if abs(x['lat'] - lat) < GLEICHER_PLATZ_GRAD and abs(x['lon'] - lon) < GLEICHER_PLATZ_GRAD * 1.5), None)
            if g is None:
                vermerk = z.get('notiz', '')
                if 'CC' not in vermerk and 'Public' not in vermerk:
                    vermerk = f"{vermerk or z.get('pub') or 'Deutsche Zentrale für Tourismus'}, {frei[0]}"
                g = {'id': 'dzt-' + hashlib.sha1(kennung.encode()).hexdigest()[:12],
                     'name': re.sub(r'\s+', ' ', z['name']).strip(), 'lat': lat, 'lon': lon, 'bereiche': [],
                     'zeiten': '', 'link': z.get('url') or z.get('same') or '', 'quelle': 'dzt',
                     'quelle_url': z.get('url') or SUCHSEITE, 'beleg': '', 'platz': z.get('platz', ''), 'eintritt': '',
                     'ort': z.get('ort', ''), 'plz': z.get('plz', '') if re.fullmatch(r'\d{5}', z.get('plz', '')) else '',
                     'kreis': z.get('kreis', ''), 'bezirk': z.get('bezirk', ''), 'land': z.get('land', ''),
                     'lizenz': frei[1], 'vermerk': vermerk}
                gruppen.setdefault(_norm(z['name']), []).append(g)
            g['bereiche'].append((von, bis))
    aus = []
    for liste in gruppen.values():
        for g in liste:
            g['termine'] = verbinde(g.pop('bereiche'))
            if all(gueltig(v, b) for v, b in g['termine']):
                g['beleg'] = ', '.join(f'{v.isoformat()} bis {b.isoformat()}' for v, b in g['termine'])[:160]
                aus.append(g)
            else:
                bilanz['Termin ungültig'] += 1
    bilanz['märkte'] = len(aus)
    return aus, bilanz
