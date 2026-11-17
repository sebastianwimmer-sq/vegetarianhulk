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



class Programmpunkte(unittest.TestCase):
    def m(self, kennung, name, von, bis, lat=48.5745, lon=13.4644):
        return {'id': kennung, 'name': name, 'lat': lat, 'lon': lon, 'termine': [(date.fromisoformat(von), date.fromisoformat(bis))]}

    def setUp(self):
        self.markt = self.m('hand-passau', 'Passauer Christkindlmarkt am Dom', '2026-11-24', '2026-12-22')

    def test_programmpunkt_am_markt_faellt_weg(self):
        punkt = self.m('dzt-1', 'Passauer Christkindlmarkt - Leo Big Band', '2026-11-27', '2026-11-27')
        bleiben, weg = bauen.ohne_programmpunkte([self.markt, punkt])
        self.assertEqual([m['id'] for m in bleiben], ['hand-passau'])
        self.assertEqual(weg, ['Passauer Christkindlmarkt - Leo Big Band'])

    def test_auf_dem_markt_zaehlt_als_zusatz(self):
        gross = self.m('dzt-9', 'Borkener Weihnachtsmarkt', '2026-11-27', '2026-11-29')
        punkt = self.m('dzt-2', 'Small Band auf dem Weihnachtsmarkt Borken', '2026-11-28', '2026-11-28')
        self.assertEqual([m['id'] for m in bauen.ohne_programmpunkte([gross, punkt])[0]], ['dzt-9'])

    def test_eigener_markt_mit_zusatz_aber_fremdem_namen_bleibt(self):
        gross = self.m('dzt-9', 'Rheiner Weihnachtsmarkt', '2026-11-27', '2026-12-23')
        tierheim = self.m('dzt-7', 'Weihnachtsmarkt - Tierheim Rote Erde', '2026-12-13', '2026-12-13')
        self.assertEqual(len(bauen.ohne_programmpunkte([gross, tierheim])[0]), 2)

    def test_von_hand_gepflegter_markt_geht_nicht_im_programmpunkt_auf(self):
        punkt = {**self.m('dzt-1', 'Passauer Christkindlmarkt - Leo Big Band', '2026-11-27', '2026-11-27'), 'link': '', 'quelle': 'dzt'}
        hand = {'id': 'hand-passau', 'name': 'Passauer Christkindlmarkt am Dom', 'lat': 48.5745, 'lon': 13.4644, 'termine': [], 'link': 'https://x.de', 'quelle': ''}
        zusammen = bauen.zusammenfuehren([[punkt], [hand]])
        self.assertEqual(sorted(m['id'] for m in zusammen), ['dzt-1', 'hand-passau'])

    def test_kleiner_eigener_markt_neben_dem_grossen_bleibt(self):
        klein = self.m('dzt-3', 'Adventsmarkt der Kirchengemeinde', '2026-11-28', '2026-11-28')
        self.assertEqual(len(bauen.ohne_programmpunkte([self.markt, klein])[0]), 2)

    def test_zusatz_ohne_markt_in_der_naehe_bleibt(self):
        allein = self.m('dzt-4', 'Heiliger Bimbam - Der KreativWeihnachtsmarkt', '2026-11-28', '2026-11-28', lat=52.17, lon=9.25)
        self.assertEqual(len(bauen.ohne_programmpunkte([self.markt, allein])[0]), 2)

    def test_tag_ausserhalb_der_laufzeit_bleibt(self):
        davor = self.m('dzt-5', 'Passauer Christkindlmarkt - Aufbaufest', '2026-11-20', '2026-11-20')
        self.assertEqual(len(bauen.ohne_programmpunkte([self.markt, davor])[0]), 2)

    def test_mehrtaegiger_eintrag_mit_zusatz_bleibt(self):
        zwei = self.m('dzt-6', 'Thermenzauber - Weihnachtsmarkt am Kurplatz', '2026-12-04', '2026-12-06')
        self.assertEqual(len(bauen.ohne_programmpunkte([self.markt, zwei])[0]), 2)


if __name__ == '__main__':
    unittest.main()
