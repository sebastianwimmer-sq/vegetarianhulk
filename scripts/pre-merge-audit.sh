#!/usr/bin/env bash
# ============================================================
# Pre-Merge Audit Suite — vegetarianhulk
# Usage: ./scripts/pre-merge-audit.sh [BASE_URL]
# Default: https://vegetarianhulk.de
# Override: ./scripts/pre-merge-audit.sh https://feat-xyz.vegetarianhulk-preview.pages.dev
# ============================================================

set -uo pipefail

BASE_URL="${1:-https://vegetarianhulk.de}"
TIMESTAMP="$(date +%Y-%m-%d-%H-%M)"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPORT_DIR="$REPO_DIR/audit-reports/$TIMESTAMP"
mkdir -p "$REPORT_DIR"

PAGES=(
  "/"
  "/newsletter/"
  "/kooperationen.html"
  "/3-tage-reset/"
  "/danke.html"
  "/impressum.html"
  "/datenschutz.html"
)

# ── Tally counters ────────────────────────────────────
PERF_FAILS=0
A11Y_FAILS=0
SEO_FAILS=0
BP_FAILS=0
A11Y_VIOLATIONS=0
DSGVO_ISSUES=0
CROSSPAGE_ISSUES=0
DOM_ERRORS=0

# Thresholds
PERF_MIN_MOBILE=85
A11Y_MIN=95
SEO_MIN=95
BP_MIN=90

# ── Helpers ───────────────────────────────────────────
section() { printf "\n\033[1;34m── %s ──\033[0m\n" "$1"; }
ok()      { printf "  \033[1;32m✓\033[0m %s\n" "$1"; }
warn()    { printf "  \033[1;33m⚠\033[0m %s\n" "$1"; }
fail()    { printf "  \033[1;31m✗\033[0m %s\n" "$1"; }
info()    { printf "  · %s\n" "$1"; }

slugify() {
  echo "$1" | sed -E 's|^/||; s|/$||; s|/|-|g; s|\.html$||' | sed 's|^$|root|'
}

# ── Audit A+B+C+F: Lighthouse (Perf · a11y · SEO · BestPractices) ─
audit_lighthouse_page() {
  local path="$1"
  local url="${BASE_URL}${path}"
  local slug="$(slugify "$path")"
  local report="$REPORT_DIR/lighthouse-${slug}.json"

  info "lighthouse → $url"
  npx -y lighthouse "$url" \
    --output=json \
    --output-path="$report" \
    --only-categories=performance,accessibility,seo,best-practices \
    --chrome-flags="--headless --no-sandbox" \
    --form-factor=mobile \
    --quiet \
    --no-enable-error-reporting \
    2>/dev/null

  if [[ ! -f "$report" ]]; then
    fail "lighthouse failed for $url"
    return 1
  fi

  # Parse scores (multiply by 100, integer)
  local perf a11y seo bp
  perf=$(jq -r '.categories.performance.score * 100 | floor' "$report")
  a11y=$(jq -r '.categories.accessibility.score * 100 | floor' "$report")
  seo=$(jq -r  '.categories.seo.score * 100 | floor' "$report")
  bp=$(jq -r   '.categories["best-practices"].score * 100 | floor' "$report")

  local line=$(printf "  %-22s perf=%3s a11y=%3s seo=%3s bp=%3s" "$path" "$perf" "$a11y" "$seo" "$bp")
  echo "$line"

  [[ "$perf" -lt "$PERF_MIN_MOBILE" ]] && ((PERF_FAILS++)) || true
  [[ "$a11y" -lt "$A11Y_MIN" ]]        && ((A11Y_FAILS++)) || true
  [[ "$seo"  -lt "$SEO_MIN" ]]         && ((SEO_FAILS++)) || true
  [[ "$bp"   -lt "$BP_MIN" ]]          && ((BP_FAILS++)) || true

  # DOM-Health: count console errors from runtime audit
  local dom_err
  dom_err=$(jq -r '[.audits["errors-in-console"].details.items // [] | length] | add // 0' "$report" 2>/dev/null || echo 0)
  if [[ "$dom_err" -gt 0 ]]; then
    warn "  console errors: $dom_err on $path"
    DOM_ERRORS=$((DOM_ERRORS + dom_err))
  fi
}

