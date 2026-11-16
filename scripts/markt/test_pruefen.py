"""Das Tor an der Schwelle: der saubere Fall gruen, je eine getauschte Zeile rot – mit dem behaupteten Grund."""
import json
import tempfile
import unittest
from pathlib import Path

import pruefen


def markt(nr, **anders):
    m = {'id': f'osm-n{nr}', 'name': 'Christkindlmarkt', 'ort': 'Musterstadt', 'lat': 48.1, 'lon': 11.5,
         'status': 'bestaetigt', 'termine': [['2026-11-27', '2026-12-23']], 'zeiten': '', 'link': '',
         'quelle': 'veranstalter', 'quelle_url': 'https://beispiel.example/markt', 'geprueft': '2026-11-16'}
    m.update(anders)
    return m


def ablage(maerkte, plz_zahl=pruefen.MIN_PLZ, stand=None):
    ordner = Path(tempfile.mkdtemp())
    bestaetigt = sum(1 for m in maerkte if m['status'] == 'bestaetigt')
    stand = stand or {'jahr': 2026, 'gebaut': '2026-11-16', 'maerkte': len(maerkte), 'bestaetigt': bestaetigt,
                      'plz': plz_zahl, 'vermerke': [{'vermerk': '© OpenStreetMap-Mitwirkende'}]}
    (ordner / 'maerkte.json').write_text(json.dumps(maerkte), encoding='utf-8')
    (ordner / 'plz.json').write_text(json.dumps({f'{i:05d}': [48, 11, ''] for i in range(plz_zahl)}), encoding='utf-8')
    (ordner / 'stand.json').write_text(json.dumps(stand, ensure_ascii=False), encoding='utf-8')
    return ordner


def sauber(n=pruefen.MIN_MAERKTE):
    return [markt(i) for i in range(n)]


class Tor(unittest.TestCase):
    def rot(self, maerkte, grund, **mehr):
        liste = pruefen.befunde(ablage(maerkte, **mehr))
        self.assertTrue(any(grund in z for z in liste), f'erwartet {grund!r}, bekam {liste[:3]}')

    def test_sauber_ist_gruen(self):
        self.assertEqual(pruefen.befunde(ablage(sauber())), [])

    def test_bestaetigt_ohne_quelle(self):
        self.rot(sauber()[:-1] + [markt(999, quelle_url='')], 'ohne belegte Quelle')

    def test_tourismus_eintrag_braucht_offene_lizenz(self):
        frei = markt(998, quelle='dzt', lizenz='https://creativecommons.org/licenses/by/4.0/', vermerk='CC BY 4.0 TI Musterstadt')
        self.assertEqual(pruefen.befunde(ablage(sauber()[:-1] + [frei])), [])
        self.rot(sauber()[:-1] + [dict(frei, lizenz='https://creativecommons.org/licenses/by-nc/4.0/')], 'ohne offene Lizenz')
        self.rot(sauber()[:-1] + [dict(frei, vermerk='')], 'ohne offene Lizenz')

    def test_termin_aus_dem_vorjahr(self):
        self.rot(sauber()[:-1] + [markt(999, termine=[['2025-11-27', '2025-12-23']])], 'außerhalb der Saison')

    def test_ende_vor_anfang(self):
        self.rot(sauber()[:-1] + [markt(999, termine=[['2026-12-23', '2026-11-27']])], 'außerhalb der Saison')

    def test_offen_zeigt_keinen_termin(self):
        self.rot(sauber()[:-1] + [markt(999, status='offen')], 'offen, zeigt aber')

    def test_koordinate_ausserhalb(self):
        self.rot(sauber()[:-1] + [markt(999, lat=40.4)], 'außerhalb Deutschlands')

    def test_ort_leer(self):
        self.rot(sauber()[:-1] + [markt(999, ort='')], 'Pflichtfeld leer: ort')

    def test_doppelte_kennung(self):
        self.rot(sauber()[:-1] + [markt(0)], 'doppelte Kennungen')

    def test_ein_markt_zu_wenig_ist_nicht_gemessen(self):
        self.rot(sauber(pruefen.MIN_MAERKTE - 1), 'nicht gemessen: nur')

    def test_plz_zu_wenig(self):
        self.rot(sauber(), 'Postleitzahlen', plz_zahl=pruefen.MIN_PLZ - 1)

    def test_vermerk_fehlt(self):
        n = pruefen.MIN_MAERKTE
        self.rot(sauber(), 'Pflicht-Vermerk', stand={'jahr': 2026, 'gebaut': 'x', 'maerkte': n, 'bestaetigt': n, 'plz': 8000})

    def test_leerer_ordner_ist_nicht_gemessen(self):
        liste = pruefen.befunde(Path(tempfile.mkdtemp()))
        self.assertIn('nicht gemessen', liste[0])


if __name__ == '__main__':
    unittest.main()
