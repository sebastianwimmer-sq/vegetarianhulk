"""Tests fuer datum.py:  python3 -m unittest discover -s scripts/markt -p 'test_*.py'"""
import unittest
from datetime import date

from datum import aus_feld, aus_seite, klartext

J = 2026


def d(m, t, j=J):
    return date(j, m, t)


class FeldFormate(unittest.TestCase):
    """Jede Schreibweise, die am 16.11.2026 in OpenStreetMap vorkam."""

    FAELLE = {
        '23.11.-23.12.2026': [(d(11, 23), d(12, 23))],
        '2026-11-20/2026-12-23': [(d(11, 20), d(12, 23))],
        '2026 Nov 23 - 2026 Dec 24': [(d(11, 23), d(12, 24))],
        '2026-11-27 - 2026-12-24': [(d(11, 27), d(12, 24))],
        '24.11.2026-06.01.2027': [(d(11, 24), d(1, 6, 2027))],
        '04.-06.12.2026': [(d(12, 4), d(12, 6))],
        '21.11.26 - 22.12.2026': [(d(11, 21), d(12, 22))],
        '2026 Dec 05-06;2026 Dec 11-13': [(d(12, 5), d(12, 6)), (d(12, 11), d(12, 13))],
        '2026 Nov 24 - 2026 -Dec 22': [(d(11, 24), d(12, 22))],
        '2026-11-28': [(d(11, 28), d(11, 28))],
        '28.11.2026': [(d(11, 28), d(11, 28))],
        '2026-11-27/2026-11-29; 2026-12-04/2026-12-04': [(d(11, 27), d(11, 29)), (d(12, 4), d(12, 4))],
    }

    def test_formate(self):
        for wert, soll in self.FAELLE.items():
            with self.subTest(wert=wert):
                self.assertEqual(aus_feld(wert, J)[0], soll)

    def test_altes_jahr_zaehlt_nicht(self):
        self.assertEqual(aus_feld('27.11.2018 - 23.12.2018', J)[0], [])
        self.assertEqual(aus_feld('2025-11-24/2026-01-04', J)[0], [])

    def test_ende_vor_anfang_zaehlt_nicht(self):
        self.assertEqual(aus_feld('2026-12-16/2026-12-13', J)[0], [])


class Seiten(unittest.TestCase):
    def test_ausgeschrieben(self):
        seite = '<h1>Christkindlmarkt</h1><p>Vom 27. November bis 23. Dezember 2026 auf dem Hauptplatz.</p>'
        termine, grund, beleg = aus_seite(seite, J)
        self.assertEqual(termine, [(d(11, 27), d(12, 23))])
        self.assertIn('27. November', beleg)

    def test_tage_im_selben_monat(self):
        termine, _, _ = aus_seite('Adventsmarkt am 5. und 6. Dezember 2026', J)
        self.assertEqual(termine, [(d(12, 5), d(12, 6))])

    def test_gesamtzeitraum_schluckt_teile(self):
        seite = 'Weihnachtsmarkt 23.11. - 23.12.2026. Kindertag beim Weihnachtsmarkt: 05.12. - 06.12.2026'
        self.assertEqual(aus_seite(seite, J)[0], [(d(11, 23), d(12, 23))])

    def test_zwei_lange_zeitraeume_sind_mehrdeutig(self):
        seite = 'Weihnachtsmarkt 23.11. - 10.12.2026 und Wintermarkt 05.12. - 30.12.2026'
        termine, grund, _ = aus_seite(seite, J)
        self.assertEqual((termine, grund), ([], 'mehrdeutig'))

    def test_einzeltag_allein_reicht_nicht(self):
        termine, grund, _ = aus_seite('Weihnachtsmarkt. Stand der Seite: 30.11.2026', J)
        self.assertEqual((termine, grund), ([], 'nur Einzeltage'))

    def test_zeitraum_ohne_thema_zaehlt_nicht(self):
        fuell = ' Lorem ipsum dolor sit amet consetetur sadipscing elitr.' * 12
        seite = 'Weihnachten' + fuell + 'Betriebsferien 01.12. - 20.12.2026' + fuell
        self.assertEqual(aus_seite(seite, J)[0], [])

    def test_skript_wird_nicht_gelesen(self):
        seite = '<script>var x="Weihnachtsmarkt 23.11. - 23.12.2026"</script><p>Weihnachtsmarkt</p>'
        self.assertEqual(aus_seite(seite, J)[0], [])

    def test_klartext_vereinheitlicht_striche(self):
        self.assertEqual(klartext('23.11.&nbsp;–&nbsp;23.12.'), '23.11. - 23.12.')


if __name__ == '__main__':
    unittest.main()
