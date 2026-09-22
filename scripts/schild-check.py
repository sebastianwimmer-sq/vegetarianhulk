#!/usr/bin/env python3
"""Haelt das Schild-Material fest: matt, nicht hochglanz.

WARUM
Sebi am 22.09.2026: "bei unseren ganzen bergsigns also die gelb sind find
ich den glow noch etwas zu krass, ich haette gerne mehr dieses schild vibe
wie in den echten bergen".

Die Rezeptur stand an vierzehn Stellen wiederholt — jede mit eigenem
Weiss-Schimmer und eigenem Halo. Genau so driftet ein Material: niemand
aendert absichtlich etwas, es wird nur an der naechsten Stelle wieder
anders abgeschrieben. Jetzt gibt es `--schild-flaeche`, `--schild-kante`
und `--schild-schatten` in v3.css, und dieses Tor verbietet die alte
Mischung.

VERBOTEN IST DIE AUSSAGE, NICHT DER WORTLAUT
  · ein heller Weiss-Verlauf ueber einer Goldflaeche (Emaille-Glanz)
  · ein gelber Schein um ein Element (Halo statt Wurfschatten)
  · die Gold-Farbwerte als Verlauf von Hand statt ueber das Token

Ein Wegweiser am Berg ist lackiertes Blech. Er glaenzt nicht und er
leuchtet nicht — er wirft einen Schatten, weil er an einem Pfosten haengt.

MERKE (eine Stunde gekostet): `box-shadow` wird von `clip-path`
WEGGESCHNITTEN. Fast alle Schilder tragen die Pfeilform als clip-path,
also ist eine Kante per box-shadow dort unsichtbar. `drop-shadow` folgt
der Silhouette und zeichnet auch um die Pfeilspitze.

Aufruf:  python3 scripts/schild-check.py [--selbsttest]
"""

import pathlib
import re
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent

# Gold-Farbwerte, an denen eine Flaeche als Schild erkannt wird.
GOLD = r"(?:var\(--gold-(?:btn|band)[a-z-]*\)|#[Ff][0-9A-Fa-f]{2}[Cc][0-9A-Fa-f]{2}[0-9A-Fa-f]{2}|" \
       r"#E4B824|#E8BF25|#D4A918|#C99C12|#F4CE3C|#F8D6[34][0-9A-Fa-f])"

VERBOTEN = [
    # Weiss-Schimmer ueber Gold: der Emaille-Glanz. Wortstamm-tolerant, damit
    # eine andere Deckkraft oder ein anderer Winkel nicht durchrutscht.
    (re.compile(r"linear-gradient\([^;)]*rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0?\.[2-9]"
                r"[^;]{0,200}?" + GOLD, re.S),
     "Weiss-Schimmer ueber einer Goldflaeche — das ist Hochglanz-Emaille, "
     "kein lackiertes Blech. var(--schild-flaeche) nutzen."),
    # Gelber Halo. 0 0 <n>px in einem Goldton = Leuchten, nicht Schatten.
    (re.compile(r"(?:drop-shadow|box-shadow)\s*:?\s*\(?\s*0\s+0\s+(?:[6-9]|[1-9]\d)"
                r"(?:\.\d+)?px\s+rgba\(\s*2(?:32|28|44)\s*,", re.I),
     "gelber Schein um ein Element (Halo). Ein Wegweiser leuchtet nicht — "
     "var(--schild-schatten) wirft stattdessen."),
    # Gold-Verlauf von Hand statt ueber das Token.
    (re.compile(r"linear-gradient\(\s*180deg\s*,\s*" + GOLD + r"\s*(?:0%\s*)?,\s*" + GOLD),
     "Gold-Verlauf von Hand. Das Material gibt es einmal: var(--schild-flaeche)."),
]

# Hier steht die Definition selbst — sie darf die Werte natuerlich tragen.
AUSGENOMMEN = re.compile(r"--schild-(?:flaeche|kante|schatten)")