# ── Audit B-deep: a11y violations extracted from Lighthouse JSON ─
# Note: Lighthouse uses axe-core internally — we read its audit details
# directly instead of running @axe-core/cli (avoids ChromeDriver-friction)
audit_a11y_deep_page() {
  local path="$1"
  local slug="$(slugify "$path")"
  local report="$REPORT_DIR/lighthouse-${slug}.json"

  [[ ! -f "$report" ]] && return

  # Count failing a11y audits (score < 1, that have details)
  local failing
  failing=$(jq -r '
    [.categories.accessibility.auditRefs[]
     | .id as $id
     | .audits[$id] // .
     | select(.score != null and .score < 1)
     | .id] | length' "$report" 2>/dev/null || echo 0)
  # Alternative simpler query
  failing=$(jq -r '[.audits | to_entries[] | select(.value.score != null and .value.score < 1 and (.value.scoreDisplayMode == "binary" or .value.scoreDisplayMode == "numeric")) | select(.key | test("aria|color-contrast|image-alt|button-name|link-name|label|tabindex|heading-order|document-title|html-lang|html-has-lang|landmark|list|listitem|meta-viewport|html-xml-lang|focus-traps|focusable-controls|interactive-element-affordance|logical-tab-order|managed-focus|use-landmarks|visual-order-follows-dom|custom-controls"))] | length' "$report" 2>/dev/null || echo 0)

  if [[ "$failing" -gt 0 ]]; then
    printf "  %-22s a11y-fails: %s\n" "$path" "$failing"
    # List the failing audits
    jq -r '.audits | to_entries[] | select(.value.score != null and .value.score < 1) | select(.key | test("aria|color-contrast|image-alt|button-name|link-name|label|tabindex|heading-order|document-title|html-lang|html-has-lang|landmark|list|listitem|meta-viewport|html-xml-lang|focus-traps|focusable-controls|interactive-element-affordance|logical-tab-order|managed-focus|use-landmarks|visual-order-follows-dom|custom-controls")) | "      · " + .key + ": " + .value.title' "$report" 2>/dev/null | head -10
    A11Y_VIOLATIONS=$((A11Y_VIOLATIONS + failing))
  fi
}

# ── Audit D: DSGVO-Storage local-grep ─────────────────
audit_dsgvo() {
  local report="$REPORT_DIR/dsgvo-audit.txt"
  {
    echo "# DSGVO-Storage-Audit — $TIMESTAMP"
    echo ""
    echo "## localStorage / sessionStorage / cookies usage"
    grep -rnE "localStorage|sessionStorage|document\.cookie" \
      --include="*.html" --include="*.js" \
      --exclude-dir=node_modules --exclude-dir=.git \
      --exclude-dir=design-archives --exclude-dir=_preview \
      --exclude-dir=design --exclude-dir=audit-reports \
      "$REPO_DIR" 2>/dev/null | grep -v "^Binary" || echo "(none)"
    echo ""
    echo "## External script/iframe loads (CDN risk)"
    grep -rnE '<script[^>]+src="https?://[^/"]*\.(google|googleapis|cloudflare|jsdelivr|unpkg|gstatic)' \
      --include="*.html" \
      --exclude-dir=design-archives --exclude-dir=_preview --exclude-dir=design \
      --exclude-dir=mail-templates \
      "$REPO_DIR" 2>/dev/null | grep -v "vendor/" || echo "(none)"
    echo ""
    echo "## External font/style links (Site only — mail-templates excluded, Brevo-context)"
    grep -rnE '<link[^>]+href="https?://fonts\.(google|gstatic)' \
      --include="*.html" --include="*.css" \
      --exclude-dir=design-archives --exclude-dir=_preview --exclude-dir=design \
      --exclude-dir=mail-templates \
      "$REPO_DIR" 2>/dev/null || echo "(none)"
  } > "$report"

  local ls_count cdn_count font_count
  ls_count=$(grep -cE "localStorage|sessionStorage|document\.cookie" "$report" 2>/dev/null || echo 0)
  cdn_count=$(grep -cE '<script[^>]+src="https?' "$report" 2>/dev/null || echo 0)
  font_count=$(grep -cE 'fonts\.google|fonts\.gstatic' "$report" 2>/dev/null || echo 0)

  info "storage refs: $ls_count   external CDN scripts: $cdn_count   external fonts: $font_count"

  if [[ "$font_count" -gt 0 ]]; then
    fail "Google Fonts loaded externally (DSGVO-risk) — see $report"
    DSGVO_ISSUES=$((DSGVO_ISSUES + font_count))
  else
    ok "no external Google Fonts (self-hosted fonts ✓)"
  fi
  ok "DSGVO report: $report"
}

# ── Audit E: Cross-Page-Konsistenz ────────────────────
audit_crosspage() {
  local report="$REPORT_DIR/cross-page-consistency.txt"
  {
    echo "# Cross-Page-Konsistenz — $TIMESTAMP"
    echo ""
    echo "## Wordmark check (VEGETARIANHULK Caps in topbar)"
    echo "--- Pages with lowercase 'vegetarian<em>hulk</em>' (review whether topbar or body): ---"
    grep -rnE 'vegetarian<em>hulk</em>' \
      --include="*.html" \
      --exclude-dir=design-archives --exclude-dir=_preview --exclude-dir=design \
      --exclude-dir=mail-templates \
      "$REPO_DIR" 2>/dev/null | head -30
    echo ""
    echo "--- Pages with UPPERCASE VEGETARIANHULK: ---"
    grep -rnE 'VEGETARIANHULK' \
      --include="*.html" --include="*.css" \
      --exclude-dir=design-archives --exclude-dir=_preview --exclude-dir=design \
      --exclude-dir=mail-templates \
      "$REPO_DIR" 2>/dev/null | head -20
    echo ""
    echo "## Topbar-Right-Pattern (Hamburger vs Zurück)"
    echo "--- Hamburger pattern: ---"
    grep -rnE 'class="(burger|hamburger|topbar-burger|nav-burger)"' \
      --include="*.html" \
      --exclude-dir=design-archives --exclude-dir=_preview --exclude-dir=design \
      --exclude-dir=mail-templates \
      "$REPO_DIR" 2>/dev/null | head -10
    echo ""
    echo "--- Zurück pattern: ---"
    grep -rnE 'topbar-back|← Zur|&larr; Zur' \
      --include="*.html" \
      --exclude-dir=design-archives --exclude-dir=_preview --exclude-dir=design \
      --exclude-dir=mail-templates \
      "$REPO_DIR" 2>/dev/null | head -10
    echo ""
    echo "## Footer-Minimum-Check (Impressum + Datenschutz + Instagram)"
    for page in index.html kooperationen.html newsletter/index.html danke.html 3-tage-reset/index.html 404.html impressum.html datenschutz.html; do
      local f="$REPO_DIR/$page"
      [[ ! -f "$f" ]] && continue
      local has_impressum has_datenschutz has_insta
      # Self-pages: skip own-link check (impressum.html shouldn't link to itself)
      if [[ "$page" == "impressum.html" ]]; then has_impressum="(self)"; else
        grep -qE 'href="[./]*impressum(\.html)?"' "$f" && has_impressum="✓" || has_impressum="✗"
      fi
      if [[ "$page" == "datenschutz.html" ]]; then has_datenschutz="(self)"; else
        grep -qE 'href="[./]*datenschutz(\.html)?"' "$f" && has_datenschutz="✓" || has_datenschutz="✗"
      fi
      grep -qE 'instagram\.com/vegetarianhulk' "$f" && has_insta="✓" || has_insta="✗"
      printf "  %-32s  Impressum=%s  Datenschutz=%s  Instagram=%s\n" \
        "$page" "$has_impressum" "$has_datenschutz" "$has_insta"
    done
    echo ""
    echo "## Forest-Token Legacy-Hex residue check"
    echo "--- alte rgba(45,106,62) (should be 0 in non-archive files): ---"
    grep -rnE "rgba\(45,? ?106,? ?62" \
      --include="*.html" --include="*.css" \
      --exclude-dir=design-archives --exclude-dir=_preview --exclude-dir=design \
      --exclude-dir=mail-templates --exclude-dir=audit-reports \
      "$REPO_DIR" 2>/dev/null | head -10 || echo "(none ✓)"
    echo ""
    echo "--- alte Hex #2d6a3e in body/style (not favicons): ---"
    grep -rnE "#2d6a3e" \
      --include="*.html" --include="*.css" \
      --exclude-dir=design-archives --exclude-dir=_preview --exclude-dir=design \
      --exclude-dir=mail-templates --exclude-dir=audit-reports \
      "$REPO_DIR" 2>/dev/null | grep -vE "fill='%232d6a3e'" | head -10 || echo "(none ✓)"
  } > "$report"

  # Score: count Footer-Minimum-Fails
  local footer_fails
  footer_fails=$(grep -cE "✗" "$report" 2>/dev/null || echo 0)
  CROSSPAGE_ISSUES=$footer_fails

  if [[ "$footer_fails" -gt 0 ]]; then
    warn "cross-page issues found: $footer_fails — see $report"
  else
    ok "cross-page consistency clean"
  fi
  ok "cross-page report: $report"
}

# ── Final Summary ─────────────────────────────────────
print_summary() {
  section "SUMMARY"
  echo "  Target: $BASE_URL"
  echo "  Report-Folder: $REPORT_DIR"
  echo ""
  printf "  %-32s %s\n" "Performance fails (<$PERF_MIN_MOBILE)" "$PERF_FAILS / ${#PAGES[@]} pages"
  printf "  %-32s %s\n" "a11y fails (<$A11Y_MIN)"             "$A11Y_FAILS / ${#PAGES[@]} pages"
  printf "  %-32s %s\n" "SEO fails (<$SEO_MIN)"               "$SEO_FAILS / ${#PAGES[@]} pages"
  printf "  %-32s %s\n" "Best-Practices fails (<$BP_MIN)"     "$BP_FAILS / ${#PAGES[@]} pages"
  printf "  %-32s %s\n" "a11y deep audit fails"                "$A11Y_VIOLATIONS"
  printf "  %-32s %s\n" "DSGVO-risk findings"                 "$DSGVO_ISSUES"
  printf "  %-32s %s\n" "cross-page issues"                   "$CROSSPAGE_ISSUES"
  printf "  %-32s %s\n" "DOM console errors"                  "$DOM_ERRORS"
  echo ""

  local total_critical=$((A11Y_VIOLATIONS + DSGVO_ISSUES + DOM_ERRORS))
  if [[ "$total_critical" -gt 0 ]] || [[ "$PERF_FAILS" -gt 2 ]]; then
    fail "AUDIT FAIL — critical issues found, review reports"
    return 1
  else
    ok "AUDIT PASS"
    return 0
  fi
}

# ── Main ──────────────────────────────────────────────
section "Pre-Merge Audit — $BASE_URL @ $TIMESTAMP"

section "A+B+C+F: Lighthouse (Performance · a11y · SEO · Best-Practices · DOM-Health)"
for path in "${PAGES[@]}"; do
  audit_lighthouse_page "$path"
done

section "B-deep: a11y violations (extracted from Lighthouse JSON, axe-core inside)"
for path in "${PAGES[@]}"; do
  audit_a11y_deep_page "$path"
done

section "D: DSGVO-Storage local-grep"
audit_dsgvo

section "E: Cross-Page-Konsistenz"
audit_crosspage

print_summary
