#!/usr/bin/env bash
# Build another checkout (git worktree), serve its dist on a spare port and run the same
# measurement set against it. Sequential: one build, one browser at a time (RAM budget).
# Usage: audit/measure-worktree.sh <label> <worktree-dir> <port>
set -u
LABEL="${1:?label}"; WT="${2:?worktree}"; PORT="${3:?port}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
OUT="audit/out/$LABEL"; mkdir -p "$OUT"
echo "== build $WT $(date +%T)"
( cd "$WT" && npm run build >"$ROOT/$OUT/build.log" 2>&1 ) || { echo "BUILD FAILED"; tail -20 "$OUT/build.log"; exit 1; }
( cd "$WT" && npx astro preview --host 127.0.0.1 --port "$PORT" >"$ROOT/$OUT/preview.log" 2>&1 ) &
PREVIEW_PID=$!
for i in $(seq 1 30); do curl -sfI "http://127.0.0.1:$PORT" >/dev/null && break; sleep 1; done
URL="http://127.0.0.1:$PORT"
for b in chromium webkit; do
  echo "== measure $b $(date +%T)"
  node audit/measure.mjs --browser "$b" --url "$URL" >"$OUT/$b.log" 2>&1 || echo "measure $b rc=$?"
done
echo "== lighthouse $(date +%T)"; bash audit/lighthouse.sh "$URL" >"$OUT/lighthouse.log" 2>&1 || echo "lighthouse rc=$?"
cp audit/out/{chromium,webkit}-*.json audit/out/{chromium,webkit}-*.png audit/out/lighthouse-*.report.* "$OUT/" 2>/dev/null
kill "$PREVIEW_PID" 2>/dev/null; pkill -P "$PREVIEW_PID" 2>/dev/null
echo "== done $(date +%T)"
