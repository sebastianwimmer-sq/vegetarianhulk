#!/usr/bin/env python3
"""Gibt jeder Foto-Kachel das Seitenverhaeltnis IHRES Bildes.

WARUM
-----
`.tour-shot` hatte lange nur eine Mindesthoehe und wuchs auf die Hoehe seiner
Rasterzeile. Stand daneben etwas Hohes — die Routenkarte —, wurde aus einem
3:4-Foto eine schmale Saeule, und `object-fit: cover` schnitt bis zu 59 % weg.
Gemerkt hat das Sebi, kein Tor.

Die Kachel traegt jetzt `--shot-ar`, gerechnet aus `width`/`height` des Bildes.
Damit ist der Beschnitt bauartbedingt null: die Kachel folgt dem Bild statt
umgekehrt. Wer bewusst anders zuschneiden will, setzt `--shot-ar` von Hand —
dieses Skript fasst gesetzte Werte nicht an.

Aufruf:  python3 scripts/foto-format.py [slug ...]
"""

import math
import pathlib
import re
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent

# Ab hier ist ein Bild nicht mehr hochkant. Eine Kachel, die zwei Zeilen bindet
# (`spannt-2`), ist immer deutlich hochkant — ein quer- oder quadratformatiges
# Foto gehoert dort nicht hinein.
HOCHKANT_BIS = 0.92


def gekuerzt(zaehler, nenner):
    t = math.gcd(zaehler, nenner)
    return zaehler // t, nenner // t


def eine_tour(slug):
    seite = WURZEL / "touren" / slug / "index.html"
    html = seite.read_text(encoding="utf-8")
    original = html
    bericht = []

    for treffer in list(re.finditer(
            r'<figure class="(tour-shot[^"]*)"([^>]*)>(.*?)</figure>', html, re.S)):
        klassen, attribute, inhalt = treffer.groups()

        masse = re.search(r'width="(\d+)"\s+height="(\d+)"', inhalt)
        if not masse:
            continue
        breite, hoehe = int(masse.group(1)), int(masse.group(2))
        verhaeltnis = breite / hoehe

        stil = re.search(r'style="([^"]*)"', attribute)
        stil_text = stil.group(1) if stil else ""
        # Ein gesetztes `--shot-ar` bleibt stehen (jemand wollte den Zuschnitt
        # so). Das darf aber nicht heissen, dass die Kachel im Ganzen
        # uebersprungen wird — sonst bleibt ein widersprechendes
        # `--shot-mobil` unangetastet, und genau das hat auf dem Handy
        # weiter 30 % weggeschnitten.
        ar_gesetzt = "--shot-ar" in stil_text

        neue_klassen = klassen
        # Eine hohe Doppelzeilen-Kachel braucht ein hochkantes Bild. Ein
        # quadratisches Panorama darin verliert die Haelfte.
        if "spannt-2" in klassen and verhaeltnis > HOCHKANT_BIS:
            neue_klassen = klassen.replace(" spannt-2", "").replace("spannt-2 ", "")
            bericht.append(f"    {masse.group(0)}: spannt-2 entfernt "
                           f"(Bild ist {verhaeltnis:.2f}, nicht hochkant)")

        if "spannt-2" in neue_klassen:
            continue  # bindet bewusst zwei Zeilen, Verhaeltnis waere wirkungslos

        # Ein `--shot-mobil`, das der Form des Bildes widerspricht, schneidet
        # auf dem Handy weg, was am Rechner stehen bleibt — bei Hochformat-
        # Fotos in einer 4:3-Kachel bis zu 44 %. Nur behalten, wenn es nah
        # am Bild liegt.
        mobil = re.search(r'--shot-mobil:\s*([\d.]+)\s*/\s*([\d.]+)', stil_text)
        if mobil:
            m_verh = float(mobil.group(1)) / float(mobil.group(2))
            if abs(m_verh - verhaeltnis) / verhaeltnis > 0.15:
                stil_text = re.sub(r'\s*--shot-mobil:[^;]*;?', '', stil_text).strip()
                bericht.append(f"    {breite}×{hoehe}: --shot-mobil {mobil.group(0)[15:]} "
                               f"entfernt (Bild ist {verhaeltnis:.2f})")

        z, n = gekuerzt(breite, hoehe)
        neuer_stil = stil_text if ar_gesetzt else (f"--shot-ar: {z} / {n}; " + stil_text).strip()
        neues_attr = (re.sub(r'style="[^"]*"', f'style="{neuer_stil}"', attribute)
                      if stil else f' style="{neuer_stil}"{attribute}')

        alt = treffer.group(0)
        neu = f'<figure class="{neue_klassen}"{neues_attr}>{inhalt}</figure>'
        if neu == alt:
            continue
        html = html.replace(alt, neu, 1)
        if not ar_gesetzt:
            bericht.append(f"    {breite}×{hoehe} → --shot-ar: {z}/{n}")

    if html == original:
        print(f"  {slug}: unveraendert")
        return False
    seite.write_text(html, encoding="utf-8")
    print(f"  {slug}: {len(bericht)} Kachel(n)")
    for zeile in bericht:
        print(zeile)
    return True


def main():
    slugs = sys.argv[1:] or [
        p.name for p in sorted((WURZEL / "touren").iterdir())
        if (p / "index.html").exists()
    ]
    geaendert = sum(eine_tour(s) for s in slugs)
    print(f"\n{geaendert} von {len(slugs)} Seiten geaendert")


if __name__ == "__main__":
    main()
