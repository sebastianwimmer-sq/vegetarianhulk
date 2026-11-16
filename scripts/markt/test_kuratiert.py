"""Tests für die von Hand gepflegten Märkte: Regeln der Datei und Aufnehmen neuer Kandidaten."""
import unittest

import kuratiert

GUT = {'id': 'hand-rosenheim-rosenheimer-christkindlmarkt', 'name': 'Rosenheimer Christkindlmarkt', 'ort': 'Rosenheim',
       'platz': 'Max-Josefs-Platz', 'link': 'https://www.beispiel-stadt.de/christkindlmarkt', 'lat': 47.85637, 'lon': 12.12247}


class Regeln(unittest.TestCase):
    def test_sauberer_eintrag_hat_keinen_befund(self):
        self.assertEqual(kuratiert.befunde([GUT]), [])

    def test_ausgelieferte_datei_ist_sauber(self):
        self.assertEqual(kuratiert.befunde(kuratiert.lade()), [])

    def test_termin_in_der_datei_ist_ein_befund(self):
        rot = kuratiert.befunde([{**GUT, 'termine': [['2026-11-27', '2026-12-24']]}])
        self.assertTrue(any('Termine gehören nicht' in b for b in rot), rot)

    def test_sammelportal_ist_ein_befund(self):
        rot = kuratiert.befunde([{**GUT, 'link': 'https://www.festivalsindeutschland.de/festival/x'}])
        self.assertTrue(any('Sammelportal' in b for b in rot), rot)

    def test_http_ohne_s_ist_ein_befund(self):
        rot = kuratiert.befunde([{**GUT, 'link': 'http://www.beispiel-stadt.de/'}])
        self.assertTrue(any('https' in b for b in rot), rot)

    def test_koordinate_null_ist_ein_befund(self):
        rot = kuratiert.befunde([{**GUT, 'lat': 0.0, 'lon': 0.0}])
        self.assertTrue(any('nicht in Deutschland' in b for b in rot), rot)

    def test_doppelte_kennung_und_doppelte_adresse(self):
        rot = kuratiert.befunde([GUT, dict(GUT)])
        self.assertTrue(any('Kennung doppelt' in b for b in rot) and any('Adresse steht doppelt' in b for b in rot), rot)


class Aufnehmen(unittest.TestCase):
    def setUp(self):
        self.abrufe = []

    def hole(self, url):
        self.abrufe.append(url)
        return '200', '[{"lat": "48.88021", "lon": "12.57385"}]'

    def test_bekannter_markt_uebernimmt_die_koordinate_aus_dem_bestand(self):
        bestand = [{'name': 'Landshuter Christkindlmarkt', 'ort': 'Landshut', 'lat': 48.53712, 'lon': 12.15203}]
        liste, _ = kuratiert.aufnehmen([{'name': 'Landshuter Christkindlmarkt', 'ort': 'Landshut', 'link': 'https://www.beispiel.de/markt'}],
                                       [], bestand, self.hole)
        self.assertEqual((liste[0]['lat'], liste[0]['lon']), (48.53712, 12.15203))
        self.assertEqual(self.abrufe, [])

    def test_neuer_markt_wird_einmal_nachgeschlagen(self):
        kuratiert.PAUSE_S = 0
        liste, _ = kuratiert.aufnehmen([{'name': 'Straubinger Christkindlmarkt', 'ort': 'Straubing', 'link': 'https://www.beispiel.de/s'}],
                                       [], [], self.hole)
        self.assertEqual(liste[0]['id'], 'hand-straubing-straubinger-christkindlmarkt')
        self.assertEqual((liste[0]['lat'], liste[0]['lon']), (48.88021, 12.57385))
        self.assertEqual(len(self.abrufe), 1)

    def test_schon_vorhandener_eintrag_wird_nicht_verdoppelt_und_alt_bleibt_unveraendert(self):
        alt = [dict(GUT)]
        liste, meldungen = kuratiert.aufnehmen([{'name': GUT['name'], 'ort': GUT['ort'], 'link': 'https://www.beispiel.de/neu'}], alt, [], self.hole)
        self.assertEqual(len(liste), 1)
        self.assertEqual(alt, [GUT])
        self.assertTrue(any('schon da' in m for m in meldungen))

    def test_kandidat_ohne_adresse_wird_uebersprungen(self):
        liste, meldungen = kuratiert.aufnehmen([{'name': 'Markt', 'ort': 'Regen', 'link': ''}], [], [], self.hole)
        self.assertEqual(liste, [])
        self.assertTrue(meldungen)


if __name__ == '__main__':
    unittest.main()
