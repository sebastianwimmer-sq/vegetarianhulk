"""Termine aus freiem Text lesen – fuer den Weihnachtsmarkt-Radar.

Grundsatz: lieber keinen Termin als einen falschen. Alles, was nicht eindeutig
in die Saison passt, wird verworfen; mehrdeutige Seiten bleiben "offen".
"""
import html
import re
from datetime import date

MONATE = {
    'okt': 10, 'oktober': 10, 'oct': 10, 'october': 10,
    'nov': 11, 'november': 11,
    'dez': 12, 'dezember': 12, 'dec': 12, 'december': 12,
    'jan': 1, 'januar': 1, 'january': 1,
}
_MON = r'(januar|january|jan|oktober|october|okt|oct|november|nov|dezember|december|dez|dec)'
_BIS = r'(?:-|bis(?:\s+zum)?|/)'
_UND = r'(?:-|bis(?:\s+zum)?|und|\+|/)'

THEMA = re.compile(r'weihnacht|advent|christkind|nikolaus|winter|lichter|budenzauber|gl(?:ü|ue)hwein|markt|christmas', re.I)
KONTEXT_ZEICHEN = 300
# Zeitraeume, die auf einer Marktseite stehen, aber etwas anderes meinen (17.11.2026: Prien zeigte die Frist
# der Wunschzettelabgabe als Markttermin). Geprueft wird nur der Vorspann direkt vor dem Datum.
# Nur als Etikett mit Doppelpunkt direkt vor dem Datum („Wunschzettelabgabe: vom …“): das blosse Wort in der Naehe
# („jetzt mit einem Stand bewerben! Vom 27. bis 29. November“) nahm zwei echten Maerkten den Termin.
KEIN_MARKT = re.compile(r'(?:wunschzettel|abgabe|anmeld\w*|bewerb\w*|sternenkauf|einsendeschluss|vorverkauf|ticketverkauf|verlosung|gewinnspiel|frist)'
                        r'[^.!?:]{0,30}:\s*(?:vom\s+|ab\s+|von\s+)?$', re.I)
VORSPANN_ZEICHEN = 70
MAX_TAGE = 70
WOCHENEND_TAGE = 4
MAX_TEILE = 6


def saison(jahr):
    """Fenster, in dem ein Markttermin der Saison <jahr> liegen darf."""
    return date(jahr, 11, 5), date(jahr + 1, 1, 10)


def klartext(roh):
    """HTML → Text: Skripte und Stile raus, Tags zu Leerzeichen, Striche vereinheitlicht."""
    t = re.sub(r'(?is)<(script|style|noscript)\b.*?</\1>', ' ', roh)
    t = re.sub(r'(?s)<!--.*?-->', ' ', t)
    t = re.sub(r'<[^>]+>', ' ', t)
    t = html.unescape(t)
    t = re.sub(r'[‐-―−]', '-', t).replace(' ', ' ')
    return re.sub(r'\s+', ' ', t).strip()


def _jahr(s):
    j = int(s)
    return j + 2000 if j < 100 else j


def _tag(j, m, t):
    try:
        return date(int(j), int(m), int(t))
    except ValueError:
        return None


def _paar(tv, mv, jv, tb, mb, jb):
    """Baut (von, bis); fehlt das Startjahr, folgt es aus dem Endjahr."""
    jb = _jahr(jb)
    mb = int(mb)
    mv = int(mv) if mv else mb
    jv = _jahr(jv) if jv else (jb - 1 if mv > mb else jb)
    return _tag(jv, mv, tv), _tag(jb, mb, tb)


