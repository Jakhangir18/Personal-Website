#!/usr/bin/env bash
# Build the three prototype branches into ~/work/proto-dist/<name> and serve each on 127.0.0.1:433x.
set -u
WT=/home/ubuntu/work/Personal-Website-proto; DST=$HOME/work/proto-dist; mkdir -p "$DST"
i=1
for br in proto/work-a proto/work-b proto/work-c; do
  name="${br#proto/}"; port=$((4330+i)); i=$((i+1))
  echo "== $br -> $port $(date +%T)"
  ( cd "$WT" && git checkout -q "$br" && cd works-only-project && npm run build >/dev/null 2>&1 && rm -rf "$DST/$name" && cp -r dist "$DST/$name" ) || { echo "BUILD FAILED $br"; continue; }
  pkill -f "http.server $port" 2>/dev/null
  ( cd "$DST/$name" && nohup python3 -m http.server "$port" --bind 127.0.0.1 >/dev/null 2>&1 & )
  sleep 1; curl -sfI "http://127.0.0.1:$port" >/dev/null && echo "serving $name on $port"
done
echo "== done"
