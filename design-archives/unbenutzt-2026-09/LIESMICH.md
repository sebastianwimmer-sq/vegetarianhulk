# Aus dem Repo-Wurzelverzeichnis genommen, 03.09.2026

Diese Dateien lagen im Root und wurden von **keiner** Seite eingebunden —
GitHub Pages liefert aber alles aus, was im Repo liegt. Sie waren also
oeffentlich abrufbar, ohne je gebraucht zu werden (zusammen rund 11 MB).

| Datei | Groesse | war |
|---|---|---|
| koop-hero.png · koop-pakete.png | je ~2,3 MB | Mockups fuer die Kooperationsseite |
| flag-breit.png · flag-mobil.png | 2,2 MB / 604 kB | Flaggen-Grafiken |
| touren-hook.png · touren-next.png | je ~2,1 MB | Vorschau-Grafiken |
| hero-cutout-quelle.png | 744 kB | **Quelle** des ausgelieferten `hero-cutout.webp` |

`hero-cutout-quelle.png` bitte behalten: daraus wird das WebP abgeleitet
(`python3 -c "from PIL import Image; ..."` bzw. `scripts/tour-foto.py`).
Die anderen sind Archiv — geloescht wurde nichts, nur verschoben.

## newsletter-styles.css (vormals `newsletter/styles.css`)

1.184 Zeilen, die **keine** Seite mehr geladen hat: `/newsletter/` bindet nur
`fonts.css` und `v3.css` ein. Die Datei stand trotzdem in der Asset-Liste von
`bump-asset-versions.sh` und wurde bei jedem Lauf mitgehasht.

Beim CLS-Fix am 03.09. wurde das teuer: eine Korrektur landete zuerst hier und
in `style.css` — der Computed Style zeigte danach `box-shadow: none`, weil die
Zielseite beide Dateien gar nicht laedt.
