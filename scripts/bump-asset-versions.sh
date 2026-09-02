#!/usr/bin/env bash
# ============================================================
# bump-asset-versions.sh — Content-Hash-Cache-Busting
#
# Funktionsweise (1 Zeile): Berechnet pro Asset einen 8-Zeichen-
# SHA256-Content-Hash und schreibt alle ?v=…-Referenzen in den
# HTML-Dateien (und die fonts.css-@imports in den CSS-Dateien)
# auf ?v=<hash> um — ändert sich ein Asset, ändert sich seine URL,
# und auch aggressive Caches (Instagram-In-App-Browser!) ziehen
# sofort die neue Version.
#
# Usage:   ./scripts/bump-asset-versions.sh        (vor dem Commit
#          ausführen, wenn CSS/JS geändert wurde — Diff reviewen,
#          mitcommitten. Idempotent: ohne Asset-Änderung kein Diff.)
#
# Bewusst KEINE Build-Pipeline: reines bash/sed/shasum, läuft
# lokal auf macOS (sed -i ''), kein Node/CI nötig.
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

# Assets, deren Referenzen gebustet werden (Pfad relativ zum Repo-Root)
ASSETS=(
  style.css
  fonts.css
  v3.css
  v3.js
  touren/tour.css
  touren/tour.js
  relief3d.js
  motion-reveal.js
  update-check.js
  newsletter-form.js
  danke-block.js
  newsletter/styles.css
  newsletter/form.js
  codes/partners.js
  lieblingsprodukte/products.js
)

# Interne Verzeichnisse, deren HTML nicht angefasst wird
PRUNE_DIRS=( _preview design vendor second-brain workers audit-reports node_modules .git )

hash8() { shasum -a 256 "$1" | cut -c1-8; }

html_files() {
  local prune_args=()
  for d in "${PRUNE_DIRS[@]}"; do prune_args+=( -path "./$d" -prune -o ); done
  find . "${prune_args[@]}" -name '*.html' -print | sed 's|^\./||'
}

# In $1 (Datei) alle Referenzen auf Asset-Basename $2 auf ?v=$3 setzen.
# Begrenzer ["'/] vor dem Basename verhindert, dass z.B. "styles.css"
# von "style.css" mitgetroffen wird.
rewrite_refs() {
  local file="$1" base="$2" hash="$3"
  local esc="${base//./\\.}"
  sed -i '' -E "s|([\"'/])${esc}(\?v=[^\"']*)?([\"'])|\1${base}?v=${hash}\3|g" "$file"
}

# ── 1) fonts.css zuerst: dessen Hash steckt im @import der CSS-Dateien,
#       muss also VOR dem Hashen von style.css/newsletter/styles.css rein
FONTS_HASH="$(hash8 fonts.css)"
for css in style.css newsletter/styles.css; do
  sed -i '' -E "s|@import url\('/fonts\.css(\?v=[^']*)?'\);|@import url('/fonts.css?v=${FONTS_HASH}');|" "$css"
done

# ── 2) Pro Asset: Hash berechnen, alle HTML-Referenzen umschreiben
ALL_HTML="$(html_files)"
for asset in "${ASSETS[@]}"; do
  [ -f "$asset" ] || { echo "skip (fehlt): $asset"; continue; }
  h="$(hash8 "$asset")"
  base="$(basename "$asset")"
  while IFS= read -r html; do
    rewrite_refs "$html" "$base" "$h"
  done <<< "$ALL_HTML"
  echo "  $asset → ?v=$h"
done

echo "Done. Diff reviewen (git diff), dann mitcommitten."
