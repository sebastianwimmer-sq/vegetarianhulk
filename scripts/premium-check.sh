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
#
# SPERRDATEI statt `pgrep -f <skriptname>`. Die Namenssuche traf die eigene
# Prozesskette: enthielt schon der AUFRUFENDE Befehl einen der Namen (etwa beim
# Einbauen eines neuen Tors), meldete sie "laeuft bereits" und der voellig
# korrekte Lauf brach ab. Am 16.09.2026 dreimal passiert. Eine PID plus
# `kill -0` weiss dagegen genau, ob der Prozess lebt.
SPERRE="${TMPDIR:-/tmp}/vh-premium-check.pid"
if [ -f "$SPERRE" ] && kill -0 "$(cat "$SPERRE" 2>/dev/null)" 2>/dev/null; then
  echo "Es laeuft bereits ein Pruefwerkzeug (PID $(cat "$SPERRE")). Erst abwarten —"
  echo "sonst sind die Ergebnisse Rauschen."
  exit 2
fi
echo $$ > "$SPERRE"
trap 'rm -f "$SPERRE"' EXIT INT TERM

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

# Rueckweg zuerst. Sebi am 22.09.2026: "bitte davor aber immer sicherstellen
# ... dass wir falls es noetig waere auch ein backup haben". `--auto` legt nur
# an, wenn es fuer den aktuellen Live-Stand noch keinen Schnappschuss gibt —
# und es laeuft HIER, weil dieses Skript vor jeder Auslieferung laeuft. Eine
# Sicherung, an die man denken muss, ist genau der Fehler.
titel "Rueckweg"
bash scripts/sicherung.sh --auto "automatisch vor premium-check" || true

# Cache-Buster nachziehen, statt ihn anzumahnen. Am 22.09.2026 standen fuenf
# Tourseiten rot, weil v3.js von Hand geaendert wurde — ein mechanischer
# Schritt, der niemanden aufhalten sollte. kern.md: ein Nachlauf-Schritt, den
# man vergessen kann, gehoert ans Tor.
bash scripts/bump-asset-versions.sh >/dev/null 2>&1 || true

titel "Statisch (Sekunden)"
lauf "Design-Kodex: Radien"          python3 scripts/kodex-radien.py --pruefen
lauf "Fremde Hosts & Ordner"         python3 scripts/fremdhosts-check.py
lauf "Produktliste & Affiliate-Tags" node scripts/produkte-sync.mjs --pruefen
lauf "Touren gegen die Spec"         node scripts/tour-check.mjs --alle
lauf "Tore selbst (Fixtures)"        ./scripts/tour-check-fixtures.sh
lauf "E-Mail-Vorlagen"               node scripts/mail-check.mjs --selbsttest
lauf "Sicherungs-Werkzeug"           ./scripts/sicherung.sh --selbsttest
lauf "Uebergaenge (Fixtures)"        node scripts/vt-check.mjs --selbsttest
lauf "Sichtbarkeit (Fixtures)"       node scripts/sichtbar-check.mjs --selbsttest

if [ "$SCHNELL" -eq 0 ]; then
  titel "Im Browser (Minuten)"
  lauf "Seitenwechsel-Kette"             node scripts/vt-check.mjs
  lauf "Nichts bleibt unsichtbar"        node scripts/sichtbar-check.mjs
  lauf "Barrierefreiheit, alle v3-Seiten" node scripts/a11y-check.mjs
  lauf "Darstellung, 4 Engines"        node scripts/tour-visual.mjs --site
  lauf "Bildbeschnitt der Kacheln"     node scripts/foto-check.mjs
  lauf "Nav beim Scrollen"             node scripts/nav-check.mjs
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
