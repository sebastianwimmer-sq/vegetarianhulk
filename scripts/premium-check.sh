#!/usr/bin/env bash
# premium-check.sh — alle Tore der Site in einem Lauf.
#
#   ./scripts/premium-check.sh          # alles
#   ./scripts/premium-check.sh --schnell # ohne die Browser-Laeufe (~5 s statt ~5 min)
#
# Gedacht als der eine Befehl vor jedem Merge. Reihenfolge nach Laufzeit:
# die statischen Tore zuerst, damit ein Tippfehler nicht erst nach fuenf
# Minuten Browser-Arbeit auffaellt.
#
# Exit 1, sobald ein Tor rot ist. Was NICHT geprueft wird, steht am Ende —
# ein Tor, das Luecken verschweigt, wiegt in falscher Sicherheit.
set -u
cd "$(dirname "${BASH_SOURCE[0]}")/.."

# Nicht parallel zu einem anderen Pruefwerkzeug starten: jedes bringt seinen
# eigenen HTTP-Server und mehrere Browser mit. Ein a11y-Lauf neben einem
# laufenden tour-visual meldete einmal rot und danach dreimal gruen —
# Ressourcenkonkurrenz, kein Befund.
if pgrep -f "tour-visual.mjs|a11y-check.mjs" >/dev/null 2>&1; then
  echo "Es laeuft bereits ein Pruefwerkzeug. Erst abwarten — sonst sind die"
  echo "Ergebnisse Rauschen. (pgrep -f tour-visual)"
  exit 2
fi

SCHNELL=0
[ "${1:-}" = "--schnell" ] && SCHNELL=1
FEHLER=0
START=$(date +%s)

titel() { printf "\n\033[1m── %s\033[0m\n" "$1"; }
lauf() {
  local name="$1"; shift
  printf "  %-38s " "$name"
  local ausgabe
  if ausgabe=$("$@" 2>&1); then
    printf "\033[32mgrün\033[0m\n"
  else
    printf "\033[31mROT\033[0m\n"
    echo "$ausgabe" | grep -E "✗|FEHLER|🔴" | head -8 | sed 's/^/      /'
    FEHLER=$((FEHLER + 1))
  fi
}

titel "Statisch (Sekunden)"
lauf "Design-Kodex: Radien"          python3 scripts/kodex-radien.py --pruefen
lauf "Touren gegen die Spec"         node scripts/tour-check.mjs --alle
lauf "Tore selbst (Fixtures)"        ./scripts/tour-check-fixtures.sh
lauf "E-Mail-Vorlagen"               node scripts/mail-check.mjs --selbsttest

if [ "$SCHNELL" -eq 0 ]; then
  titel "Im Browser (Minuten)"
  lauf "Barrierefreiheit, 13 Seiten"   node scripts/a11y-check.mjs
  lauf "Darstellung, 4 Engines"        node scripts/tour-visual.mjs --site
fi

DAUER=$(( $(date +%s) - START ))

titel "Ergebnis"
if [ "$FEHLER" -eq 0 ]; then
  printf "  \033[32mAlle Tore grün\033[0m (%s s)\n" "$DAUER"
else
  printf "  \033[31m%s Tor(e) rot\033[0m (%s s)\n" "$FEHLER" "$DAUER"
fi

cat <<'OFFEN'

  Nicht abgedeckt — bewusst, damit die Liste ehrlich bleibt:
  · Turnstile-Widget-Modus (kein API-Zugriff, Cloudflare-Dashboard)
  · Clickjacking-Schutz (frame-ancestors braucht einen HTTP-Header,
    den GitHub Pages nicht zulaesst)
  · CLS-Ausreisser auf /newsletter/, wenn v3.css (66 kB) langsam kommt:
    live liegt der Median bei 0,01–0,015 und WebKit bei 0, einzelne Laeufe
    gehen auf 0,109. Loesungsweg waere kritisches CSS fuer den ersten
    Viewport — zwei einfachere Versuche haben es verschlechtert (einer auf
    0,414), deshalb steht es offen statt halb gefixt.
  · Kontrast auf Fotos und stark gespreizten Verlaeufen: rechnerisch nicht
    bestimmbar, das a11y-Tor weist die Zahl der Faelle aus. Per Auge pruefen.
OFFEN
exit "$FEHLER"
