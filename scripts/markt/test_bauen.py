"""Tests für bauen.py: ein gelesener Termin überlebt einen Abruf-Fehler, aber nicht ewig."""
import unittest
from datetime import date
from unittest import mock

import bauen

ALT = {'quelle': 'veranstalter', 'link': 'https://www.beispiel.de/markt', 'geprueft': '2026-11-17',
       'termine': [['2026-11-27', '2026-12-20']], 'status': 'bestaetigt'}


def markt(link='https://www.beispiel.de/markt'):
    return {'id': 'hand-x', 'name': 'Markt', 'termine': [], 'link': link, 'quelle': '', 'quelle_url': '', 'beleg': ''}


class Merken(unittest.TestCase):
    def test_gemerkt_liest_nur_frische_veranstaltertermine(self):
        self.assertIn(ALT['link'], bauen.gemerkt([ALT], '2026-11-24'))
        self.assertEqual(bauen.gemerkt([ALT], '2026-12-20'), {})                       # älter als MERKEN_TAGE
        self.assertEqual(bauen.gemerkt([{**ALT, 'quelle': 'dzt'}], '2026-11-24'), {})   # nur selbst Gelesenes

    def test_abruf_fehler_behaelt_termin_mit_altem_pruefdatum(self):
        m = markt()
        with mock.patch.object(bauen, 'hole', return_value=('000', '')):
            bauen.termine_von_seiten([m], False, bauen.gemerkt([ALT], '2026-11-24'))
        self.assertEqual(m['termine'], [(date(2026, 11, 27), date(2026, 12, 20))])
        self.assertEqual(m['geprueft_alt'], '2026-11-17')
        self.assertNotIn('link_tot', m)

    def test_abruf_fehler_ohne_gemerkten_termin_bleibt_offen(self):
        m = markt()
        with mock.patch.object(bauen, 'hole', return_value=('000', '')):
            bauen.termine_von_seiten([m], False, {})
        self.assertEqual(m['termine'], [])
        self.assertTrue(m['link_tot'])

    def test_seite_antwortet_ohne_termin_dann_gilt_das_neue(self):
        m = markt()
        with mock.patch.object(bauen, 'hole', return_value=('200', '<p>Unser Weihnachtsmarkt fällt dieses Jahr aus.</p>')):
            bauen.termine_von_seiten([m], False, bauen.gemerkt([ALT], '2026-11-24'))
        self.assertEqual(m['termine'], [])

    def test_seite_antwortet_mit_neuem_termin(self):
        m = markt()
        with mock.patch.object(bauen, 'hole', return_value=('200', '<p>Weihnachtsmarkt vom 4. bis 6. Dezember 2026</p>')):
            bauen.termine_von_seiten([m], False, bauen.gemerkt([ALT], '2026-11-24'))
        self.assertEqual(m['termine'], [(date(2026, 12, 4), date(2026, 12, 6))])
        self.assertNotIn('geprueft_alt', m)


if __name__ == '__main__':
    unittest.main()
