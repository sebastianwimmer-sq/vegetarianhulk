#!/usr/bin/env python3
"""Baut die Kreuz-Reihe einer Mehrgipfel-Tour.

WARUM
Sebi am 22.09.2026: "mach was cooles aus den 4 gipfelkreuzen". Vier
Kreuzfotos einzeln in die Bildstrecke zu haengen waere die schlechteste
Loesung — sie gehoeren zusammen, und ihr Reiz liegt im VERGLEICH: vier
Kreuze, vier Bauarten, ein Vormittag. Deshalb ein eigener Abschnitt: die
vier nebeneinander als Polyptychon, je Kreuz Name, Hoehe, Ankunft.

Eine erste Fassung zeigte zusaetzlich die Standzeit als Balken (33 min
auf dem ersten, 7 auf dem zweiten). Sebi hat sie am selben Tag wieder
rausgenommen: "lass bei den 4 kreuzen die minuten weg". Der Selbsttest
haelt das fest, damit es nicht durch eine spaetere Runde zurueckkommt.

Die NOTIZ ist Sebis eigener Satz, nicht nacherzaehlt. "Der Spontane. Die
laengste Pause des Tages." war der Reflex, gegen den kern.md warnt: aus
einem Wanderer wird eine Autoritaet, und das ist das Gegenteil seiner
dokumentierten Stimme.

Ohne gipfel.json passiert fuer eine Tour nichts. Das ist Absicht: eine
Tour mit einem Gipfel braucht keine Reihe, und ein Werkzeug, das fuer
jeden fehlenden Fall meckert, steht dauerhaft rot.

Aufruf:  python3 scripts/gipfelreihe-einbauen.py [slug ...]
         python3 scripts/gipfelreihe-einbauen.py --selbsttest
"""

import html as html_mod
import json
import pathlib
import re
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
ANFANG = "<!-- KREUZE (erzeugt: scripts/gipfelreihe-einbauen.py) -->"
ENDE = "<!-- /KREUZE -->"


def e(text):
    return html_mod.escape(str(text), quote=True)


def bauen(daten, slug):
    karten = []
    for n, g in enumerate(daten["gipfel"], 1):
        hinweis = (f'<span class="tour-kreuz__osm">{e(g["osm_hinweis"])}</span>'
                   if g.get("osm_hinweis") else "")
        hoehe = f'{g["hoehe"]:,}'.replace(",", ".")
        karten.append(f'''          <figure class="tour-kreuz" style="--n: {n}">
            <div class="tour-kreuz__bild">
              <img srcset="/touren/{slug}/{g["bild"]}-640.jpg 480w, /touren/{slug}/{g["bild"]}.jpg 1050w"
                   sizes="(max-width: 700px) 46vw, 23vw"
                   src="/touren/{slug}/{g["bild"]}.jpg" width="1050" height="1400"
                   alt="{e(g["alt"])}" loading="lazy" decoding="async">
              <span class="tour-kreuz__uhr" aria-hidden="true">{e(g["an"])}</span>
            </div>
            <figcaption class="tour-kreuz__text">
              <b class="tour-kreuz__name">{e(g["name"])}</b>
              <span class="tour-kreuz__art">{e(g["art"])}<span class="hsep" aria-hidden="true"></span>{hoehe} m</span>
              <span class="tour-kreuz__notiz">{e(g["notiz"])}</span>
              {hinweis}
            </figcaption>
          </figure>''')

    return f'''{ANFANG}
      <section class="tour-kreuze flaeche-wald" aria-labelledby="kreuze-{slug}">
        <div class="tour-kreuze__kopf">
          <p class="tour-kreuze__kicker">{e(daten["kicker"])}</p>
          <h2 class="tour-kreuze__titel" id="kreuze-{slug}">{e(daten["titel"])}</h2>
          <p class="tour-kreuze__lede">{e(daten["lede"])}</p>
        </div>
        <div class="tour-kreuze__reihe">
{chr(10).join(karten)}
        </div>
        <p class="tour-kreuze__quelle">{e(daten["quelle"])}</p>
      </section>
      {ENDE}'''


