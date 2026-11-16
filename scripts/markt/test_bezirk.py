import unittest

from bezirk import von_kreis


class Bezirk(unittest.TestCase):
    FAELLE = {
        'Landkreis Rosenheim': 'Oberbayern', 'München': 'Oberbayern', 'Landkreis München': 'Oberbayern', 'Mühldorf a.Inn': 'Oberbayern',
        'Landkreis Pfaffenhofen an der Ilm': 'Oberbayern', 'Landkreis Bad Tölz-Wolfratshausen': 'Oberbayern',
        'Landkreis Straubing-Bogen': 'Niederbayern', 'Straubing': 'Niederbayern', 'Landkreis Regen': 'Niederbayern', 'Landkreis Rottal-Inn': 'Niederbayern',
        'Regensburg': 'Oberpfalz', 'Landkreis Neustadt an der Waldnaab': 'Oberpfalz', 'Neumarkt i.d.OPf.': 'Oberpfalz',
        'Landkreis Hof': 'Oberfranken', 'Landkreis Fürth': 'Mittelfranken', 'Landkreis Erlangen-Höchstadt': 'Mittelfranken',
        'Landkreis Neustadt an der Aisch-Bad Windsheim': 'Mittelfranken', 'Landkreis Bad Kissingen': 'Unterfranken',
        'Landkreis Aichach-Friedberg': 'Schwaben', 'Landkreis Neu-Ulm': 'Schwaben', 'Landkreis Augsburg': 'Schwaben',
    }

    def test_kreise(self):
        for kreis, soll in self.FAELLE.items():
            with self.subTest(kreis=kreis):
                self.assertEqual(von_kreis(kreis), soll)

    def test_unbekannt_bleibt_leer(self):
        for kreis in ('', None, 'Stendal', 'Landkreis Hofgeismar'):
            with self.subTest(kreis=kreis):
                self.assertEqual(von_kreis(kreis), '')


if __name__ == '__main__':
    unittest.main()
