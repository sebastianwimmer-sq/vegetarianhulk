#!/usr/bin/env python3
"""Nimmt Saison-Schilder am Wegweiser (links/index.html) nach ihrem letzten Tag von selbst ab.

Sebi 16.11.2026: das Wichteln soll sich „anfang dezember“ selbst archivieren. Ein Schild mit
`data-bis="JJJJ-MM-TT"` am <li> hängt bis einschließlich dieses Tages; danach nimmt der tägliche
Lauf (.github/workflows/saison-schilder.yml) die Zeile heraus und zählt die Reihenfolge (--i) neu.
Zurück geht es per Commit: die Zeile wieder einsetzen, neues Datum.

    python3 scripts/saison-schilder.py                 # abnehmen, was abgelaufen ist
    python3 scripts/saison-schilder.py --heute=2026-12-07
    python3 scripts/saison-schilder.py --selbsttest    # abgelaufen geht, gültig bleibt, Zählung stimmt
"""
import re
import sys
from datetime import date
from pathlib import Path

SEITE = Path(__file__).resolve().parents[1] / 'links' / 'index.html'
ZEILE = re.compile(r'^[ \t]*<li\b[^>]*\bdata-bis="(\d{4}-\d{2}-\d{2})"[^>]*>.*?</li>[ \t]*\n', re.M | re.S)
ZAEHLER = re.compile(r'(<li\b[^>]*style="--i:)\d+(")')


def abnehmen(html, heute):
    """Gibt (neues HTML, Liste der abgenommenen Ziele) zurück. Unveränderlich: html bleibt, wie es ist."""
    weg = []

    def pruefe(m):
        if date.fromisoformat(m.group(1)) >= heute:
            return m.group(0)
        ziel = re.search(r'schild__ziel">([^<]*)<', m.group(0))
        weg.append(f'{ziel.group(1) if ziel else "?"} (bis {m.group(1)})')
        return ''

    neu = ZEILE.sub(pruefe, html)
    if not weg:
        return html, weg
    nummer = iter(range(1, 10_000))
    return ZAEHLER.sub(lambda m: f'{m.group(1)}{next(nummer)}{m.group(2)}', neu), weg


def selbsttest():
    probe = ('<ul>\n'
             '  <li class="start" style="--i:1">\n    <a class="schild" href="/a"><span class="schild__ziel">Start</span></a>\n  </li>\n'
             '  <li style="--i:2" data-bis="2026-12-06"><a class="schild" href="/w"><span class="schild__ziel">Wichteln</span></a></li>\n'
             '  <li style="--i:3" data-bis="2027-01-06"><a class="schild" href="/r"><span class="schild__ziel">Radar</span></a></li>\n'
             '  <li style="--i:4"><a class="schild" href="/k"><span class="schild__ziel">Kooperation</span></a></li>\n'
             '</ul>\n')
    faelle = [
        ('letzter Tag: alles hängt', date(2026, 12, 6), [], ['Wichteln', 'Radar'], 4),
        ('Tag danach: Wichteln ab, Radar bleibt', date(2026, 12, 7), ['Wichteln (bis 2026-12-06)'], ['Radar'], 3),
        ('nach der Saison: beide ab', date(2027, 1, 7), ['Wichteln (bis 2026-12-06)', 'Radar (bis 2027-01-06)'], [], 2),
    ]
    rot = 0
    for name, heute, soll_weg, soll_da, soll_zahl in faelle:
        neu, weg = abnehmen(probe, heute)
        zaehler = [int(z) for z in re.findall(r'--i:(\d+)', neu)]
        gut = (weg == soll_weg and all(f'>{s}<' in neu for s in soll_da) and zaehler == list(range(1, soll_zahl + 1))
               and '>Start<' in neu and '>Kooperation<' in neu)
        print(('GRÜN ' if gut else 'ROT  ') + name + ('' if gut else f' → ab {weg}, Zählung {zaehler}'))
        rot += not gut
    return 1 if rot else 0


def main():
    if '--selbsttest' in sys.argv:
        return selbsttest()
    heute = next((date.fromisoformat(a.split('=', 1)[1]) for a in sys.argv[1:] if a.startswith('--heute=')), date.today())
    html = SEITE.read_text(encoding='utf-8')
    neu, weg = abnehmen(html, heute)
    if not weg:
        print(f'Saison-Schilder: nichts abgelaufen am {heute}')
        return 0
    SEITE.write_text(neu, encoding='utf-8')
    print('Saison-Schilder abgenommen: ' + ', '.join(weg))
    return 0


if __name__ == '__main__':
    sys.exit(main())
