#!/usr/bin/env python3
"""
tour-foto.py — iPhone-Foto (HEIC/JPEG) → web-fertiges Tour-Bild.

Warum es dieses Skript gibt (Vorfall 02.09.2026, Kneifelspitze):
HUB-WORKFLOW.md §4.2 stand ein Handrezept mit fester `sips -r 90`-Drehung.
Das hat nur fuer Ristfeuchthorn zufaellig gepasst. Bei der Kneifelspitze
trugen drei Fotos Orientation 6 und eins Orientation 3 — die feste Drehung
kippte sie nach links, und `sips -r` laesst den EXIF-Tag stehen, sodass
Viewer ein zweites Mal drehen. Ergebnis: liegende Gipfelkreuze.

Deterministisch statt geraten: sips liest nur das HEIC (PIL kann es nicht),
die Ausrichtung macht ausschliesslich Pillows exif_transpose anhand des
Tags, und gespeichert wird OHNE exif — danach gibt es keinen Tag mehr,
den irgendwer erneut anwenden koennte.

    python3 scripts/tour-foto.py IN.heic OUT.jpg [--breite 1600] [--q 80]
"""
import subprocess
import sys
import tempfile
from pathlib import Path

from PIL import Image, ImageOps

MAX_KB_WARNUNG = 400


def heic_nach_jpeg(quelle: Path, ziel: Path, kante: int) -> None:
    """sips als HEIC-Reader — Pillow kann HEIC ohne Plugin nicht oeffnen."""
    subprocess.run(
        ["sips", "-s", "format", "jpeg", "-Z", str(kante), str(quelle), "--out", str(ziel)],
        check=True,
        capture_output=True,
    )


def aufbereiten(quelle: Path, ziel: Path, kante: int, qualitaet: int) -> dict:
    with tempfile.TemporaryDirectory() as tmp:
        roh = Path(tmp) / "roh.jpg"
        if quelle.suffix.lower() in (".heic", ".heif"):
            heic_nach_jpeg(quelle, roh, kante)
        else:
            roh = quelle

        bild = Image.open(roh)
        tag = bild.getexif().get(274)
        vorher = bild.size
        # exif_transpose dreht die PIXEL gemaess Tag — genau einmal.
        bild = ImageOps.exif_transpose(bild).convert("RGB")
        if max(bild.size) > kante:
            bild.thumbnail((kante, kante), Image.LANCZOS)
        ziel.parent.mkdir(parents=True, exist_ok=True)
        # ohne exif= : der Tag ist weg, niemand dreht ein zweites Mal
        bild.save(ziel, "JPEG", quality=qualitaet, optimize=True, progressive=True)

    return {"orientation": tag, "vorher": vorher, "nachher": bild.size,
            "kb": round(ziel.stat().st_size / 1024)}


def main() -> int:
    args = sys.argv[1:]
    if len(args) < 2:
        print(__doc__)
        return 2

    quelle, ziel = Path(args[0]), Path(args[1])
    kante = int(args[args.index("--breite") + 1]) if "--breite" in args else 1600
    qualitaet = int(args[args.index("--q") + 1]) if "--q" in args else 80

    if not quelle.exists():
        print(f"FEHLER: {quelle} gibt es nicht")
        return 1

    ergebnis = aufbereiten(quelle, ziel, kante, qualitaet)
    b, h = ergebnis["nachher"]
    print(f"{ziel.name}: orientation={ergebnis['orientation']} "
          f"{ergebnis['vorher'][0]}x{ergebnis['vorher'][1]} -> {b}x{h}, {ergebnis['kb']} KB")
    print(f'  HTML: width="{b}" height="{h}"')
    if ergebnis["kb"] > MAX_KB_WARNUNG:
        print(f"  WARNUNG: >{MAX_KB_WARNUNG} KB — --q senken oder --breite kleiner")
    return 0


if __name__ == "__main__":
    sys.exit(main())
