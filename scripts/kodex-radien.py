#!/usr/bin/env python3
"""
kodex-radien.py — setzt die festen Radien der Site auf die zwei Kodex-Tokens.

    python3 scripts/kodex-radien.py --pruefen    # nur berichten
    python3 scripts/kodex-radien.py --schreiben  # anwenden

Design-Kodex v3 Regel 4 kennt genau zwei Radien: Karten 28px, Controls 14px.
Die Site trug am 02.09.2026 noch 33 handgesetzte Werte zwischen 6 und 999px.

BEWUSST NICHT angefasst werden FORMEN — sie bilden einen Gegenstand ab und sind
weder Karte noch Bedienelement:
  · 50 %                       Kreise (Aufzaehlungspunkte, Play-Knopf, Badges)
  · .koop-phone*               iPhone-Mockup, dessen Radius das Geraet nachbildet
  · .anf-consent input         Checkbox — mit 14px waere sie fast rund
  · .koop-reel__logo           6px an einem 20px-Logo
  · <= 4px                     Polaroid-Kanten

Ein blindes Suchen-und-Ersetzen haette genau diese Faelle zerstoert, deshalb
steht hier eine explizite Zuordnung statt einer Regex ueber alle Zahlen.
"""
import re
import sys
from pathlib import Path

WURZEL = Path(__file__).resolve().parent.parent

# Selektor -> Token. Karte = Flaeche mit Inhalt, Control = etwas, das man bedient.
KARTE = "var(--r-karte)"
CONTROL = "var(--r-control)"

ZUORDNUNG = {
    "404.html": {".err-anker": KARTE},
    "anfrage.html": {
        ".anf-card": KARTE,
        ".anf-figs": CONTROL,
        '.anf-card input[type="text"]': CONTROL,
        ".anf-chip span": CONTROL,     # war 999px (Pille)
        ".anf-error": CONTROL,
    },
    "danke.html": {".ty-card": KARTE, ".ty-detail": CONTROL},
    "datenschutz.html": {".legal-doc": KARTE},
    "impressum.html": {".legal-doc": KARTE},
    "kooperationen.html": {
        ".koop-stage__frame": KARTE,
        ".koop-cream": KARTE,
        ".koop-flow__rail": KARTE,
        ".koop-ab-panel": KARTE,
        ".koop-pkg-hero": KARTE,
        ".koop-close__card": KARTE,
        ".koop-stage img": CONTROL,
        ".koop-reel__brandchip": CONTROL,
        ".koop-yield-signal": CONTROL,
        ".koop-ab-paytag": CONTROL,
        ".koop-pkg-flag": CONTROL,
        ".koop-offer": CONTROL,
        ".koop-pill": CONTROL,
        ".koop-notiz": CONTROL,
        ".koop-faq details": CONTROL,
    },
    "berg-starter/index.html": {
        ".bs-sheet": KARTE,
        ".bs-end": KARTE,
        ".bs-facts": CONTROL,
        ".bs-map": CONTROL,
        ".bs-btn": CONTROL,
    },
    "newsletter/index.html": {
        ".nl-signup": KARTE,
        ".nl-freebie": KARTE,
        ".anti-inner": KARTE,
        ".repeat-inner": KARTE,
        ".nl-benefit": CONTROL,
        ".sticky-cta": CONTROL,
    },
    "partner-picks/index.html": {
        ".pp-card": KARTE,
        ".pp-code": CONTROL,
        ".pp-copy": CONTROL,
        ".pp-pending": CONTROL,
        ".pp-noscript": CONTROL,
    },
}

# Zentrale Stylesheets. v3.css laedt jede Seite, deshalb wiegt sie am schwersten.
# style.css nur zwei Alt-Seiten, newsletter/styles.css laedt aktuell KEINE Seite.
STYLESHEETS = ["v3.css", "touren/tour.css"]

# Was stehen bleiben MUSS. Wird am Ende gegengeprueft.
FORMEN = re.compile(
    r"(50%|\.koop-phone|\.anf-consent input|\.koop-reel__logo|\.gb-buch|focus-visible"
    r"|\.koop-flow__node|\.koop-reel__play|\.anf-next li::before"
    r"|\.anf-success-badge|\.bs-kopf li::before|\.tk-me__shots)"
)


