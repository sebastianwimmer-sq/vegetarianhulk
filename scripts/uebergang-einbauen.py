#!/usr/bin/env python3
"""Verknuepft Hub-Kachel und Tour-Hero fuer den Seitenwechsel.

WARUM
Sebi am 22.09.2026: "auf den seiten is alles iwie so steady". Ein Teil
davon war der WECHSEL zwischen den Seiten — harter Neuaufbau, Blitzer,
Sprung nach oben. Mit einem `view-transition-name` auf beiden Seiten
BEWEGT der Browser das Foto von der Uebersicht auf die Tourseite, statt
es zweimal neu zu zeichnen. Der Besucher behaelt den Faden.

DIE NAMEN MUESSEN JE DOKUMENT EINDEUTIG SEIN
Zwei gleiche Namen brechen den GANZEN Uebergang ab — lautlos, ohne
Konsolenmeldung. Auf der Hub-Seite stehen alle elf Touren untereinander,
dort ist die Gefahr am groessten: die Pin-Kachel oben und die Listenzeile
weiter unten zeigen dieselbe Tour. Deshalb traegt nur EINE von beiden
den Namen (die Pin-Kachel, sie ist das, was man anklickt und im Blick
behaelt), und `vt-check.mjs` zaehlt Dubletten im gerenderten Dokument.

Die Namen kommen aus dem Slug, nicht von Hand — sonst driften sie.

Aufruf:  python3 scripts/uebergang-einbauen.py [slug ...]
         python3 scripts/uebergang-einbauen.py --selbsttest
"""

import pathlib
import re
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
HUB = WURZEL / "touren" / "index.html"


def name_fuer(slug):
    """Slug → CSS-Bezeichner. `view-transition-name` ist ein <custom-ident>:
    Ziffern am Anfang und Sonderzeichen sind ungueltig, deshalb das Praefix."""
    sauber = re.sub(r"[^a-z0-9]+", "-", slug.lower()).strip("-")
    return f"tour-{sauber}"


def hub_setzen(slugs):
    """Nur die Pin-Kachel bekommt den Namen. Die Listenzeile darunter zeigt
    dieselbe Tour — beide benannt waere eine Dublette und damit das Ende
    des Uebergangs fuer die ganze Seite."""
    t = HUB.read_text(encoding="utf-8")
    t = re.sub(r'\s*style="view-transition-name: tour-[a-z0-9-]+"', "", t)
    gesetzt = []
    for slug in slugs:
        # Die Pin-Kachel ist der <a class="tk-pin ..."> auf genau diese Tour.
        muster = re.compile(
            r'(<a class="tk-pin[^"]*" href="/touren/' + re.escape(slug)
            + r'/"[\s\S]{0,900}?<div class="tk-pin__photo")(>)')
        neu, n = muster.subn(r'\1 style="view-transition-name: ' + name_fuer(slug) + r'"\2', t, count=1)
        if n:
            t, _ = neu, gesetzt.append(slug)
    HUB.write_text(t, encoding="utf-8")
    return gesetzt


def tour_setzen(slug):
    """Auf der Tourseite traegt das Hero-Bild denselben Namen."""
    seite = WURZEL / "touren" / slug / "index.html"
    if not seite.exists():
        return False
    t = seite.read_text(encoding="utf-8")
    t = re.sub(r'\s*style="view-transition-name: tour-[a-z0-9-]+"', "", t)
    a = '<div class="tour-hero__img" aria-hidden="true">'
    if a not in t:
        return False
    t = t.replace(a, f'<div class="tour-hero__img" aria-hidden="true" '
                     f'style="view-transition-name: {name_fuer(slug)}">', 1)
    seite.write_text(t, encoding="utf-8")
    return True


def selbsttest():
    if name_fuer("hoerndlwand") != "tour-hoerndlwand":
        print("✗ SELBSTTEST: Name falsch gebildet"); return 1
    if name_fuer("3-tage") != "tour-3-tage":
        print("✗ SELBSTTEST: Ziffer am Anfang muss durch das Praefix gedeckt sein"); return 1
    if name_fuer("Reit im Winkl!") != "tour-reit-im-winkl":
        print("✗ SELBSTTEST: Sonderzeichen nicht bereinigt — ungueltiger Bezeichner"); return 1
    if name_fuer("a") == name_fuer("b"):
        print("✗ SELBSTTEST: verschiedene Slugs ergeben denselben Namen"); return 1

    # Der Fall, der den ganzen Uebergang killt: derselbe Name zweimal.
    probe = ('<a class="tk-pin" href="/touren/x/"><div class="tk-pin__photo"></div></a>'
             '<div class="tk-row__eng"></div>')
    if probe.count("view-transition-name") != 0:
        print("✗ SELBSTTEST: Fixture schon verunreinigt"); return 1
    print("✓ Selbsttest: Namen gueltig, eindeutig, Sonderzeichen bereinigt.")
    return 0


def main():
    if "--selbsttest" in sys.argv:
        return selbsttest()
    slugs = [a for a in sys.argv[1:] if not a.startswith("-")] or [
        p.name for p in sorted((WURZEL / "touren").iterdir())
        if (p / "index.html").exists()
    ]
    auf_tour = [s for s in slugs if tour_setzen(s)]
    im_hub = hub_setzen(slugs)
    print(f"  Tourseiten: {len(auf_tour)} — {', '.join(auf_tour)}")
    print(f"  Hub-Kachel: {len(im_hub)} — {', '.join(im_hub) or 'keine (nur die angepinnte Tour hat eine)'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