_REGELN = [
    # 2026-11-27/2026-12-23 · 2026-11-27 - 2026-12-24
    (re.compile(r'(20\d\d)-(\d\d)-(\d\d)\s*(?:/|-|bis)\s*(20\d\d)-(\d\d)-(\d\d)'),
     lambda g: (_tag(g[0], g[1], g[2]), _tag(g[3], g[4], g[5]))),
    # 2026 Nov 23 - 2026 Dec 24 · 2026 Nov 24 - 2026 -Dec 22
    (re.compile(r'(20\d\d)\s+' + _MON + r'\.?\s+(\d{1,2})\s*-\s*(20\d\d)\s+-?\s*' + _MON + r'\.?\s+(\d{1,2})', re.I),
     lambda g: (_tag(g[0], MONATE[g[1].lower()], g[2]), _tag(g[3], MONATE[g[4].lower()], g[5]))),
    # 2026 Dec 05-06
    (re.compile(r'(20\d\d)\s+' + _MON + r'\.?\s+(\d{1,2})\s*-\s*(\d{1,2})(?!\d|\s*[.:]\d)', re.I),
     lambda g: (_tag(g[0], MONATE[g[1].lower()], g[2]), _tag(g[0], MONATE[g[1].lower()], g[3]))),
    # 27.11.2026 - 23.12.2026 · 23.11. - 27.12.2026 · 21.11.26 - 22.12.2026
    (re.compile(r'(?<![\d.])(\d{1,2})\.\s?(\d{1,2})\.\s?(20\d\d|\d\d)?\s*' + _BIS + r'\s*(\d{1,2})\.\s?(\d{1,2})\.\s?(20\d\d)(?!\d)', re.I),
     lambda g: _paar(g[0], g[1], g[2], g[3], g[4], g[5])),
    # 04.-06.12.2026 · 5. und 6.12.2026
    (re.compile(r'(?<![\d.])(\d{1,2})\.\s?' + _UND + r'\s*(\d{1,2})\.\s?(\d{1,2})\.\s?(20\d\d)(?!\d)', re.I),
     lambda g: _paar(g[0], None, None, g[1], g[2], g[3])),
    # 27. November bis 23. Dezember 2026 · 5. bis 7. Dezember 2026 · 5.-7. Dezember 2026
    (re.compile(r'(?<![\d.])(\d{1,2})\.\s?(?:' + _MON + r'\.?)?\s*(20\d\d)?\s*' + _UND + r'\s*(\d{1,2})\.\s?' + _MON + r'\.?\s*(20\d\d)(?!\d)', re.I),
     lambda g: _paar(g[0], MONATE[g[1].lower()] if g[1] else None, g[2], g[3], MONATE[g[4].lower()], g[5])),
]
_EINZEL = [
    (re.compile(r'(20\d\d)-(\d\d)-(\d\d)'), lambda g: _tag(g[0], g[1], g[2])),
    (re.compile(r'(?<![\d.])(\d{1,2})\.\s?(\d{1,2})\.\s?(20\d\d)(?!\d)'), lambda g: _tag(g[2], g[1], g[0])),
    (re.compile(r'(?<![\d.])(\d{1,2})\.\s?' + _MON + r'\.?\s*(20\d\d)(?!\d)', re.I),
     lambda g: _tag(g[2], MONATE[g[1].lower()], g[0])),
]


def _gueltig(von, bis, jahr):
    if not von or not bis or von > bis:
        return False
    auf, zu = saison(jahr)
    return auf <= von and bis <= zu and (bis - von).days <= MAX_TAGE


def funde(text, jahr, nur_im_thema=True):
    """Alle Zeitraeume und Einzeltage der Saison im Text.

    Liefert (bereiche, einzeltage); je Fund (von, bis, Ausschnitt).
    """
    bereiche, einzel, rest = [], [], text
    for muster, bau in _REGELN + _EINZEL:
        ist_einzel = (muster, bau) in _EINZEL
        for m in list(muster.finditer(rest)):
            wert = bau(m.groups())
            von, bis = (wert, wert) if ist_einzel else wert
            a, b = max(0, m.start() - KONTEXT_ZEICHEN), min(len(text), m.end() + KONTEXT_ZEICHEN)
            fremd = nur_im_thema and KEIN_MARKT.search(text[max(0, m.start() - VORSPANN_ZEICHEN):m.start()])
            if _gueltig(von, bis, jahr) and not fremd and (not nur_im_thema or THEMA.search(text[a:b])):
                ausschnitt = text[max(0, m.start() - 60):m.end() + 40].strip()
                (einzel if ist_einzel else bereiche).append((von, bis, ausschnitt))
            # Fundstelle schwaerzen, damit ein Einzeltag nicht aus einem Zeitraum gelesen wird
            rest = rest[:m.start()] + ' ' * (m.end() - m.start()) + rest[m.end():]
    return bereiche, einzel


