#!/usr/bin/env bash
# tour-loop.sh — die ganze Kette fuer eine Tour, in der bindenden Reihenfolge.
#
# WARUM ES DIESES SKRIPT GIBT
# Die Tour-Kette besteht aus sechs Schritten, die aufeinander aufbauen, und
# JEDER von ihnen hat am 16.09.2026 schon einmal still das Falsche getan, wenn
# er ausser der Reihe lief:
#
#   · `route-einbauen.py` vor `hoehenkarte.py` → Karte ohne Hoehenlinien
#   · `hoehenkarte.py` nach einer Aenderung am Kartenformat → Gitter passt
#     nicht mehr zum Ausschnitt, Linien laegen verschoben
#   · `satellit.py` vergessen → Luftbild von gestern unter der Route von heute
#   · `foto-format.py` vergessen → Fotos erben die Hoehe ihrer Rasterzeile und
#     verlieren bis zu 59 %
#   · `bump-asset-versions.sh` vergessen → Besucher sehen altes CSS
#   · `galerie-einbauen.py` vergessen → die Fotos bleiben einzelne Kacheln
#     im Bento-Raster statt eine Bildstrecke zu werden
#
# Keiner dieser Faelle wirft einen Fehler. Alle sehen aus wie eine fertige
# Seite. Deshalb: ein Befehl, feste Reihenfolge, und am Ende die Tore.
#
#   scripts/tour-loop.sh <slug>                  ganze Kette
#   scripts/tour-loop.sh <slug> --gpx <datei>    mit GPS-Spur statt OSM-Weg
#   scripts/tour-loop.sh <slug> --pruefen        aendert nichts, sagt nur was fehlt
#   scripts/tour-loop.sh --alle                  alle Touren neu bauen
set -u

WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$WURZEL" || exit 2

rot=$'\033[31m'; gruen=$'\033[32m'; gelb=$'\033[33m'; fett=$'\033[1m'; weg=$'\033[0m'

SLUGS=(); GPX=""; PRUEFEN=0
while [ $# -gt 0 ]; do
  case "$1" in
    --alle)    for d in touren/*/; do [ -f "$d/index.html" ] && SLUGS+=("$(basename "$d")"); done ;;
    --gpx)     shift; GPX="${1:-}" ;;
    --pruefen) PRUEFEN=1 ;;
    -h|--help) sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)         SLUGS+=("$1") ;;
  esac
  shift
done

if [ ${#SLUGS[@]} -eq 0 ]; then
  echo "Aufruf: scripts/tour-loop.sh <slug> [--gpx <datei>] [--pruefen]" >&2
  echo "        scripts/tour-loop.sh --alle" >&2
  exit 2
fi

FEHLER=0

schritt() { # name, befehl...
  local name="$1"; shift
  printf "  %-34s" "$name"
  if [ "$PRUEFEN" = 1 ]; then echo "${gelb}wuerde laufen${weg}"; return; fi
  local ausgabe
  if ausgabe="$("$@" 2>&1)"; then
    # Warnungen der Skripte durchreichen — sie melden veraltete Artefakte.
    if printf '%s' "$ausgabe" | grep -q "^  !"; then
      echo "${gelb}Hinweis${weg}"
      printf '%s\n' "$ausgabe" | grep "^  !" | sed 's/^/      /'
    else
      echo "${gruen}ok${weg}"
    fi
  else
    echo "${rot}FEHLER${weg}"
    printf '%s\n' "$ausgabe" | tail -12 | sed 's/^/      /'
    FEHLER=1
  fi
}

for SLUG in "${SLUGS[@]}"; do
  [ -f "touren/$SLUG/index.html" ] || { echo "${rot}$SLUG: keine index.html${weg}"; FEHLER=1; continue; }
  echo "${fett}── $SLUG${weg}"

  # 1. Linie: GPS-Spur schlaegt OSM-Weg. Ohne beides gibt es keine Karte.
  if [ -n "$GPX" ]; then
    schritt "GPS-Spur einlesen" python3 scripts/gpx-einlesen.py "$GPX"
  elif [ ! -f "touren/$SLUG/route.json" ]; then
    schritt "Weg aus OpenStreetMap" python3 scripts/route-holen.py "$SLUG"
  else
    art="$(python3 -c "import json;print(json.load(open('touren/$SLUG/route.json')).get('art','osm'))" 2>/dev/null)"
    printf "  %-34s%s\n" "Linie vorhanden" "${gruen}$art${weg}"
  fi

  # 2.+3. Untergrund. MUSS nach der Linie laufen: beide haengen am Ausschnitt,
  #       und der folgt der Route.
  schritt "Hoehengitter (EU-DEM)"   python3 scripts/hoehenkarte.py "$SLUG"
  schritt "Luftbild (Sentinel-2)"   python3 scripts/satellit.py "$SLUG"

  # 4. Fotoformate. Unabhaengig von der Karte, aber vor dem Einbauen —
  #    danach waere die Seite schon geschrieben.
  schritt "Fotoformate setzen"      python3 scripts/foto-format.py "$SLUG"

  # 5. Alles in die Seite. Reihenfolge ist bindend: die Bildstrecke sucht
  #    <!-- /WEGVERLAUF --> als Anker, und die Kreuz-Reihe sucht
  #    <!-- /BILDSTRECKE -->. Vertauscht landet beides am falschen Platz.
  schritt "Karte in die Seite"      python3 scripts/route-einbauen.py "$SLUG"
  schritt "Bildstrecke bauen"       python3 scripts/galerie-einbauen.py "$SLUG"
  schritt "Kreuz-Reihe"             python3 scripts/gipfelreihe-einbauen.py "$SLUG"
done

# 6. Cache-Buster: einmal fuer alle, nachdem alle Seiten geschrieben sind.
echo "${fett}── Gemeinsam${weg}"
schritt "Cache-Buster ziehen" bash scripts/bump-asset-versions.sh

# 7. Tore. Ein gruener Lauf ohne sie beweist nichts.
if [ "$PRUEFEN" = 1 ]; then
  echo
  echo "  ${gelb}--pruefen: nichts geaendert, keine Tore gelaufen.${weg}"
  exit 0
fi

echo "${fett}── Tore${weg}"
schritt "Touren gegen die Spec"    node scripts/tour-check.mjs --alle
schritt "Karten-Waechter"          python3 scripts/route-einbauen.py --selbsttest
schritt "Bildbeschnitt"            node scripts/foto-check.mjs
schritt "Bildstrecken-Waechter"    python3 scripts/galerie-einbauen.py --selbsttest
schritt "Kreuz-Waechter"           python3 scripts/gipfelreihe-einbauen.py --selbsttest

echo
if [ "$FEHLER" = 0 ]; then
  echo "  ${gruen}Kette durch.${weg} Jetzt SELBST ansehen — 390 px und Desktop."
  echo "  Voller Lauf inkl. 4 Engines: bash scripts/premium-check.sh"
else
  echo "  ${rot}Mindestens ein Schritt ist rot.${weg} Nichts ausliefern, bevor das steht."
fi
exit "$FEHLER"
