#!/usr/bin/env bash
# Run Lighthouse (mobile + desktop presets) against a running site, using the
# Chromium binary already installed under ~/.cache/ms-playwright (no system
# Chrome required). Saves HTML + JSON reports to audit/out/ and prints the
# Performance/Accessibility scores plus LCP, CLS, TBT for each preset.
#
# Usage: audit/lighthouse.sh [url]
#   default url: http://127.0.0.1:4321

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OUT_DIR="$SCRIPT_DIR/out"
mkdir -p "$OUT_DIR"

URL="${1:-http://127.0.0.1:4321}"

# Locate the Playwright-managed Chromium binary (headless-friendly, matches
# the browser Playwright itself launches for the measure.mjs harness).
CHROME_BIN=""
for candidate in "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux64/chrome "$HOME"/.cache/ms-playwright/chromium-*/chrome-linux/chrome; do
  if [ -x "$candidate" ]; then
    CHROME_BIN="$candidate"
    break
  fi
done

if [ -z "$CHROME_BIN" ]; then
  echo "Could not find a Playwright chromium binary under ~/.cache/ms-playwright" >&2
  exit 1
fi

export CHROME_PATH="$CHROME_BIN"

LIGHTHOUSE_BIN="$SCRIPT_DIR/node_modules/.bin/lighthouse"
if [ ! -x "$LIGHTHOUSE_BIN" ]; then
  echo "lighthouse not found in $SCRIPT_DIR/node_modules/.bin - run 'npm install' in audit/ first" >&2
  exit 1
fi

CHROME_FLAGS="--headless=new --no-sandbox --disable-gpu"

run_preset() {
  local preset="$1"
  local form_factor="$2"
  local screen_flags="$3"
  local out_base="$OUT_DIR/lighthouse-${preset}"

  echo "=== Lighthouse: ${preset} (${URL}) ==="
  "$LIGHTHOUSE_BIN" "$URL" \
    --chrome-flags="$CHROME_FLAGS" \
    --form-factor="$form_factor" \
    $screen_flags \
    --output=html --output=json \
    --output-path="$out_base" \
    --only-categories=performance,accessibility \
    --quiet \
    2>&1 | grep -v '^$' || true

  local json_file="${out_base}.report.json"
  if [ -f "$json_file" ]; then
    node -e '
      const fs = require("fs");
      const r = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
      const cat = r.categories;
      const audits = r.audits;
      const perf = cat.performance ? Math.round(cat.performance.score * 100) : "n/a";
      const a11y = cat.accessibility ? Math.round(cat.accessibility.score * 100) : "n/a";
      const lcp = audits["largest-contentful-paint"] ? audits["largest-contentful-paint"].displayValue : "n/a";
      const cls = audits["cumulative-layout-shift"] ? audits["cumulative-layout-shift"].displayValue : "n/a";
      const tbt = audits["total-blocking-time"] ? audits["total-blocking-time"].displayValue : "n/a";
      console.log(`[${process.argv[2]}] Performance=${perf} Accessibility=${a11y} LCP=${lcp} CLS=${cls} TBT=${tbt}`);
    ' "$json_file" "$preset"
  else
    echo "[$preset] Lighthouse run produced no JSON report" >&2
  fi
}

run_preset "mobile" "mobile" ""
run_preset "desktop" "desktop" "--screenEmulation.disabled --throttling.cpuSlowdownMultiplier=1"

echo "Reports written to $OUT_DIR/lighthouse-mobile.report.{html,json} and $OUT_DIR/lighthouse-desktop.report.{html,json}"
