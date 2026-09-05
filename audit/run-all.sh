#!/usr/bin/env bash
# Rebuild the site and run the full measurement set sequentially (one browser at a time - RAM).
# Usage: audit/run-all.sh <label> [url]   -> results copied to audit/out/<label>/
set -u
LABEL="${1:?label}"; URL="${2:-http://127.0.0.1:4322}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
OUT="audit/out/$LABEL"; mkdir -p "$OUT"
echo "== build $(date +%T)"; npm run build >"$OUT/build.log" 2>&1 || { echo "BUILD FAILED"; tail -20 "$OUT/build.log"; exit 1; }
for b in chromium webkit; do
  echo "== measure $b $(date +%T)"
  node audit/measure.mjs --browser "$b" --url "$URL" >"$OUT/$b.log" 2>&1 || echo "measure $b rc=$?"
done
echo "== lighthouse $(date +%T)"; bash audit/lighthouse.sh "$URL" >"$OUT/lighthouse.log" 2>&1 || echo "lighthouse rc=$?"
cp audit/out/{chromium,webkit}-*.json audit/out/{chromium,webkit}-*.png audit/out/lighthouse-*.report.* "$OUT/" 2>/dev/null
echo "== done $(date +%T)"
