"""Regierungsbezirk aus dem Landkreis (Bayern). Nominatim nennt den Bezirk oft nicht; dann stand
der Markt unter „unbekannt“ und Oberbayern/Niederbayern wirkten dünner, als sie sind (17.11.2026)."""
import re

_GENAU = {
    'Oberbayern': 'münchen ingolstadt rosenheim altötting dachau ebersberg eichstätt erding freising fürstenfeldbruck miesbach starnberg traunstein',
    'Niederbayern': 'landshut passau straubing deggendorf kelheim regen',
    'Oberpfalz': 'amberg regensburg cham schwandorf tirschenreuth',
    'Oberfranken': 'bamberg bayreuth coburg hof forchheim kronach kulmbach lichtenfels',
    'Mittelfranken': 'ansbach erlangen fürth nürnberg schwabach roth',
    'Unterfranken': 'aschaffenburg schweinfurt würzburg kitzingen miltenberg haßberge',
    'Schwaben': 'augsburg kaufbeuren memmingen günzburg oberallgäu ostallgäu unterallgäu',
}
_TEIL = {
    'Oberbayern': ('tölz', 'berchtesgaden', 'garmisch', 'landsberg', 'mühldorf', 'neuburg-schrobenhausen', 'pfaffenhofen', 'weilheim'),
    'Niederbayern': ('dingolfing', 'freyung', 'rottal', 'straubing-bogen'),
    'Oberpfalz': ('weiden', 'amberg-sulzbach', 'neumarkt', 'waldnaab'),
    'Oberfranken': ('wunsiedel',),
    'Mittelfranken': ('erlangen-höchstadt', 'aisch', 'nürnberger land', 'weißenburg'),
    'Unterfranken': ('kissingen', 'main-spessart', 'rhön'),
    'Schwaben': ('kempten', 'aichach', 'dillingen', 'donau-ries', 'lindau', 'neu-ulm'),
}


def von_kreis(kreis):
    """'' wenn der Kreis nicht eindeutig zu einem bayerischen Regierungsbezirk gehört."""
    k = re.sub(r'^(landkreis|kreisfreie stadt)\s+', '', (kreis or '').strip().lower())
    if not k:
        return ''
    for bezirk, teile in _TEIL.items():
        if any(t in k for t in teile):
            return bezirk
    kopf = re.split(r'[\s(,]', k)[0]
    return next((b for b, namen in _GENAU.items() if kopf in namen.split()), '')
