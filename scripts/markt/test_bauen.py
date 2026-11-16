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



class Auftakt(unittest.TestCase):
    def m(self, kennung, name, land, von, bis, **mehr):
        return {'id': kennung, 'name': name, 'ort': 'Ort', 'land': land, 'lat': 48.0, 'lon': 12.0, 'status': 'bestaetigt',
                'termine': [[von, bis]], **mehr}

    def test_nur_suedosten_bestaetigt_und_bald(self):
        raus = [self.m('dzt-1', 'Bald', 'Bayern', '2026-11-27', '2026-12-20'),
                self.m('dzt-2', 'Norden', 'Hamburg', '2026-11-27', '2026-12-20'),
                self.m('dzt-3', 'Zu spät', 'Bayern', '2026-12-18', '2026-12-20'),
                self.m('dzt-4', 'Vorbei', 'Bayern', '2026-11-13', '2026-11-15'),
                {**self.m('osm-5', 'Offen', 'Salzburg', '2026-11-27', '2026-12-20'), 'status': 'offen'},
                self.m('dzt-6', 'Läuft schon', 'Oberösterreich', '2026-11-13', '2026-12-24')]
        self.assertEqual([m['name'] for m in bauen.auftakt(raus, '2026-11-17')], ['Läuft schon', 'Bald'])

    def test_von_hand_gepflegte_stehen_bei_gleichem_start_vorn(self):
        raus = [self.m('dzt-1', 'Aus der Datenbank', 'Bayern', '2026-11-27', '2026-12-20'),
                self.m('hand-x', 'Vom Veranstalter', 'Bayern', '2026-11-27', '2026-12-20')]
        self.assertEqual([m['name'] for m in bauen.auftakt(raus, '2026-11-17')], ['Vom Veranstalter', 'Aus der Datenbank'])

    def test_liste_traegt_nur_was_die_seite_braucht(self):
        eintrag = bauen.auftakt([self.m('hand-x', 'Markt', 'Bayern', '2026-11-27', '2026-12-20', link='https://x.de', vermerk='v')], '2026-11-17')[0]
        self.assertEqual(sorted(eintrag), ['lat', 'lon', 'name', 'ort', 'termine'])


if __name__ == '__main__':
    unittest.main()
