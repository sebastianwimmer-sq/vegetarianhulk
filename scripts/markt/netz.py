"""Abrufe fuer den Weihnachtsmarkt-Radar: hoeflich, mit Zwischenablage, ohne persoenliche Angaben."""
import hashlib
import json
import subprocess
import time
from pathlib import Path

ABLAGE = Path(__file__).parent / '.ablage'
KENNUNG = 'weihnachtsmarkt-radar/0.1 (Terminabgleich, 1 Abruf je Seite)'
MAX_BYTES = 3_000_000
OVERPASS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
]


def _pfad(schluessel, endung):
    ABLAGE.mkdir(exist_ok=True)
    return ABLAGE / (hashlib.sha256(schluessel.encode()).hexdigest()[:24] + endung)


def hole(url, sekunden=20, daten=None, frisch=False):
    """Liefert (status, text). Status '000' heisst: kein Abruf moeglich."""
    pfad = _pfad(url + (daten or ''), '.json')
    if pfad.exists() and not frisch:
        alt = json.loads(pfad.read_text(encoding='utf-8'))
        return alt['status'], alt['text']
    befehl = ['curl', '-sL', '-m', str(sekunden), '--max-filesize', str(MAX_BYTES),
              '-A', KENNUNG, '-w', '\n%{http_code}']
    if daten is not None:
        befehl += ['--data-urlencode', daten]
    try:
        lauf = subprocess.run(befehl + ['--', url], capture_output=True, timeout=sekunden + 10)
        roh, _, status = lauf.stdout.rpartition(b'\n')
        status = status.decode('ascii', 'ignore') or '000'
    except subprocess.TimeoutExpired:
        roh, status = b'', '000'
    text = roh.decode('utf-8', 'replace')
    if text.count('�') > 20:
        text = roh.decode('latin-1', 'replace')
    pfad.write_text(json.dumps({'status': status, 'text': text}), encoding='utf-8')
    return status, text


def overpass(abfrage, frisch=False):
    """Fragt die oeffentlichen Overpass-Server der Reihe nach, mit wachsender Pause."""
    pfad = _pfad('overpass' + abfrage, '.json')
    if pfad.exists() and not frisch:
        return json.loads(pfad.read_text(encoding='utf-8'))
    for versuch in range(6):
        for server in OVERPASS:
            status, text = hole(server, sekunden=240, daten='data=' + abfrage, frisch=True)
            if status == '200' and text.lstrip().startswith('{'):
                antwort = json.loads(text)
                if antwort.get('elements'):
                    pfad.write_text(text, encoding='utf-8')
                    return antwort
        time.sleep(20 * (versuch + 1))
    raise SystemExit('Overpass: kein Server hat geantwortet – nicht gemessen, Lauf abgebrochen.')
