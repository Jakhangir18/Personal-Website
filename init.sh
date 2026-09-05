#!/usr/bin/env bash
# One-shot environment check for Personal-Website. Safe to run every session.
set -u
cd "$(dirname "$0")"
echo "== node $(node -v) npm $(npm -v) =="
echo "== install =="
npm install --no-audit --no-fund --loglevel=error || { echo "INSTALL FAILED"; exit 1; }
echo "== astro check =="
if npx astro check >/tmp/astro-check.log 2>&1; then
  echo "astro check: OK"; CHECK=0
else
  tail -15 /tmp/astro-check.log; CHECK=1
fi
echo "== build =="
if npm run build >/tmp/astro-build.log 2>&1; then
  echo "build: OK ($(du -sh dist 2>/dev/null | cut -f1))"; BUILD=0
else
  tail -25 /tmp/astro-build.log; BUILD=1
fi
echo "== features =="
node -e 'const f=require("./features.json");for(const x of f)console.log((x.passes?"[x] ":"[ ] ")+x.id+" "+x.title)'
echo "== progress (tail) =="
tail -5 claude-progress.txt 2>/dev/null || echo "(no progress yet)"
exit $(( CHECK + BUILD ))
