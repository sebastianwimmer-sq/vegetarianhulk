#!/usr/bin/env python3
"""Holt die Fotos einer Tour aus dem Bento-Raster in die angeheftete Galerie.

WARUM
Die Fotos standen als einzelne Kacheln zwischen den Textbloecken. Sebi am
20.09.2026: "die bilder sind nur so einzelne bloeche … die seiten sind noch
extrem statisch." Als durchziehender Streifen gehoeren sie zusammen, und das
Scrollen bekommt einen Moment, in dem etwas passiert.

Die Galerie sitzt NACH der Karte und VOR dem Abschluss: erst die Geschichte und
die Zahlen, dann die Bilder, dann der naechste Schritt.

Auf dem Handy und bei prefers-reduced-motion wird daraus ein nativer
Wisch-Streifen (siehe tour.css) — die Scrollrichtung am Daumen zu kapern ist
unangenehm, und ohne Bewegungswunsch gehoert sie gar nicht gekapert.

Aufruf:  python3 scripts/galerie-einbauen.py [slug ...]
"""

import pathlib
import re
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
ANFANG = "<!-- GALERIE (erzeugt: scripts/galerie-einbauen.py) -->"
ENDE = "<!-- /GALERIE -->"

KACHEL = re.compile(r'[ \t]*<figure class="tour-shot[^"]*"[^>]*>.*?</figure>\n?', re.S)


def bauen(kacheln, titel):
    # `--span` und `spannt-2` sind Raster-Angaben und im Streifen wirkungslos;
    # `--shot-ar` bleibt, daraus bekommt jedes Bild im Streifen seine Breite.
    sauber = []
    for k in kacheln:
        k = re.sub(r'\s*--span:\s*\d+;?', '', k)
        k = re.sub(r'\s*--shot-min:\s*[^;"]+;?', '', k)
        k = k.replace(' spannt-2', '').replace('spannt-2 ', '')
        k = re.sub(r'style="\s*"', '', k)
        sauber.append("            " + k.strip())

    return f'''{ANFANG}
      <section class="tour-galerie" style="--anzahl: {len(kacheln)}" aria-label="Bilder von der Tour">
        <div class="tour-galerie__buehne">
          <div class="tour-kopf tour-galerie__kopf">
            <span class="tour-kopf__label">Bilder<span class="hsep" aria-hidden="true"></span>{titel}</span>
          </div>
          <div class="tour-galerie__streifen">
{chr(10).join(sauber)}
          </div>
          <span class="tour-galerie__zaehler" aria-hidden="true">1 / {len(kacheln)}</span>
          <span class="tour-galerie__balken" aria-hidden="true"><i></i></span>
        </div>
      </section>
      {ENDE}'''


def eine_tour(slug):
    seite = WURZEL / "touren" / slug / "index.html"
    html = seite.read_text(encoding="utf-8")

    if ANFANG in html:
        # Schon gebaut: Kacheln aus der Galerie ziehen, damit neu gesetzt werden kann.
        block = re.search(re.escape(ANFANG) + r".*?" + re.escape(ENDE), html, re.S)
        kacheln = KACHEL.findall(block.group(0))
        html = html[:block.start()] + html[block.end():]
    else:
        kacheln = KACHEL.findall(html)

    if not kacheln:
        print(f"  {slug}: keine Fotos — uebersprungen")
        return False

    for k in kacheln:
        html = html.replace(k, "", 1)

    titel = re.search(r'tour-profil__marke--gipfel"[^>]*>([^<·]+)', html)
    titel = titel.group(1).strip() if titel else slug.capitalize()

    # Hinter die Karte, sonst hinter das Profil.
    anker = re.search(r'<!-- /WEGVERLAUF -->', html) or re.search(
        r'<section[^>]*class="[^"]*tour-profil[^"]*"', html)
    if not anker:
        print(f"  {slug}: kein Anker (weder Karte noch Profil) — nicht eingebaut")
        return False
    if "WEGVERLAUF" in anker.group(0):
        stelle = anker.end()
    else:
        stelle = html.find("</section>", anker.start()) + len("</section>")

    neu = html[:stelle] + "\n\n      " + bauen(kacheln, titel) + html[stelle:]
    # Leergeraeumte Zeilen im Raster aufraeumen
    neu = re.sub(r'\n{3,}', '\n\n', neu)

    seite.write_text(neu, encoding="utf-8")
    print(f"  {slug}: {len(kacheln)} Foto(s) in die Galerie")
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
