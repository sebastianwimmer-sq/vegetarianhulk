#!/usr/bin/env bash
# ============================================================
# dns-abgleich.sh — Sicherung der aktiven DNS-Records
#
# Liest aus, was fuer vegetarianhulk.de gerade aufgeloest wird, damit nach dem
# Cloudflare-Umzug Eintrag fuer Eintrag verglichen werden kann.
#
# ⚠️ Findet nur, wonach gefragt wird. Massgeblich bleibt die Record-Liste in der
# united-domains-Oberflaeche — dort stehen auch Eintraege, die von aussen nicht
# auffindbar sind (etwa DKIM-Selektoren). Siehe docs/dns-umzug-cloudflare.md
#
# Usage:  ./scripts/dns-abgleich.sh > /tmp/dns-vorher.txt
# ============================================================
set -euo pipefail

DOMAIN="${1:-vegetarianhulk.de}"

echo "# DNS-Abgleich ${DOMAIN} — $(date -u +%Y-%m-%dT%H:%M:%SZ)"

for record in NS A AAAA MX TXT CAA; do
  echo
  echo "## ${record} ${DOMAIN}"
  dig +short "${record}" "${DOMAIN}" || true
done

echo
echo "## CNAME www.${DOMAIN}"
dig +short CNAME "www.${DOMAIN}" || true

echo
echo "## TXT _dmarc.${DOMAIN}"
dig +short TXT "_dmarc.${DOMAIN}" || true

echo
echo "## DKIM-Selektoren (haeufige Kandidaten)"
for selector in mail brevo default s1 s2 k1 google; do
  answer="$(dig +short TXT "${selector}._domainkey.${DOMAIN}" || true)"
  [ -n "${answer}" ] && echo "${selector}._domainkey -> ${answer}"
done

echo
echo "## Mail- und Client-Subdomains"
for name in autoconfig autodiscover mail smtp imap pop webmail; do
  answer="$(dig +short "${name}.${DOMAIN}" || true)"
  [ -n "${answer}" ] && echo "${name} -> ${answer}"
done

echo
echo "# Ende. Nach dem Umzug erneut ausfuehren und beide Ausgaben vergleichen."
