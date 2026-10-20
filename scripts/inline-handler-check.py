#!/usr/bin/env python3
"""inline-handler-check.py — kein onsubmit/onclick/… auf Seiten, deren CSP sie blockiert.

WARUM (20.10.2026): anfrage.html trug onsubmit="return submitBrandInquiry(event)".
Seit der CSP-Haertung am 03.09.2026 (script-src 'self', ohne 'unsafe-inline')
fuehrte der Browser den Handler nicht mehr aus und schickte das Formular nativ
ab — Seite neu geladen, E-Mail in der URL, keine Anfrage beim Worker. Kein Tor
sah es, weil jede Seite fuer sich „korrekt“ aussah.

    python3 scripts/inline-handler-check.py              # Exit 1 bei Fund
    python3 scripts/inline-handler-check.py --selbsttest
"""
import pathlib
import re
import sys
import tempfile

WURZEL = pathlib.Path(__file__).resolve().parent.parent
INTERN = {'.git', 'node_modules', '_preview', 'archive', 'audit', 'audit-reports', 'design',
          'design-archives', 'docs', 'email-templates', 'mail-templates', 'workers', 'scripts'}
HANDLER = re.compile(r'<[a-zA-Z][^>]*\s(on[a-z]+)\s*=\s*["\']', re.S)
CSP = re.compile(r'<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]*)"', re.I)


def blockiert(html):
    """True, wenn die Seiten-CSP Inline-Handler verbietet."""
    m = CSP.search(html)
    if not m:
        return False
    teile = {d.strip().split(' ')[0]: d for d in m.group(1).split(';') if d.strip()}
    quelle = teile.get('script-src') or teile.get('default-src') or ''
    return "'unsafe-inline'" not in quelle and "'unsafe-hashes'" not in quelle


def pruefe(wurzel):
    befunde = []
    for p in sorted(wurzel.rglob('*.html')):
        if INTERN & set(p.relative_to(wurzel).parts[:-1]):
            continue
        html = p.read_text(encoding='utf-8', errors='replace')
        if not blockiert(html):
            continue
        for m in HANDLER.finditer(html):
            zeile = html.count('\n', 0, m.start()) + 1
            befunde.append(f'{p.relative_to(wurzel)}:{zeile}: {m.group(1)}= wird von der CSP blockiert')
    return befunde


def selbsttest():
    csp = '<meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'">'
    with tempfile.TemporaryDirectory() as d:
        w = pathlib.Path(d)
        (w / 'kaputt.html').write_text(csp + '<form id="f" onsubmit="return x(event)"></form>')
        (w / 'sauber.html').write_text(csp + '<form id="f"></form><script src="/x.js"></script>')
        (w / 'erlaubt.html').write_text(csp.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'")
                                        + '<button onclick="print()">x</button>')
        b = pruefe(w)
    ok = len(b) == 1 and b[0].startswith('kaputt.html:1: onsubmit=')
    print(('✓' if ok else '✗') + ' Selbsttest: kaputt rot, sauber und erlaubt gruen' + ('' if ok else f' — {b}'))
    return 0 if ok else 1


if __name__ == '__main__':
    if '--selbsttest' in sys.argv:
        sys.exit(selbsttest())
    befunde = pruefe(WURZEL)
    for b in befunde:
        print('✗ ' + b)
    print(f'{"✗" if befunde else "✓"} Inline-Handler: {len(befunde)} Fund(e)')
    sys.exit(1 if befunde else 0)
