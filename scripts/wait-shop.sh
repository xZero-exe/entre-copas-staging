#!/usr/bin/env bash
set -euo pipefail
BASEURL="${BASEURL:-http://localhost:8080/}"
echo "Waiting for shop at $BASEURL ..."
for i in {1..90}; do
  code=$(curl -s -o /dev/null -w "%{http_code}" "$BASEURL" || true)
  if [ "$code" = "200" ] || [ "$code" = "302" ]; then
    echo "Shop is up ($code)"; exit 0
  fi
  sleep 2
done
echo "Timeout waiting for $BASEURL"
exit 1
