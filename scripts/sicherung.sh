#!/usr/bin/env bash
# sicherung.sh — Rueckweg sichern, BEVOR etwas Grosses ausgerollt wird.
#
# WARUM
# Sebi am 22.09.2026: "bitte davor aber immer sicherstellen ... dass wir falls
# es noetig waere auch ein backup haben damit nicht dann alles kaputt geht".
#
# Im Repo lagen zwei Sicherungs-Tags: `old-site-backup` und `pre-reveal-backup`.
# Beide von Hand, beide einmal, beide danach nie wieder. Genau das Muster, vor
# dem kern.md warnt: ein Nachlauf-Schritt, den man vergessen kann, ist ein
# Fehler, der auf seinen Tag wartet.
#
# Deshalb legt sich diese Sicherung SELBST an. `--auto` laeuft im
# premium-check.sh mit und merkt, wenn es fuer den aktuellen Live-Stand noch
# keinen Schnappschuss gibt. Niemand muss daran denken.
#
# WAS GESICHERT WIRD — und warum beides noetig ist
#   1. Ein Tag auf origin/main. `main` IST die Auslieferung (GitHub Pages,
#      Quelle main:/), also markiert der Tag exakt den Stand, der live war.
#   2. Ein Archiv des Arbeitsbaums inkl. UNVERFOLGTER Dateien. Ein Tag sichert
#      nur Committetes — die halbfertige Arbeit im Baum waere weg, und genau
#      die ist beim Ausrollen am wertvollsten.
#
# ZURUECK GEHT ES OHNE FORCE-PUSH. Ein `git push --force` auf main macht den
# Fehler unwiderruflich und reisst die Historie aller anderen Worktrees mit.
# `--zurueck` baut stattdessen einen Commit, der den Baum wiederherstellt —
# rueckgaengig machbar, nachvollziehbar, und Pages liefert ihn sofort aus.
#
# Aufruf:
#   scripts/sicherung.sh --anlegen ["Grund"]   Schnappschuss jetzt
#   scripts/sicherung.sh --auto                nur anlegen, wenn noch keiner da ist
#   scripts/sicherung.sh --liste               was da ist
#   scripts/sicherung.sh --pruefe              0 = Stand gesichert, 1 = nicht
#   scripts/sicherung.sh --zurueck <tag>       Baum auf den Stand zurueckholen
#   scripts/sicherung.sh --selbsttest          prueft das Werkzeug selbst

set -euo pipefail

WURZEL="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LAGER="${VH_SICHERUNGEN:-$HOME/vh-sicherungen}"
BEHALTEN=12            # Archive; aeltere fliegen raus, Tags bleiben (sie kosten nichts)

rot=$'\033[31m'; gruen=$'\033[32m'; gelb=$'\033[33m'; fett=$'\033[1m'; weg=$'\033[0m'

cd "$WURZEL"

# Sperre gegen Parallellaeufe. pgrep auf den eigenen Namen trifft die eigene
# Prozesskette — deshalb eine PID-Datei (kern.md, 16.09.2026).
SPERRE="${TMPDIR:-/tmp}/vh-sicherung.pid"
if [ -f "$SPERRE" ] && kill -0 "$(cat "$SPERRE")" 2>/dev/null; then
  echo "${gelb}sicherung: laeuft bereits (PID $(cat "$SPERRE"))${weg}"; exit 0
fi
echo $$ > "$SPERRE"
trap 'rm -f "$SPERRE"' EXIT INT TERM

live_commit() {
  git fetch -q origin main 2>/dev/null || true
  git rev-parse origin/main
}

tag_fuer() {  # $1 = commit  → vorhandener Sicherungs-Tag oder leer
  # `|| true` ist Pflicht: unter `set -e` + `pipefail` beendet ein grep OHNE
  # Treffer das ganze Skript — wortlos, mit Exit 1. Der erste Lauf von
  # --pruefe hat dadurch GAR NICHTS ausgegeben und sah aus wie ein Befund.
  # Ein Tor, das im Normalfall schweigend abbricht, ist kein Tor.
  { git tag --points-at "$1" 2>/dev/null | grep '^sicherung/' || true; } | head -1
}