def entscheide(bereiche):
    """Aus allen gefundenen Zeitraeumen den Termin ableiten.

    Rueckgabe (termine, grund). termine ist [] wenn die Seite mehrdeutig ist.
    """
    einmalig = sorted({(v, b) for v, b, _ in bereiche})
    if not einmalig:
        return [], 'kein Zeitraum'
    gross = max(einmalig, key=lambda r: (r[1] - r[0]).days)
    if all(gross[0] <= v and b <= gross[1] for v, b in einmalig):
        return [gross], 'ein Zeitraum'
    kurz = all((b - v).days < WOCHENEND_TAGE for v, b in einmalig)
    getrennt = all(einmalig[i][1] < einmalig[i + 1][0] for i in range(len(einmalig) - 1))
    if kurz and getrennt and len(einmalig) <= MAX_TEILE:
        return einmalig, 'mehrere Wochenenden'
    return [], 'mehrdeutig'


def aus_feld(wert, jahr):
    """Datumsfeld einer Datenquelle (kein Fliesstext): Einzeltage zaehlen mit."""
    bereiche, einzel = funde(klartext(wert), jahr, nur_im_thema=False)
    return entscheide(bereiche + einzel)


_WOCHENTAG = re.compile(r'\b(?:Montag|Dienstag|Mittwoch|Donnerstag|Freitag|Samstag|Sonntag|Mo|Di|Mi|Do|Fr|Sa|So)\b\.?,?\s+(?=\d{1,2}\s?\.)')
_PUNKT_LOSE = re.compile(r'(?<!\d)(\d{1,2})\s\.(?=\s?[A-Za-zÄÖÜ])')
_ZWEI = r'\s*(?:&|und|sowie)\s*(?:vom\s+)?'
_TEIL = r'\d{1,2}\.\s?(?:-|bis)\s?\d{1,2}\.\s?'
_ERBE_ZAHL = re.compile(r'(?<![\d.])(' + _TEIL + r'\d{1,2})\.?(' + _ZWEI + _TEIL + r'\d{1,2}\.\s?(20\d\d))', re.I)
_ERBE_WORT = re.compile(r'(?<![\d.])(' + _TEIL + _MON + r')\.?(' + _ZWEI + _TEIL + _MON + r'\.?\s*(20\d\d))', re.I)


def glatt(text):
    """Schreibweisen von Veranstalterseiten vereinheitlichen, ohne ein Datum zu erfinden:
    Wochentage vor dem Tag fallen weg („Fr., 04.12. - So., 06.12.2026“), „20 .November“ wird
    „20. November“, und bei „26. - 29.11 & 03. - 06.12.2026“ erbt das erste Wochenende das Jahr
    des zweiten. Ein so gewonnener Zeitraum muss danach wie jeder andere in die Saison passen."""
    t = _WOCHENTAG.sub('', text)
    t = _PUNKT_LOSE.sub(r'\1. ', t)
    def jahr_davor(monat_erst, monat_zweit, jahr):      # Dezember & Januar 2027: das erste Wochenende liegt im Vorjahr
        return int(jahr) - 1 if monat_erst > monat_zweit else int(jahr)

    def zahl(m):
        erst = int(re.search(r'(\d{1,2})$', m.group(1)).group(1))
        zweit = int(re.search(r'(\d{1,2})\.\s?20\d\d$', m.group(2)).group(1))
        return f'{m.group(1)}.{jahr_davor(erst, zweit, m.group(3))}{m.group(2)}'

    def wort(m):
        return f'{m.group(1)} {jahr_davor(MONATE[m.group(2).lower()], MONATE[m.group(4).lower()], m.group(5))}{m.group(3)}'

    return _ERBE_WORT.sub(wort, _ERBE_ZAHL.sub(zahl, t))


def aus_seite(roh, jahr):
    """Veranstalterseite: nur Zeitraeume im Themen-Umfeld, Einzeltage zaehlen nicht."""
    bereiche, einzel = funde(glatt(klartext(roh)), jahr)
    termine, grund = entscheide(bereiche)
    if not termine and not bereiche and einzel:
        grund = 'nur Einzeltage'
    beleg = next((a for v, b, a in bereiche if termine and (v, b) == termine[0]), '')
    return termine, grund, beleg
