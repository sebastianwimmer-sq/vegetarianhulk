#!/usr/bin/env bash
# ============================================================
# Turnstile-Scharfschaltung für vegetarianhulk.de (einmalig).
# Voraussetzung: Cloudflare-API-Token mit Account.Turnstile:Edit
# in ~/.cf-turnstile-token (nur der Token, eine Zeile).
#
# Macht: Widget anlegen (managed, vegetarianhulk.de + localhost)
# → Sitekey in newsletter-form.js eintragen → Secret als
# wrangler-Secret in workers/vh-forms setzen. Danach: bump + push
# (macht Claude oder Sebi manuell).
# ============================================================
set -euo pipefail
cd "$(dirname "$0")/.."

ACCOUNT_ID="1e724fd9fe4e603d8ec7bf32aafbac72"
TOKEN_FILE="$HOME/.cf-turnstile-token"

[ -f "$TOKEN_FILE" ] || { echo "❌ $TOKEN_FILE fehlt. Token anlegen: dash.cloudflare.com/profile/api-tokens → Create Token → Custom → Permission 'Account / Turnstile / Edit' → Account auswählen → Create. Dann:  umask 077 && printf '%s' '<TOKEN>' > ~/.cf-turnstile-token"; exit 1; }
TOKEN=$(cat "$TOKEN_FILE")

echo "→ Lege Turnstile-Widget an…"
RES=$(curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/$ACCOUNT_ID/challenges/widgets" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"vegetarianhulk-newsletter","mode":"managed","domains":["vegetarianhulk.de","www.vegetarianhulk.de","localhost"]}')

SITEKEY=$(echo "$RES" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['result']['sitekey'] if d.get('success') else '')")
SECRET=$(echo "$RES" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['result']['secret'] if d.get('success') else '')")
[ -n "$SITEKEY" ] || { echo "❌ Widget-Anlage fehlgeschlagen:"; echo "$RES" | head -c 400; exit 1; }
echo "✅ Widget angelegt. Sitekey: $SITEKEY"

echo "→ Sitekey in newsletter-form.js…"
perl -pi -e "s/var TURNSTILE_SITEKEY = '[^']*';/var TURNSTILE_SITEKEY = '$SITEKEY';/" newsletter-form.js
grep -q "$SITEKEY" newsletter-form.js && echo "✅ Sitekey eingetragen"

echo "→ Secret in vh-forms-Worker…"
( cd workers/vh-forms && printf '%s' "$SECRET" | npx wrangler secret put TURNSTILE_SECRET )
echo "✅ Secret gesetzt."
echo
echo "NÄCHSTE SCHRITTE: ./scripts/bump-asset-versions.sh → commit → git push origin HEAD:main → Formular live testen."