anlegen() {
  local grund="${1:-ohne Angabe}"
  local commit; commit="$(live_commit)"
  local vorhanden; vorhanden="$(tag_fuer "$commit")"

  if [ -n "$vorhanden" ] && [ "${NUR_WENN_NOETIG:-0}" = 1 ]; then
    echo "  ${gruen}Sicherung vorhanden${weg}  $vorhanden  ($(echo "$commit" | cut -c1-7))"
    return 0
  fi

  local stempel; stempel="$(date +%Y-%m-%d-%H%M)"
  local tag="sicherung/$stempel"
  mkdir -p "$LAGER"

  # 1. Tag auf den LIVE-Stand, nicht auf HEAD: HEAD kann ein Arbeitsbranch sein.
  if [ -z "$vorhanden" ]; then
    git tag -a "$tag" "$commit" -m "Sicherung $stempel — $grund" 2>/dev/null || true
    git push -q origin "$tag" 2>/dev/null \
      && echo "  ${gruen}Tag${weg}      $tag → origin  ($(echo "$commit" | cut -c1-7))" \
      || echo "  ${gelb}Tag${weg}      $tag nur lokal (kein Netz?)"
  else
    tag="$vorhanden"
    echo "  ${gruen}Tag${weg}      $tag (Live-Stand war schon getaggt)"
  fi

  # 2. Archiv des Arbeitsbaums INKL. unverfolgter Dateien. Der Tag sichert nur
  #    Committetes; die halbfertige Arbeit waere sonst weg.
  #    Die Auswahl macht git, nicht eine Ausschlussliste: verfolgt PLUS
  #    unverfolgt-aber-nicht-ignoriert. Damit ist automatisch alles drin, was
  #    Arbeit ist, und nichts, was Cache ist. Ein blosses `tar .` hat beim
  #    ersten Lauf 289 MB erzeugt — davon 282 MB `.tour-visual`, ein
  #    Screenshot-Cache. Zwoelf solche Archive waeren 3,5 GB Muell gewesen.
  local archiv="$LAGER/vh-$stempel.tar.gz"
  git ls-files -z --cached --others --exclude-standard \
    | tar --null -T - -czf "$archiv" -C "$WURZEL" 2>/dev/null
  echo "  ${gruen}Archiv${weg}   $archiv  ($(du -h "$archiv" | cut -f1))"

  # 3. Merkzettel: was war live, wie kommt man zurueck.
  cat > "$LAGER/vh-$stempel.txt" <<NOTIZ
Sicherung $stempel
Grund     : $grund
Live war  : $commit
Tag       : $tag
Arbeitsbaum HEAD: $(git rev-parse --short HEAD) ($(git rev-parse --abbrev-ref HEAD))
Unverfolgt/geaendert beim Sichern: $(git status --porcelain | wc -l | tr -d ' ') Datei(en)

ZURUECK (ohne force-push, jederzeit widerrufbar):
  cd $WURZEL
  scripts/sicherung.sh --zurueck $tag
NOTIZ

  # 4. Aufraeumen: Archive sind gross, Tags nicht. Nur Archive werden gekappt.
  local zuviel
  zuviel=$(ls -1t "$LAGER"/vh-*.tar.gz 2>/dev/null | tail -n +$((BEHALTEN + 1)) || true)
  if [ -n "$zuviel" ]; then
    echo "$zuviel" | while read -r alt; do rm -f "$alt" "${alt%.tar.gz}.txt"; done
    echo "  ${gelb}Aufgeraeumt${weg}  $(echo "$zuviel" | wc -l | tr -d ' ') altes Archiv (Tags bleiben)"
  fi
}

liste() {
  echo "${fett}Sicherungs-Tags${weg} (= Staende, die live waren)"
  git tag -l 'sicherung/*' --sort=-creatordate | head -15 | while read -r t; do
    printf "  %-26s %s  %s\n" "$t" "$(git rev-parse --short "$t^{commit}")" \
      "$(git log -1 --format=%ci "$t^{commit}" | cut -c1-16)"
  done
  [ -n "$(git tag -l 'sicherung/*')" ] || echo "  ${gelb}noch keine${weg}"
  echo
  echo "${fett}Archive${weg} (= Arbeitsbaum inkl. unverfolgter Dateien)  $LAGER"
  ls -1t "$LAGER"/vh-*.tar.gz 2>/dev/null | head -15 | while read -r a; do
    printf "  %-46s %s\n" "$(basename "$a")" "$(du -h "$a" | cut -f1)"
  done
  ls "$LAGER"/vh-*.tar.gz >/dev/null 2>&1 || echo "  ${gelb}noch keine${weg}"
}

pruefe() {
  local commit; commit="$(live_commit)"
  local t; t="$(tag_fuer "$commit")"
  if [ -n "$t" ]; then
    echo "  ${gruen}Rueckweg gesichert${weg}  $t → $(echo "$commit" | cut -c1-7)"
    return 0
  fi
  echo "  ${gelb}Kein Schnappschuss fuer den Live-Stand${weg} $(echo "$commit" | cut -c1-7)"
  echo "    scripts/sicherung.sh --anlegen \"vor <was>\""
  return 1
}

