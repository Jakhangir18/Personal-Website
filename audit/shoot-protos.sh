#!/usr/bin/env bash
# Build each prototype branch in the proto worktree's works-only-project, serve it, and capture
# screenshots + Chromium metrics into audit/out/proto/<branch>/. Sequential (RAM budget).
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"; cd "$ROOT"
WT=/home/ubuntu/work/Personal-Website-proto; PORT=4324
for br in proto/work-a proto/work-b proto/work-c; do
  name="${br#proto/}"; OUT="audit/out/proto/$name"; mkdir -p "$OUT"
  echo "== $br $(date +%T)"
  ( cd "$WT" && git checkout -q "$br" && cd works-only-project && npm run build >"$ROOT/$OUT/build.log" 2>&1 ) || { echo "BUILD FAILED $br"; tail -10 "$OUT/build.log"; continue; }
  ( cd "$WT/works-only-project" && npx astro preview --host 127.0.0.1 --port $PORT >"$ROOT/$OUT/preview.log" 2>&1 ) & PID=$!
  for i in $(seq 1 30); do curl -sfI "http://127.0.0.1:$PORT" >/dev/null && break; sleep 1; done
  for b in chromium webkit; do
    node audit/measure.mjs --browser $b --url "http://127.0.0.1:$PORT" >"$OUT/$b.log" 2>&1 || echo "measure $b rc=$?"
  done
  cp audit/out/{chromium,webkit}-*.json audit/out/{chromium,webkit}-*.png "$OUT/" 2>/dev/null
  kill $PID 2>/dev/null; pkill -P $PID 2>/dev/null; sleep 1
done
echo "== done $(date +%T)"
