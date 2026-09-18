#!/usr/bin/env python3
"""Prueft, dass die ausgelieferte Seite nichts von fremden Hosts laedt.

WARUM DIESES TOR
GitHub Pages liefert den GANZEN Branch aus. Am 18.09.2026 lagen dadurch vier
interne Prototyp-Ordner oeffentlich abrufbar unter vegetarianhulk.de — alle mit
Status 200, von keiner Seite verlinkt, und sie luden **Google Fonts direkt von
Google**. Das ist ein DSGVO-Punkt, kein Schoenheitsfehler: Besucher-IPs gingen
ohne Einwilligung an einen Dritten.

Aufgefallen ist es nur, weil jemand danach gesucht hat. Kein Tor hat es gesehen
— alle bisherigen pruefen die VERLINKTEN Seiten, und verlinkt war keiner der
Ordner. Dieses hier geht deshalb ueber ALLE Dateien im Baum.

Erlaubt ist, was in ERLAUBT steht — mit Grund, und jeder Eintrag muss in
`datenschutz.html` stehen. Alles andere ist ein Befund.

Aufruf:  python3 scripts/fremdhosts-check.py [--selbsttest]
"""

import pathlib
import re
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent

# Jeder Eintrag: Host → warum er sein darf. Wer hier etwas ergaenzt, traegt es
# im selben Zug in datenschutz.html ein (Abschnitte 4 und 5).
ERLAUBT = {
    "challenges.cloudflare.com": "Turnstile, Spam-Schutz der Formulare",
    "vh-forms.peaking.workers.dev": "eigener Formular-Endpoint",
    "api.open-meteo.com": "Live-Wetter auf den Tourseiten",
}

# Ordner, die nicht zur Website gehoeren und deshalb auch nicht im Branch
# liegen duerfen. Namen, keine Muster: ein Muster haette hier zu viel getroffen.
VERBOTENE_ORDNER = ["design", "_preview", "design-system-sync", "design-archives",
                    "prototypes", "second-brain",
                    # 18.09.2026 dazugekommen: legal-slim trug eine ZWEITE,
                    # veraltete Datenschutzerklaerung; admin eine interne
                    # Pflegeoberflaeche; archive eine alte Seite ohne Rechtslinks.
                    "legal-slim", "admin", "archive"]

EIGEN = re.compile(r"vegetarianhulk|^/|^\.|^#|^data:|^mailto:|^tel:|^\{\{")
LADEND = re.compile(r"<(script|link|img|iframe|source|video|audio)\b[^>]*$", re.I)


def host_von(url):
    return re.sub(r"https?://([^/]+).*", r"\1", url)


def html_pruefen(datei, text):
    befunde = []
    for treffer in re.finditer(r'(?:src|href)\s*=\s*["\']([^"\']+)["\']', text):
        url = treffer.group(1)
        if not url.startswith("http") or EIGEN.search(url):
            continue
        # Nur was der Browser LAEDT. Ein <a href> zu einer fremden Seite ist
        # Navigation und voellig in Ordnung.
        if not LADEND.search(text[max(0, treffer.start() - 140):treffer.start()]):
            continue
        host = host_von(url)
        if host not in ERLAUBT:
            befunde.append((datei, host, url[:70]))

    for treffer in re.finditer(r'@import\s+["\']?(https?://[^"\')\s]+)', text):
        host = host_von(treffer.group(1))
        if host not in ERLAUBT:
            befunde.append((datei, host, treffer.group(1)[:70]))
    return befunde


def css_pruefen(datei, text):
    befunde = []
    for treffer in re.finditer(r'url\(\s*["\']?(https?://[^"\')\s]+)', text):
        host = host_von(treffer.group(1))
        if host not in ERLAUBT:
            befunde.append((datei, host, treffer.group(1)[:70]))
    return befunde


def main():
    selbsttest = "--selbsttest" in sys.argv
    dateien = [p for p in WURZEL.rglob("*")
               if p.is_file() and ".git" not in p.parts
               and p.suffix in (".html", ".css")]

    befunde = []
    for p in dateien:
        text = p.read_text(errors="replace")
        rel = str(p.relative_to(WURZEL))
        befunde += html_pruefen(rel, text) if p.suffix == ".html" else css_pruefen(rel, text)

    if selbsttest:
        # Fixture: eine Seite, die Google Fonts laedt — genau der Fall vom
        # 18.09.2026. Nur im Speicher, nichts wird geschrieben.
        fixture = '<html><head><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=X">'
        erkannt = html_pruefen("FIXTURE", fixture)
        sauber = html_pruefen("FIXTURE", '<link rel="stylesheet" href="/v3.css">')
        if not erkannt:
            print("✗ SELBSTTEST: Google Fonts im Fixture NICHT erkannt.")
            return 1
        if sauber:
            print("✗ SELBSTTEST: eigene Datei faelschlich als Fremdhost gemeldet.")
            return 1
        print("✓ Selbsttest: Fremdhost wird erkannt, eigener Pfad nicht.")
        return 0

    ordner = [d for d in VERBOTENE_ORDNER if (WURZEL / d).is_dir()]

    if befunde or ordner:
        if ordner:
            print("✗ fremdhosts-check: Ordner im ausgelieferten Branch, die nicht "
                  "zur Website gehoeren:")
            for d in ordner:
                anzahl = sum(1 for _ in (WURZEL / d).rglob("*"))
                print(f"    {d}/  ({anzahl} Eintraege) — GitHub Pages liefert sie mit aus")
        if befunde:
            print(f"✗ fremdhosts-check: {len(befunde)} Fremdaufruf(e):")
            for datei, host, url in befunde[:12]:
                print(f"    {datei}: {host}  ({url})")
        print("\n  Erlaubt sind nur (und jeder steht in datenschutz.html):")
        for host, grund in ERLAUBT.items():
            print(f"    {host} — {grund}")
        return 1

    print(f"✓ fremdhosts-check: {len(dateien)} Dateien, kein Aufruf ausserhalb der "
          f"{len(ERLAUBT)} erlaubten Hosts, keine fremden Ordner im Branch.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
