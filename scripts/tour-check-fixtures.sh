#!/usr/bin/env bash
# tour-check-fixtures.sh — beweist, dass tour-check.mjs anschlaegt.
#
# Ein Tor, das man nie hat anschlagen sehen, ist keins. Dieses Skript baut
# je einen bekannten Fehler in eine Wegwerf-Kopie des Baums ein und verlangt,
# dass das Tor rot wird — und dass der unveraenderte Baum gruen bleibt.
# Nach JEDER Aenderung an tour-check.mjs laufen lassen.
set -u

WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SLUG="${1:-kneifelspitze}"
FEHLGESCHLAGEN=0

pruefe() { # name, sed-ausdruck, zieldatei-relativ
  local name="$1" ausdruck="$2" ziel="$3"
  local tmp; tmp="$(mktemp -d)"
  cp -R "$WURZEL/touren" "$WURZEL/scripts" "$tmp/" 2>/dev/null
  perl -0pi -e "$ausdruck" "$tmp/$ziel" 2>/dev/null

  if node "$tmp/scripts/tour-check.mjs" "$SLUG" >/dev/null 2>&1; then
    echo "  ✗ NICHT ERKANNT: $name"
    FEHLGESCHLAGEN=1
  else
    echo "  ✓ erkannt: $name"
  fi
  rm -rf "$tmp"
}

echo "Negativtests (jeder MUSS rot werden):"
pruefe "canonical zeigt woandershin" \
  's{<link rel="canonical" href="[^"]*"}{<link rel="canonical" href="https://example.com/"}' \
  "touren/$SLUG/index.html"
pruefe "Hero-Bild fehlt auf der Platte" \
  's{gipfelkreuz-nacht\.jpg}{gibtsnicht.jpg}g' \
  "touren/$SLUG/index.html"
pruefe "width/height am Hero entfernt" \
  's{width="1125" height="1500"}{}' \
  "touren/$SLUG/index.html"
pruefe "elevation weicht von der Gipfelhoehe ab" \
  's{elevation=1188}{elevation=1569}' \
  "touren/$SLUG/index.html"
pruefe "JSON-LD kaputt" \
  's{"\@type": "Article",}{"\@type" "Article",}' \
  "touren/$SLUG/index.html"
pruefe "Vorlagen-Rest: Link auf die falsche Tour" \
  's{/touren/kneifelspitze/gipfelkreuz-nacht\.jpg}{/touren/ristfeuchthorn/ausblick.jpg}' \
  "touren/$SLUG/index.html"
pruefe "Liste nutzt data-hm statt data-thm" \
  's{data-thm="456"}{data-hm="456"}' \
  "touren/index.html"
pruefe "Filter-Chip fuer den Grad fehlt" \
  's{<button class="tk-chip" data-f="diff" data-v="1"[^>]*>Leicht</button>\s*}{}' \
  "touren/index.html"
pruefe "tkCount passt nicht zur Liste" \
  's{<b id="tkCount">8</b>}{<b id="tkCount">5</b>}' \
  "touren/index.html"
pruefe "Pinned zeigt auf die aeltere Tour" \
  's{<a class="tk-pin tk-wide st st3" href="/touren/kneifelspitze/"}{<a class="tk-pin tk-wide st st3" href="/touren/ristfeuchthorn/"}' \
  "touren/index.html"
pruefe "Tour fehlt in der JSON-LD ItemList" \
  's{\{"\@type":"ListItem","position":1,"name":"Kneifelspitze[^\}]*\},\s*}{}' \
  "touren/index.html"
pruefe "Asset ohne Cache-Bust eingebunden" \
  's{/v3\.css\?v=[a-f0-9]{8}}{/v3.css}' \
  "touren/$SLUG/index.html"

echo
echo "Positivtest (MUSS gruen bleiben):"
if node "$WURZEL/scripts/tour-check.mjs" --alle >/dev/null 2>&1; then
  echo "  ✓ unveraenderter Baum ist gruen"
else
  echo "  ✗ unveraenderter Baum ist ROT — echter Befund oder Tor zu streng:"
  node "$WURZEL/scripts/tour-check.mjs" --alle 2>&1 | sed 's/^/      /'
  FEHLGESCHLAGEN=1
fi

echo
if [ "$FEHLGESCHLAGEN" -eq 0 ]; then
  echo "Alle Fixtures bestanden."
else
  echo "FIXTURES FEHLGESCHLAGEN — dem Tor noch nicht glauben."
fi
exit "$FEHLGESCHLAGEN"