def ersetzen(css: str, selektor: str, token: str):
    """Ersetzt border-radius NUR in der Regel dieses einen Selektors."""
    # Wortgrenze nur, wenn der Selektor auf ein Wortzeichen endet — sonst
    # scheitert sie an Selektoren wie `input[type="text"]`.
    grenze = r"\b" if re.match(r"\w", selektor[-1]) else ""
    muster = re.compile(
        r"(" + re.escape(selektor) + grenze + r"[^{}]*\{[^{}]*?border-radius:\s*)"
        r"([\d.]+(?:px|rem|%))"
    )
    neu, anzahl = muster.subn(r"\g<1>" + token, css, count=1)
    return neu, anzahl


def bereitsToken(css: str, selektor: str) -> bool:
    """Traegt die Regel dieses Selektors schon ein Kodex-Token?"""
    grenze = r"\b" if re.match(r"\w", selektor[-1]) else ""
    muster = re.compile(
        re.escape(selektor) + grenze + r"[^{}]*\{[^{}]*?border-radius:\s*var\(--r-")
    return bool(muster.search(css))


def main() -> int:
    schreiben = "--schreiben" in sys.argv
    gesamt = offen = 0

    for datei, regeln in ZUORDNUNG.items():
        pfad = WURZEL / datei
        if not pfad.exists():
            print(f"  fehlt: {datei}")
            continue
        text = pfad.read_text(encoding="utf-8")
        vorher = text
        for selektor, token in regeln.items():
            text, n = ersetzen(text, selektor, token)
            if n:
                gesamt += n
            elif not bereitsToken(text, selektor):
                # Nicht getroffen UND kein Token: die Zuordnung stimmt nicht.
                # Steht dort laengst ein Token, ist alles in Ordnung — das war
                # der Grund, warum das Tor nach dem ersten Lauf dauerhaft rot stand.
                offen += 1
                print(f"  ! {datei}: {selektor} nicht getroffen")
        if schreiben and text != vorher:
            pfad.write_text(text, encoding="utf-8")

    # Gegenprobe: was ist an festen Radien uebrig, und ist das eine Form?
    rest = []
    # Zentrale Stylesheets mitpruefen — sie standen frueher nicht in ZUORDNUNG
    # und blieben deshalb unsichtbar, obwohl v3.css auf JEDER Seite laedt.
    for datei in list(ZUORDNUNG) + STYLESHEETS:
        pfad = WURZEL / datei
        if not pfad.exists():
            continue
        inhalt = pfad.read_text(encoding="utf-8")
        bloecke = (re.findall(r"<style>([\s\S]*?)</style>", inhalt)
                   if pfad.suffix == ".html" else [inhalt])
        for block in bloecke:
            for m in re.finditer(r"([^\n{}]*)\{([^{}]*?border-radius:\s*([\d.]+)(px|rem|%))", block):
                wert, einheit, sel = m.group(3), m.group(4), m.group(1).strip()
                if einheit == "px" and float(wert) <= 4:
                    continue
                if FORMEN.search(sel) or einheit == "%":
                    continue
                rest.append(f"{datei}: {sel.split(',')[0][:40]} → {wert}{einheit}")

    print(f"\n{gesamt} Radien auf Tokens gesetzt" + ("" if schreiben else " (Probelauf)"))
    if offen:
        print(f"{offen} Selektoren nicht getroffen — Zuordnung pruefen")
    if rest:
        print(f"\n{len(rest)} feste Radien ohne Form-Ausnahme uebrig:")
        for r in rest:
            print("   " + r)
    else:
        print("Keine ungeklaerten festen Radien mehr.")
    # Echtes Tor, auch im Pruefmodus: ungeklaerte feste Radien blocken.
    # `offen` zaehlt nur noch Selektoren, die WEDER ersetzt wurden NOCH schon
    # ein Token tragen — sonst stuende das Tor nach dem ersten Lauf dauerhaft rot.
    return 1 if (offen or rest) else 0


if __name__ == "__main__":
    sys.exit(main())
