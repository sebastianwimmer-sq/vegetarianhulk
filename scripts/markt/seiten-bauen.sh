#!/usr/bin/env bash
# Baut die Radar-Seite in beiden Sprachen und zieht alles nach, was dazugehoert:
# Sprach-Umschalter + hreflang, Stempel der englischen Schwester, Sitemap, ?v-Hashes.
# Nur aufrufen, wenn DE und EN zusammen geaendert wurden (der Stempel heisst „ist nachgezogen“).
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
python3 scripts/markt/seite.py
node scripts/sprachen-bauen.mjs
node scripts/sprachen-stempel.mjs /en/christmas-markets/
python3 scripts/sitemap-bauen.py
./scripts/bump-asset-versions.sh >/dev/null
echo "Radar-Seiten gebaut. Danach: node scripts/markt/radar-test.mjs && ./scripts/premium-check.sh"
