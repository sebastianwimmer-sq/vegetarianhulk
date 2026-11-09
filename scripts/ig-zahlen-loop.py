#!/usr/bin/env python3
"""ig-zahlen-loop.py — haelt die Instagram-Zahlen der Brands-Seiten aktuell (09.11.2026).

    python3 scripts/ig-zahlen-loop.py              # launchd com.vh.ig-zahlen, taeglich 10:30
    python3 scripts/ig-zahlen-loop.py --trocken    # holt und zeigt, liefert nicht aus
    python3 scripts/ig-zahlen-loop.py --selbsttest

WARUM: Sebi 09.11.: "stats fuer die brands seite aktuell halten oder im loop?" — die Seite
zeigte vier Monate alte Zahlen als "letzte 30 Tage". Jetzt: laeuft taeglich, handelt nur,
wenn der Stand aelter als FAELLIG_TAGE ist (also etwa monatlich, und ein verpasster Tag
holt sich am naechsten nach).

WIE: Arbeitet in einem EIGENEN Worktree (~/vh-wache, nur fuer diesen Job, nie in einer
fremden Sitzung). Je Lauf: auf origin/main setzen → scripts/ig-zahlen.mjs → EN-Stempel →
Asset-Versionen → volle Pruefkette (premium-check.sh) → nur bei Gruen commit + push →
live am Inhalt pruefen. Rot liefert nie aus.

MELDEN: Exit 1 nur, wenn der Stand schon ueber ALARM_TAGE alt ist (dann meldet die
Zugangs-Wache den Job per Mail). Ein einzelner roter Lauf vorher wird geloggt und am
naechsten Tag wiederholt — wackelige Tore sollen nicht sofort Alarm schlagen.
"""
import datetime
import hashlib
import os
import re
import subprocess
import sys
import time
import urllib.request

REPO = os.path.expanduser('~/vegetarianhulk')
BAUM = os.path.expanduser('~/vh-wache')
SEITEN = ['kooperationen.html', 'anfrage.html', 'en/brands/index.html', 'en/brand-inquiry/index.html']
EN_STEMPEL = ['/en/brands/', '/en/brand-inquiry/']
FAELLIG_TAGE = 28
ALARM_TAGE = 35
LIVE = 'https://vegetarianhulk.de/'


def log(*t):
    print(datetime.datetime.now().strftime('%Y-%m-%d %H:%M'), *t, flush=True)


def lauf(*cmd, cwd=BAUM, pruefen=True):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if pruefen and r.returncode != 0:
        raise RuntimeError(f"{' '.join(cmd)} -> Exit {r.returncode}: {(r.stderr or r.stdout).strip()[-600:]}")
    return r


def stand_aus(html):
    m = re.search(r'data-ig-bis="(\d{4}-\d{2}-\d{2})"', html)
    return datetime.date.fromisoformat(m.group(1)) if m else None


def alter_tage(stand, heute):
    return 10**4 if stand is None else (heute - stand).days


def grafik_da():
    """Browser-Tore brauchen Grafik; im DarkWake laeuft der Mac ohne (31.10.)."""
    r = subprocess.run(['pmset', '-g', 'systemstate'], capture_output=True, text=True)
    return 'Graphics' in r.stdout


def baum_bereit():
    if not os.path.isdir(BAUM):
        lauf('git', 'worktree', 'add', '--detach', BAUM, 'origin/main', cwd=REPO)
    lauf('git', 'fetch', '-q', 'origin')
    lauf('git', 'checkout', '-q', '--detach', '-f', 'origin/main')
    lauf('git', 'clean', '-qfd')


def live_gleich(dateien, versuche=20):
    for _ in range(versuche):
        gleich = True
        for f in dateien:
            lokal = hashlib.sha256(open(os.path.join(BAUM, f), 'rb').read()).hexdigest()
            url = LIVE + f.replace('index.html', '') + f'?x={time.time_ns()}'
            try:
                live = hashlib.sha256(urllib.request.urlopen(url, timeout=30).read()).hexdigest()
            except Exception:
                live = ''
            gleich = gleich and lokal == live
        if gleich:
            return True
        time.sleep(30)
    return False


def ausliefern(heute, trocken):
    lauf('node', 'scripts/ig-zahlen.mjs')
    if not lauf('git', 'status', '--porcelain').stdout.strip():
        log('keine Aenderung')
        return
    for p in EN_STEMPEL:
        lauf('node', 'scripts/sprachen-stempel.mjs', p)
    lauf('./scripts/bump-asset-versions.sh')
    log('Zahlen gesetzt:', lauf('git', 'diff', '--stat').stdout.strip().splitlines()[-1])
    if trocken:
        log('--trocken: nicht ausgeliefert')
        return
    lauf('./scripts/premium-check.sh')                      # rot -> RuntimeError, nichts geht raus
    lauf('./scripts/bump-asset-versions.sh')
    lauf('git', 'add', '-A')
    lauf('git', 'commit', '-q', '-m', f'chore(zahlen): Instagram-Zahlen der Brands-Seiten, Stand {heute.isoformat()}\n\n'
         'Automatisch: scripts/ig-zahlen-loop.py (launchd com.vh.ig-zahlen), Pruefkette gruen.')
    lauf('git', 'push', '-q', 'origin', 'HEAD:refs/heads/main')
    if not live_gleich(SEITEN):
        raise RuntimeError('gepusht, aber live nicht gleich nach 10 min')
    log('LIVE', lauf('git', 'rev-parse', '--short', 'HEAD').stdout.strip())


def main(trocken=False):
    heute = datetime.date.today()
    baum_bereit()
    stand = stand_aus(open(os.path.join(BAUM, 'kooperationen.html'), encoding='utf8').read())
    alter = alter_tage(stand, heute)
    if alter < FAELLIG_TAGE and not trocken:
        log(f'Stand {stand}, {alter} Tage — noch nicht faellig')
        return 0
    if not grafik_da():
        log('keine Grafik (DarkWake) — naechster Lauf')
        return 0
    try:
        ausliefern(heute, trocken)
        return 0
    except Exception as e:
        log('ROT:', e)
        return 1 if alter > ALARM_TAGE else 0


def selbsttest():
    h = datetime.date(2026, 11, 9)
    faelle = [
        (stand_aus('<span data-ig-bis="2026-11-01">'), datetime.date(2026, 11, 1), 'Stand lesen'),
        (stand_aus('<span data-ig="stand">Juli</span>'), None, 'ohne Datum = None'),
        (alter_tage(None, h) >= FAELLIG_TAGE, True, 'ohne Datum ist faellig'),
        (alter_tage(datetime.date(2026, 10, 1), h) >= FAELLIG_TAGE, True, '39 Tage faellig'),
        (alter_tage(datetime.date(2026, 10, 20), h) >= FAELLIG_TAGE, False, '20 Tage nicht faellig'),
    ]
    rot = [n for ist, soll, n in faelle if ist != soll]
    if rot:
        print('✗ ig-zahlen-loop Selbsttest:', ', '.join(rot))
        return 1
    print(f'✓ ig-zahlen-loop Selbsttest: {len(faelle)} Faelle')
    return 0


if __name__ == '__main__':
    if '--selbsttest' in sys.argv:
        sys.exit(selbsttest())
    sys.exit(main(trocken='--trocken' in sys.argv))