def eine_tour(slug):
    ordner = WURZEL / "touren" / slug
    quelle = ordner / "gipfel.json"
    if not quelle.exists():
        return None                     # kein Befund, nur nichts zu tun
    daten = json.loads(quelle.read_text(encoding="utf-8"))

    fehlend = [g["bild"] for g in daten["gipfel"]
               if not (ordner / f"{g['bild']}.jpg").exists()]
    if fehlend:
        # Lieber abbrechen als eine Reihe mit Loechern ausliefern: ein
        # fehlendes Bild kommt live als 404 und reisst die Reihe auf.
        raise FileNotFoundError(f"{slug}: Bild(er) fehlen — {', '.join(fehlend)}")

    seite = ordner / "index.html"
    t = seite.read_text(encoding="utf-8")
    if ANFANG in t:
        block = re.search(re.escape(ANFANG) + r".*?" + re.escape(ENDE), t, re.S)
        if not block:
            raise ValueError(f"{slug}: Marker ohne Gegenstueck")
        t = t[:block.start()] + t[block.end():]

    anker = re.search(r'<!-- /BILDSTRECKE -->', t)
    if not anker:
        raise ValueError(f"{slug}: keine Bildstrecke — die Reihe steht danach")
    neu = t[:anker.end()] + "\n\n      " + bauen(daten, slug) + t[anker.end():]
    neu = re.sub(r'\n{3,}', '\n\n', neu)
    seite.write_text(neu, encoding="utf-8")
    print(f"  {slug}: {len(daten['gipfel'])} Kreuze eingebaut")
    return True


def selbsttest():
    probe = {
        "titel": "T", "kicker": "K", "lede": "L", "quelle": "Q",
        "gipfel": [
            {"name": "A & B", "art": "Gipfel", "hoehe": 1694, "an": "10:02",
             "bild": "x", "alt": 'Ein "Kreuz"', "notiz": "N",
             "osm_hinweis": "OSM: 1.691 m"},
            {"name": "C", "art": "Kreuz", "hoehe": 1692, "an": "10:38",
             "bild": "y", "alt": "A", "notiz": "N",
             "osm_hinweis": None},
        ],
    }
    g = bauen(probe, "test")
    if "A &amp; B" not in g or "&quot;Kreuz&quot;" not in g:
        print("✗ SELBSTTEST: Sonderzeichen nicht maskiert — das bricht das Markup")
        return 1
    if "1.694 m" not in g:
        print("✗ SELBSTTEST: Tausenderpunkt fehlt")
        return 1
    if "10:02" not in g or "10:38" not in g:
        print("✗ SELBSTTEST: Ankunftszeit fehlt")
        return 1
    if "min" in g or "--anteil" in g:
        print("✗ SELBSTTEST: Standzeit ist wieder drin — Sebi wollte die Minuten weg")
        return 1
    if g.count("tour-kreuz__osm") != 1:
        print("✗ SELBSTTEST: der OSM-Hinweis darf nur stehen, wo er gesetzt ist")
        return 1
    print("✓ Selbsttest: maskiert, Ankunft steht, keine Standzeit mehr, "
          "Hinweis nur wo gesetzt.")
    return 0


def main():
    if "--selbsttest" in sys.argv:
        return selbsttest()
    slugs = [a for a in sys.argv[1:] if not a.startswith("-")] or [
        p.name for p in sorted((WURZEL / "touren").iterdir())
        if (p / "index.html").exists()
    ]
    getan = [s for s in slugs if eine_tour(s)]
    print(f"\n{len(getan)} Tour(en) mit Kreuz-Reihe"
          f"{' — ' + ', '.join(getan) if getan else ''}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