def datei_pruefen(pfad, text):
    befunde = []
    for regel, grund in VERBOTEN:
        for treffer in regel.finditer(text):
            zeile = text.count("\n", 0, treffer.start()) + 1
            # Die Token-Definition selbst ausnehmen: sie steht im :root-Block.
            umfeld = text[max(0, treffer.start() - 400):treffer.end()]
            if AUSGENOMMEN.search(umfeld):
                continue
            befunde.append((pfad, zeile, grund, treffer.group(0)[:64].replace("\n", " ")))
    return befunde


def selbsttest():
    """Zwei Fixtures. Ohne einen kaputten Fall weiss niemand, ob das Tor
    ueberhaupt anschlaegt — und ohne einen sauberen nicht, ob es zu weit
    greift."""
    kaputt = [
        ("Glanz", "background: linear-gradient(180deg, rgba(255,255,255,0.55) 0, "
                  "rgba(255,255,255,0) 42%), linear-gradient(180deg, var(--gold-btn-hell), #C99C12);"),
        ("Halo", "filter: drop-shadow(0 0 18px rgba(232,191,37,0.4));"),
        ("Halo-Box", "box-shadow: 0 0 14px rgba(232,191,37,0.55);"),
        ("Handverlauf", "background: linear-gradient(180deg, #E8BF25, #D4A918);"),
    ]
    for name, probe in kaputt:
        if not datei_pruefen("FIXTURE", probe):
            print(f"✗ SELBSTTEST: '{name}' wird NICHT erkannt — das Tor ist blind.")
            return 1

    sauber = [
        "background: var(--schild-flaeche); box-shadow: var(--schild-kante);",
        "filter: var(--schild-schatten);",
        # Gruene Glows sind erlaubt: sie gehoeren nicht zum Schild-Material.
        "box-shadow: 0 0 10px rgba(80,200,120,0.7);",
        # Ein schwacher Kartenzeichen-Schein bleibt zulaessig (unter 6 px).
        "box-shadow: 0 0 0 1.5px rgba(20,14,2,0.6), 0 0 5px rgba(232,191,37,0.3);",
        # Die Definition selbst.
        "--schild-flaeche: linear-gradient(180deg, #EFC733 0%, #E4B820 52%, #D3A614 100%);",
    ]
    for probe in sauber:
        b = datei_pruefen("FIXTURE", probe)
        if b:
            print(f"✗ SELBSTTEST: sauberer Fall faelschlich gemeldet — {probe[:52]!r}\n"
                  f"    {b[0][2]}")
            return 1

    print("✓ Selbsttest: Glanz, Halo und Handverlauf werden erkannt; "
          "Token, Gruen und schwache Kartenzeichen bleiben gruen.")
    return 0


def main():
    if "--selbsttest" in sys.argv:
        return selbsttest()

    dateien = [p for p in WURZEL.rglob("*")
               if p.is_file() and ".git" not in p.parts
               and "node_modules" not in p.parts
               and p.suffix in (".css", ".html")]
    befunde = []
    for p in dateien:
        befunde += datei_pruefen(str(p.relative_to(WURZEL)),
                                 p.read_text(encoding="utf-8", errors="replace"))

    if befunde:
        print(f"✗ schild-check: {len(befunde)} Stelle(n) mit Hochglanz statt Schild:")
        for pfad, zeile, grund, ausschnitt in befunde[:12]:
            print(f"    {pfad}:{zeile}  {grund}")
            print(f"      {ausschnitt}")
        print("\n  Das Material steht in v3.css: --schild-flaeche / --schild-kante /")
        print("  --schild-schatten. Ein Wegweiser am Berg ist matt.")
        return 1

    print(f"✓ schild-check: {len(dateien)} Dateien, kein Hochglanz, kein Halo, "
          "alle Schilder aus einer Quelle.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
