#!/usr/bin/env bash
# Starts OA Lab inside its container: migrate the DB, then run API (4000) and web UI (3000).
set -e
cd /app
mkdir -p /app/data
# Keep the SQLite DB on the persistent data volume.
ln -sf /app/data/oa-lab.db /app/prisma/oa-lab.db
(cd apps/api && npx prisma migrate deploy >/dev/null)

if ! docker info >/dev/null 2>&1; then
  echo "!! Cannot reach Docker. Start Docker Desktop and mount the socket: -v /var/run/docker.sock:/var/run/docker.sock"
fi
if [ -z "$OA_HOST_DATA_DIR" ]; then
  echo "!! OA_HOST_DATA_DIR is not set — sandbox containers need the HOST path of the data directory."
fi

node apps/api/dist/main.js &
API=$!
(cd apps/web && npx next start -p 3000 -H 0.0.0.0) &
WEB=$!

echo ""
echo "  ┌──────────────────────────────────────────────┐"
echo "  │  OA Lab is starting → http://localhost:3000  │"
echo "  └──────────────────────────────────────────────┘"
echo "  First start builds sandbox images and imports practice repos (a few minutes)."
echo ""
trap 'kill $API $WEB 2>/dev/null' INT TERM
wait -n $API $WEB 2>/dev/null || wait $API $WEB
kill $API $WEB 2>/dev/null || true
exit 1
