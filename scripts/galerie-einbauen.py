#!/usr/bin/env python3
"""Baut die Fotos einer Tour zur senkrechten Bildstrecke um.

WARUM
Die Fotos hatten zwei Vorleben. Erst standen sie als einzelne Kacheln im
Bento-Raster zwischen den Textbloecken ("die bilder sind nur so einzelne
bloeche"). Dann als angehefteter Streifen, der beim Scrollen quer fuhr —
und in DER Fassung waren sie auf dem Handy 304 px klein und standen im
gruenen Nichts. Sebi am 22.09.2026: "wollte nicht dass die so klein zum
durchsliden sind sondern eher dass man durchs scrollen so rein slidet".

Jetzt eine senkrechte Strecke, deren Blaetter beim Scrollen hereinkommen.
Die Bewegung macht das CSS (tour.css, Abschnitt BILDSTRECKE); dieses
Skript entscheidet nur die ANATOMIE je Foto.

DIE ANATOMIE HAENGT AM SEITENVERHAELTNIS, NICHT AN DER REIHENFOLGE
Ein Querformat ueber die volle Breite ist das Durchatmen. Ein Hochformat
auf voller Breite waere 1.400 px hoch und wuerde die Seite sprengen — es
steht deshalb versetzt, mit dem Text in der Randspalte. Zwei Hochformate
hintereinander werden zu einem Paar: neun Einzelblaetter waeren acht
Bildschirmlaengen Scrollen fuer eine Fotostrecke.

Die Quelle ist die Seite selbst: was als <figure class="tour-shot"> darin
steht, kommt in die Strecke. Kein zweites Verzeichnis, das driften kann.

Aufruf:  python3 scripts/galerie-einbauen.py [slug ...]
         python3 scripts/galerie-einbauen.py --selbsttest
"""

import pathlib
import re
import sys

WURZEL = pathlib.Path(__file__).resolve().parent.parent
ANFANG = "<!-- BILDSTRECKE (erzeugt: scripts/galerie-einbauen.py) -->"
ENDE = "<!-- /BILDSTRECKE -->"
# Der alte Marker, damit ein zweiter Lauf die Vorgaengerfassung findet.
ALT_ANFANG = "<!-- GALERIE (erzeugt: scripts/galerie-einbauen.py) -->"
ALT_ENDE = "<!-- /GALERIE -->"

# Erster Lauf: die Kachel traegt ihre Bildunterschrift noch in sich.
# Ab dem zweiten Lauf steht der Text als GESCHWISTER daneben — wer nur die
# Kachel greift, verliert ihn dann lautlos. Am 22.09.2026 genau so passiert:
# nach dem zweiten Lauf standen sieben Fotos ohne eine einzige Zeile da.
KACHEL = re.compile(
    r'[ \t]*<figure class="tour-shot[^"]*"[^>]*>.*?</figure>\n?'
    r'(?:\s*<figcaption class="tour-blatt__text">.*?</figcaption>)?', re.S)

# Kacheln, die zwischen den Zahlen stehen statt in der Strecke.
# Sebi am 22.09.2026: "gerne noch die bilder etwas mehr in die stats weiter
# oben mit rein mischen". Der Platz war schon frei — die Karte belegt acht
# von zwoelf Spalten, vier standen leer, und das Profil lief ueber alle
# zwoelf, obwohl acht reichen.
#
# Die Verteilung macht DIESES Skript, nicht ein zweites. Ein erster Anlauf
# mit einem eigenen `stats-fotos.py` hat beim zweiten Lauf Fotos VERLOREN
# (7 wurden zu 5), weil beide Skripte dieselben Kacheln verschoben und
# keines wusste, was das andere gerade weggenommen hatte.
OBEN = "tour-shot--oben"

# Wie viele nach oben duerfen. Die Strecke soll eine Strecke bleiben:
# zwei Fotos sind das Minimum fuer ein Paar, davon geht keins weg.
def wie_viele_oben(anzahl):
    if anzahl >= 6:
        return 2
    if anzahl >= 3:
        return 1
    return 0