zurueck() {
  local tag="${1:-}"
  [ -n "$tag" ] || { echo "${rot}--zurueck braucht einen Tag${weg} (scripts/sicherung.sh --liste)"; exit 2; }
  git rev-parse -q --verify "$tag^{commit}" >/dev/null \
    || { echo "${rot}Tag $tag gibt es nicht${weg}"; exit 2; }

  if [ -n "$(git status --porcelain)" ]; then
    echo "${rot}Der Arbeitsbaum ist nicht sauber.${weg} Erst sichern oder committen —"
    echo "  sonst verliert das Zurueckholen genau die Arbeit, die es retten soll."
    exit 1
  fi

  local ziel; ziel="$(git rev-parse --short "$tag^{commit}")"
  echo "${fett}Zurueck auf $tag ($ziel)${weg}"
  echo "  Kein force-push: es entsteht ein Commit, der den Baum wiederherstellt."
  echo
  git diff --stat "$tag" -- . | tail -12
  echo
  read -r -p "  Ausfuehren? [j/N] " antwort
  [ "$antwort" = "j" ] || { echo "  abgebrochen"; exit 0; }

  local zweig="rueckweg/$(date +%Y-%m-%d-%H%M)"
  git checkout -q -B "$zweig" origin/main
  git checkout "$tag" -- .
  git commit -q -m "revert: Baum zurueck auf $tag ($ziel)

Wiederhergestellt mit scripts/sicherung.sh --zurueck.
Kein force-push — dieser Commit ist selbst wieder widerrufbar."
  echo "  ${gruen}Fertig.${weg} Branch $zweig — pruefen, dann:"
  echo "    bash scripts/premium-check.sh && git push -u origin $zweig && gh pr create --fill"
}

selbsttest() {
  local fehler=0
  # Fixture: ein Wegwerf-Repo. NIE gegen den echten Baum testen —
  # ein Generator-Fixture im echten Baum hat am 13.09. fremde Dateien zerlegt.
  local tmp; tmp="$(mktemp -d)"
  git -C "$tmp" init -q .
  git -C "$tmp" config user.email t@t; git -C "$tmp" config user.name T
  echo eins > "$tmp/a.txt"; git -C "$tmp" add -A; git -C "$tmp" commit -qm eins
  git -C "$tmp" tag -a 'sicherung/probe' -m probe

  if [ -z "$(git -C "$tmp" tag --points-at HEAD | grep '^sicherung/')" ]; then
    echo "${rot}✗ SELBSTTEST: vorhandener Tag wird nicht erkannt${weg}"; fehler=1
  fi
  echo zwei > "$tmp/a.txt"; git -C "$tmp" commit -qam zwei
  if [ -n "$(git -C "$tmp" tag --points-at HEAD | grep '^sicherung/')" ]; then
    echo "${rot}✗ SELBSTTEST: ungesicherter Stand gilt faelschlich als gesichert${weg}"; fehler=1
  fi

  # Das Archiv muss unverfolgte Dateien enthalten — sonst sichert es das
  # Wertvollste nicht.
  echo geheim > "$tmp/neu-und-unverfolgt.txt"
  printf 'cache/\n' > "$tmp/.gitignore"
  mkdir -p "$tmp/cache"; echo muell > "$tmp/cache/gross.bin"
  ( cd "$tmp" && git ls-files -z --cached --others --exclude-standard \
      | tar --null -T - -czf "$tmp/probe.tar.gz" -C "$tmp" 2>/dev/null )
  if ! tar -tzf "$tmp/probe.tar.gz" | grep -q 'neu-und-unverfolgt'; then
    echo "${rot}✗ SELBSTTEST: unverfolgte ARBEIT fehlt im Archiv${weg}"; fehler=1
  fi
  if tar -tzf "$tmp/probe.tar.gz" | grep -q 'cache/gross.bin'; then
    echo "${rot}✗ SELBSTTEST: ignorierter Cache landet im Archiv (es wird riesig)${weg}"; fehler=1
  fi
  if tar -tzf "$tmp/probe.tar.gz" | grep -q '\.git/'; then
    echo "${rot}✗ SELBSTTEST: .git landet im Archiv${weg}"; fehler=1
  fi
  # Der Fall, der das Werkzeug beim ersten Lauf stumm gemacht hat: ein Commit
  # OHNE Sicherungs-Tag darf nicht zum Abbruch fuehren, sondern muss melden.
  local ausgabe; ausgabe="$(cd "$tmp" && { git tag --points-at HEAD 2>/dev/null | grep '^sicherung/' || true; } | head -1; echo "ok")"
  if [ "${ausgabe%ok}" != "" ] || [ "${ausgabe: -2}" != "ok" ]; then
    echo "${rot}✗ SELBSTTEST: Abfrage ohne Treffer bricht ab statt leer zu liefern${weg}"; fehler=1
  fi
  rm -rf "$tmp"

  [ "$fehler" = 0 ] && echo "${gruen}✓ Selbsttest: Tag-Erkennung in beide Richtungen, Archiv traegt Arbeit und laesst Cache weg${weg}"
  return $fehler
}

case "${1:---liste}" in
  --anlegen)    anlegen "${2:-ohne Angabe}" ;;
  --auto)       NUR_WENN_NOETIG=1 anlegen "${2:-automatisch vor einem Lauf}" ;;
  --liste)      liste ;;
  --pruefe)     pruefe ;;
  --zurueck)    zurueck "${2:-}" ;;
  --selbsttest) selbsttest ;;
  *) sed -n '1,40p' "$0" | grep '^#' | sed 's/^# \{0,1\}//'; exit 2 ;;
esac
