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
      </section>
      {ENDE}'''


def aufraeumen(text):
    """Leerzeilen mit Leerzeichen zaehlen als leer. Sonst ueberlebt jeder
    Einbau-Lauf seinen eigenen Abstand und die Datei waechst."""
    text = re.sub(r"\n[ \t]+\n", "\n\n", text)
    return re.sub(r"\n{3,}", "\n\n", text)


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
        # Den Leerraum DAVOR und DAHINTER mitnehmen. Ohne das bleibt bei jedem
        # Lauf ein "\n\n      " zurueck, und die Datei waechst — am 22.09.2026
        # nach drei Laeufen um sechs Zeilen. `\n{3,}` faengt es nicht: die
        # Zeilen enthalten Leerzeichen und sind damit keine reinen Umbrueche.
        block = re.search(r"[ \t]*\n?\s*" + re.escape(ANFANG) + r".*?"
                          + re.escape(ENDE) + r"[ \t]*\n?", t, re.S)
        if not block:
            raise ValueError(f"{slug}: Marker ohne Gegenstueck")
        t = t[:block.start()] + "\n" + t[block.end():]

    anker = re.search(r'<!-- /BILDSTRECKE -->', t)
    if not anker:
        raise ValueError(f"{slug}: keine Bildstrecke — die Reihe steht danach")
    neu = t[:anker.end()] + "\n\n      " + bauen(daten, slug) + t[anker.end():]
    neu = aufraeumen(neu)
    seite.write_text(neu, encoding="utf-8")
    print(f"  {slug}: {len(daten['gipfel'])} Kreuze eingebaut")
    return True


def selbsttest():
    probe = {
        "titel": "T", "kicker": "K", "lede": "L",
        "gipfel": [
            {"name": "A & B", "art": "Gipfel", "hoehe": 1694, "an": "10:02",
             "bild": "x", "alt": 'Ein "Kreuz"', "notiz": "N"},
            {"name": "C", "art": "Kreuz", "hoehe": 1692, "an": "10:38",
             "bild": "y", "alt": "A", "notiz": "N"},
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
    # Sebi am 22.09.2026: "das is so zu viel explaining ... das juckt niemand".
    # Woher eine Zahl kommt, gehoert in die Belegkette, nicht unter jedes Kreuz.
    for wort in ("OSM", "GPX", "Aufzeichnung", "Quelle"):
        if wort in g:
            print(f"✗ SELBSTTEST: '{wort}' steht wieder in der Ausgabe — "
                  "Herkunft gehoert nicht unter jedes Kreuz")
            return 1

    # IDEMPOTENZ am ECHTEN Baum. Genau hier lief es am 22.09.2026 vorbei:
    # der Selbsttest prueft Fixtures, und das WACHSEN der Datei zeigt sich
    # erst, wenn man dieselbe Seite zweimal baut. kern.md: erst wenn Lauf 2
    # und Lauf 3 byte-gleich sind, ist der Umbau stabil.
    import hashlib, shutil, tempfile
    beispiel = None
    for k in sorted((WURZEL / "touren").iterdir()):
        if (k / "index.html").exists() and ANFANG in (k / "index.html").read_text(encoding="utf-8"):
            beispiel = k
            break
    if beispiel:
        with tempfile.TemporaryDirectory() as tmp:
            sicher = pathlib.Path(tmp) / "vorher.html"
            shutil.copy(beispiel / "index.html", sicher)
            try:
                eine_tour(beispiel.name)
                a = hashlib.md5((beispiel / "index.html").read_bytes()).hexdigest()
                eine_tour(beispiel.name)
                b = hashlib.md5((beispiel / "index.html").read_bytes()).hexdigest()
            finally:
                shutil.copy(sicher, beispiel / "index.html")
        if a != b:
            print(f"✗ SELBSTTEST: zweiter Lauf aendert die Datei erneut ({beispiel.name}) — "
                  "der Einbau haeuft Leerraum an und die Seite waechst bei jedem Bau.")
            return 1

    print("✓ Selbsttest: maskiert, Ankunft steht, keine Standzeit, "
          "keine Herkunfts-Fussnote, zweiter Lauf stabil.")
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