def oben_auswahl(anzahl):
    """Chronologisch passend zum Nachbarn: neben das Profil ein Bild aus
    dem AUFSTIEG (die Mitte), neben die Karte das LETZTE (der Ueberblick)."""
    n = wie_viele_oben(anzahl)
    if n == 0:
        return []
    if n == 1:
        return [anzahl // 2]
    return [anzahl // 2, anzahl - 1]


def als_oben(kachel, span):
    """Kachel fuers Raster herrichten. Marke vorher entfernen, sonst steht
    sie beim zweiten Lauf zweimal in derselben class-Liste."""
    # Einrueckung normalisieren statt uebernehmen: sonst wandert die Kachel
    # bei jedem Lauf weiter nach rechts.
    k = kachel.lstrip("\n").lstrip(" \t").replace(f" {OBEN}", "")
    k = re.sub(r'class="tour-shot([^"]*)"',
               lambda m: f'class="tour-shot{m.group(1)} {OBEN}"', k, count=1)
    if "--span" in k:
        k = re.sub(r"--span:\s*\d+", f"--span: {span}", k)
    elif 'style="' in k:
        k = k.replace('style="', f'style="--span: {span}; ', 1)
    else:
        k = k.replace('<figure class="tour-shot',
                      f'<figure style="--span: {span}" class="tour-shot', 1)
    # Im Raster ein Drittel breit, nicht halb — und sie steht weit oben,
    # lazy waere dort ein Nachladen im Blickfeld.
    k = re.sub(r'sizes="[^"]*"', 'sizes="(max-width: 860px) 92vw, 30vw"', k)
    return re.sub(r'loading="lazy"', 'loading="eager"', k)
# Ab hier gilt ein Bild als Querformat. 1.15 statt 1.0, damit ein fast
# quadratisches Bild nicht ueber die volle Breite laeuft.
QUER_AB = 1.15


def verhaeltnis(kachel):
    """Seitenverhaeltnis aus width/height des <img>.

    NICHT aus --shot-ar: das Feld setzt den ANZEIGE-Beschnitt und ist bei
    manchen Kacheln bewusst anders als das Foto. Fuer die Frage "quer oder
    hoch" zaehlt das echte Bild.
    """
    b = re.search(r'\bwidth="(\d+)"', kachel)
    h = re.search(r'\bheight="(\d+)"', kachel)
    if not b or not h or int(h.group(1)) == 0:
        return 0.75          # unbekannt → wie ein Hochformat behandeln
    return int(b.group(1)) / int(h.group(1))


def zurueckbauen(stueck):
    """Kachel + danebenstehender Text → wieder EINE Kachel mit <figcaption>.

    Damit ist die Eingabe des zweiten Laufs formgleich mit der des ersten,
    und `zerlegen` muss den Sonderfall nicht kennen.
    """
    text = re.search(r'<figcaption class="tour-blatt__text">(.*?)</figcaption>', stueck, re.S)
    kachel = re.sub(r'\s*<figcaption class="tour-blatt__text">.*?</figcaption>', "", stueck, flags=re.S)
    if not text:
        return kachel
    titel = re.search(r"<b>(.*?)</b>", text.group(1), re.S)
    rest = re.search(r"<span>(.*?)</span>", text.group(1), re.S)
    inhalt = (f"<b>{titel.group(1).strip()}</b>" if titel else "") + \
             (rest.group(1).strip() if rest else "")
    return kachel.rstrip().rstrip("\n").replace(
        "</figure>", f"<figcaption>{inhalt}</figcaption></figure>", 1) + "\n"


def zerlegen(kachel):
    """Bild und Bildunterschrift trennen — der Text steht jetzt daneben."""
    bild = re.sub(r'\s*<figcaption>.*?</figcaption>', '', kachel, flags=re.S).rstrip()
    cap = re.search(r'<figcaption>(.*?)</figcaption>', kachel, re.S)
    if not cap:
        return bild, None, None
    inhalt = cap.group(1)
    titel = re.search(r'<b>(.*?)</b>', inhalt, re.S)
    rest = re.sub(r'<b>.*?</b>', '', inhalt, flags=re.S).strip()
    return bild, (titel.group(1).strip() if titel else None), (rest or None)


def text_block(titel, rest, einzug):
    if not titel and not rest:
        return ""
    zeilen = [f'{einzug}<figcaption class="tour-blatt__text">']
    if titel:
        zeilen.append(f"{einzug}  <b>{titel}</b>")
    if rest:
        zeilen.append(f"{einzug}  <span>{rest}</span>")
    zeilen.append(f"{einzug}</figcaption>")
    return "\n".join(zeilen)


def sizes_setzen(bild, wert):
    """sizes muss zur neuen Breite passen, sonst laedt der Browser die
    falsche Aufloesung — im Streifen stand ueberall 46vw."""
    if 'sizes="' in bild:
        return re.sub(r'sizes="[^"]*"', f'sizes="{wert}"', bild, count=1)
    return bild


def laden_setzen(bild, erstes):
    """In einer senkrechten Strecke ist lazy wieder richtig: die Bilder
    stehen untereinander, der Browser holt sie beim Herankommen. Im
    Querstreifen ging das nicht, deshalb stand dort ueberall eager."""
    ziel = 'loading="eager"' if erstes else 'loading="lazy"'
    if 'loading="' in bild:
        return re.sub(r'loading="(?:eager|lazy)"', ziel, bild, count=1)
    return bild


def einfuegen_vor(text, pos, stueck):
    """Vor der ZEILE einfuegen, in der `pos` steht — nicht vor `pos` selbst.

    Sonst landet das Stueck hinter der schon vorhandenen Einrueckung, und
    die bleibt als Rest auf der Zeile davor haengen. Am 22.09.2026 hat das
    die Datei bei jedem Lauf veraendert; der Versuch, den Rest per lstrip
    zu saeubern, hat dafuer zwei Kommentarmarker zusammengeklebt.
    """
    zeilenanfang = text.rfind("\n", 0, pos) + 1
    einzug = text[zeilenanfang:pos]
    return (text[:zeilenanfang] + einzug + stueck.strip() + "\n\n"
            + text[zeilenanfang:])


def blatt(kacheln, art, einzug="        "):
    """Ein Blatt der Strecke: eine oder zwei Kacheln plus ihr Text."""
    innen = einzug + "  "
    teile = []
    for k in kacheln:
        bild, titel, rest = zerlegen(k)
        if art == "paar":
            # Eigener Traeger je Haelfte. Ohne ihn fliessen Bild und Text
            # als vier Rasterkinder in zwei ZEILEN statt zwei Spalten —
            # genau das ist am 22.09.2026 passiert.
            tief = innen + "  "
            block = [f'{innen}<div class="tour-blatt__halb">', tief + bild.strip()]
            t = text_block(titel, rest, tief)
            if t:
                block.append(t)
            block.append(innen + "</div>")
            teile.append("\n".join(block))
        else:
            teile.append(innen + bild.strip())
            teile.append(text_block(titel, rest, innen))
    inhalt = "\n".join(t for t in teile if t)
    return f'{einzug}<figure class="tour-blatt tour-blatt--{art}">\n{inhalt}\n{einzug}</figure>'


def anordnen(kacheln):
    """Reihenfolge → Liste von (art, [kacheln]).

    Querformate stehen fuer sich. Hochformate wechseln zwischen versetzt
    links, versetzt rechts und Paar — damit nicht dreimal dieselbe
    Anatomie hintereinander kommt.
    """
    plan = []
    seite = "links"
    i = 0
    while i < len(kacheln):
        k = kacheln[i]
        if verhaeltnis(k) >= QUER_AB:
            plan.append(("voll", [k]))
            i += 1
            continue
        # Zwei Hochformate in Folge → Paar, aber nie zwei Paare direkt
        # hintereinander: sonst ist das Paar die neue Monotonie.
        naechstes_hoch = i + 1 < len(kacheln) and verhaeltnis(kacheln[i + 1]) < QUER_AB
        letztes_war_paar = plan and plan[-1][0] == "paar"
        if naechstes_hoch and not letztes_war_paar:
            plan.append(("paar", [k, kacheln[i + 1]]))
            i += 2
            continue
        plan.append((seite, [k]))
        seite = "rechts" if seite == "links" else "links"
        i += 1
    return plan


def bauen(kacheln, titel):
    plan = anordnen(kacheln)
    erstes = True
    blaetter = []
    for art, gruppe in plan:
        breite = {"voll": "(max-width: 860px) 92vw, 88vw",
                  "paar": "(max-width: 860px) 46vw, 42vw"}.get(art, "(max-width: 860px) 92vw, 52vw")
        vorbereitet = []
        for k in gruppe:
            k = sizes_setzen(k, breite)
            k = laden_setzen(k, erstes)
            erstes = False
            vorbereitet.append(k)
        blaetter.append(blatt(vorbereitet, art))

    return f'''{ANFANG}
      <section class="tour-strecke" aria-label="Bilder von der Tour">
        <div class="tour-kopf tour-strecke__kopf">
          <span class="tour-kopf__label">Bilder<span class="hsep" aria-hidden="true"></span>{titel}</span>
        </div>
{chr(10).join(blaetter)}
      </section>
      {ENDE}'''


def kacheln_holen(html):
    """Kacheln aus einer schon gebauten Strecke oder aus dem Bento ziehen.

    Ein zweiter Lauf darf nichts verlieren: die Kacheln stehen dann in der
    Strecke, nicht mehr im Raster. Beide Marker werden gesucht, damit auch
    die Vorgaengerfassung (GALERIE) sauber abgeloest wird.
    """
    def neutral(k):
        """Marke und Raster-Spannweite abstreifen: die Kachel soll wieder
        eine gewoehnliche sein, bevor neu verteilt wird."""
        k = k.replace(f" {OBEN}", "")
        k = re.sub(r"\s*--span:\s*\d+;?", "", k)
        # Nach dem Entfernen bleibt Leerraum im style-Attribut stehen und
        # waechst bei jedem Lauf. Genauso die Einrueckung vor dem <figure>.
        k = re.sub(r'style="\s+', 'style="', k)
        k = re.sub(r'style="\s*"', "", k)
        return k.lstrip("\n").lstrip(" \t")

    for anf, end in ((ANFANG, ENDE), (ALT_ANFANG, ALT_ENDE)):
        if anf in html:
            block = re.search(r"[ \t]*\n?\s*" + re.escape(anf) + r".*?"
                              + re.escape(end) + r"[ \t]*\n?", html, re.S)
            if not block:
                raise ValueError(f"Marker {anf} ohne Gegenstueck — Seite von Hand pruefen")
            # ALLE Kacheln der Seite, auch die oben zwischen den Zahlen —
            # sonst verliert der zweite Lauf genau die.
            drin = KACHEL.findall(block.group(0))
            # Der Umbruch muss bleiben: das Muster schluckt beim Entfernen den
            # Zeilenumbruch hinter dem Endmarker, und ohne ihn klebt die
            # naechste Zeile (der KREUZE-Marker) an die vorherige.
            rest = html[:block.start()] + "\n" + html[block.end():]
            oben = [k for k in KACHEL.findall(rest) if OBEN in k]
            for k in oben:
                rest = rest.replace(k, "", 1)
            # Die Einrueckung der entfernten Kachel bleibt als Leerzeile mit
            # Leerzeichen stehen und waechst sonst bei jedem Lauf.
            rest = re.sub(r"\n[ \t]+\n", "\n\n", rest)
            # Reihenfolge wiederherstellen: die oben stehenden standen in der
            # Mitte und am Schluss (siehe oben_auswahl), nicht am Anfang.
            kacheln = [zurueckbauen(neutral(k)) for k in drin]
            for i, k in zip(oben_auswahl(len(drin) + len(oben)),
                            [zurueckbauen(neutral(x)) for x in oben]):
                kacheln.insert(min(i, len(kacheln)), k)
            if not kacheln:
                raise ValueError(f"Block {anf} gefunden, aber keine Kachel darin — "
                                 "Abbruch statt leerer Strecke")
            return kacheln, rest
    return KACHEL.findall(html), html


def eine_tour(slug):
    seite = WURZEL / "touren" / slug / "index.html"
    html = seite.read_text(encoding="utf-8")
    kacheln, html = kacheln_holen(html)
    # Profil auf volle Breite zuruecksetzen: ob ein Bild danebenkommt,
    # entscheidet dieser Lauf neu.
    html = re.sub(r'(<section class="tour-profil[^"]*"[^>]*style="--span:\s*)\d+',
                  r"\g<1>12", html)

    if not kacheln:
        print(f"  {slug}: keine Fotos — uebersprungen")
        return False

    for k in kacheln:
        html = html.replace(k, "", 1)

    # Die <h1> ist der Name der TOUR. Die Gipfelmarke im Hoehenprofil traegt
    # den hoechsten Punkt — bei der Hoerndlwand stand dadurch "Gurnwandkopf"
    # ueber der Bildstrecke, und bei der Kneifelspitze griff das alte Muster
    # gar nicht, weil dort eine weitere Klasse folgt.
    titel = re.search(r"<h1[^>]*>(.*?)</h1>", html, re.S)
    titel = re.sub(r"<[^>]+>", "", titel.group(1)).strip() if titel else slug.capitalize()

    anker = re.search(r'<!-- /WEGVERLAUF -->', html) or re.search(
        r'<section[^>]*class="[^"]*tour-profil[^"]*"', html)
    if not anker:
        print(f"  {slug}: kein Anker (weder Karte noch Profil) — nicht eingebaut")
        return False
    stelle = anker.end() if "WEGVERLAUF" in anker.group(0) else \
        html.find("</section>", anker.start()) + len("</section>")

    # Verteilen: erst nach oben, was zwischen die Zahlen gehoert.
    hoch = oben_auswahl(len(kacheln))
    genommen = [kacheln[i] for i in hoch]
    kacheln = [k for i, k in enumerate(kacheln) if i not in hoch]

    neu = html[:stelle] + "\n\n      " + (bauen(kacheln, titel) if kacheln else "") + html[stelle:]

    if genommen:
        # Das Profil lief ueber alle zwoelf Spalten; acht reichen, und
        # daneben passt genau eine Kachel.
        neu = re.sub(r'(<section class="tour-profil[^"]*"[^>]*style="--span:\s*)12',
                     r"\g<1>8", neu, count=1)
        anker = re.search(r'<section class="tour-profil', neu)
        if not anker:
            raise ValueError(f"{slug}: kein Hoehenprofil — wo soll das Bild hin?")
        neu = einfuegen_vor(neu, anker.start(), als_oben(genommen[0], 4))

    if len(genommen) > 1:
        # Die Karte belegt acht von zwoelf — die vier daneben standen leer.
        karte = re.search(r'<section class="tour-route', neu)
        if not karte:
            raise ValueError(f"{slug}: keine Karte — wo soll das zweite Bild hin?")
        neu = einfuegen_vor(neu, karte.start(), als_oben(genommen[1], 4))
    neu = re.sub(r"\n[ \t]+\n", "\n\n", neu)
    neu = re.sub(r"\n{3,}", "\n\n", neu)
    seite.write_text(neu, encoding="utf-8")

    plan = anordnen(kacheln)
    print(f"  {slug}: {len(genommen)} oben, {len(kacheln)} in der Strecke "
          f"({', '.join(a for a, _ in plan) or 'leer'})")
    return True


def selbsttest():
    """Zwei Fixtures: einer muss die Anatomie richtig treffen, einer darf
    beim zweiten Lauf nichts verlieren."""
    quer = ('<figure class="tour-shot"><img src="a.jpg" width="1400" height="1050" '
            'sizes="46vw" loading="eager"><figcaption><b>A</b>eins</figcaption></figure>')
    hoch = ('<figure class="tour-shot"><img src="b.jpg" width="1050" height="1400" '
            'sizes="46vw" loading="eager"><figcaption><b>B</b>zwei</figcaption></figure>')

    plan = [a for a, _ in anordnen([quer, hoch, hoch, hoch, hoch])]
    if plan != ["voll", "paar", "links", "rechts"]:
        print(f"✗ SELBSTTEST: Anatomie falsch verteilt — {plan}")
        return 1
    if [a for a, _ in anordnen([hoch, hoch, hoch, hoch])].count("paar") > 2:
        print("✗ SELBSTTEST: Paare haeufen sich — das ist die neue Monotonie")
        return 1

    paar = bauen([hoch, hoch], "Test")
    if paar.count('tour-blatt__halb') != 2:
        print("✗ SELBSTTEST: das Paar braucht je Haelfte einen Traeger, "
              "sonst steht es untereinander statt nebeneinander")
        return 1

    gebaut = bauen([quer, hoch, hoch], "Test")
    if "tour-blatt__text" not in gebaut or "<b>A</b>" not in gebaut:
        print("✗ SELBSTTEST: Bildunterschrift geht verloren")
        return 1
    if 'sizes="46vw"' in gebaut:
        print("✗ SELBSTTEST: sizes wurde nicht an die neue Breite angepasst")
        return 1
    if gebaut.count('loading="eager"') != 1:
        print("✗ SELBSTTEST: genau das erste Bild soll eager laden")
        return 1

    # Zweiter Lauf: Kacheln UND Text muessen zurueckkommen. Die Zahl allein
    # genuegt nicht — genau daran ist der Fehler vom 22.09.2026 vorbeigelaufen.
    zurueck, _ = kacheln_holen("<main>" + gebaut + "</main>")
    if len(zurueck) != 3:
        print(f"✗ SELBSTTEST: zweiter Lauf verliert Kacheln ({len(zurueck)} statt 3)")
        return 1
    zweiter = bauen(zurueck, "Test")
    if zweiter.count("tour-blatt__text") != gebaut.count("tour-blatt__text"):
        print("✗ SELBSTTEST: zweiter Lauf verliert Bildunterschriften")
        return 1
    if "<b>A</b>" not in zweiter or "eins" not in zweiter:
        print("✗ SELBSTTEST: Titel oder Unterzeile gehen im zweiten Lauf verloren")
        return 1
    dritter = bauen(kacheln_holen("<main>" + zweiter + "</main>")[0], "Test")
    if dritter != zweiter:
        print("✗ SELBSTTEST: dritter Lauf weicht vom zweiten ab — nicht stabil")
        return 1

    try:
        kacheln_holen(f"<main>{ANFANG}\n(nichts)\n{ENDE}</main>")
    except ValueError:
        pass
    else:
        print("✗ SELBSTTEST: leerer Block wird nicht als Abbruch erkannt")
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

    print("✓ Selbsttest: Anatomie trifft, Text bleibt, sizes/loading gesetzt, "
          "zweiter Lauf verliert nichts und ist byte-stabil, leerer Block bricht ab.")
    return 0


def main():
    if "--selbsttest" in sys.argv:
        return selbsttest()
    slugs = [a for a in sys.argv[1:] if not a.startswith("-")] or [
        p.name for p in sorted((WURZEL / "touren").iterdir())
        if (p / "index.html").exists()
    ]
    geaendert = sum(eine_tour(s) for s in slugs)
    print(f"\n{geaendert} von {len(slugs)} Seiten geaendert")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
