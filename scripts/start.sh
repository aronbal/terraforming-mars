#!/usr/bin/env bash
# Builds whatever is missing or out of date, then serves the game.
#
# The point of this script is that `npm start` alone serves a stale or
# half-built tree without saying so: the server needs generated CSS and card
# JSON that a plain TypeScript compile does not produce.
#
#   bash scripts/start.sh              # build if needed, then serve
#   bash scripts/start.sh --rebuild    # force a full rebuild first
#   bash scripts/start.sh --port 3000  # serve somewhere other than 8080
set -euo pipefail

cd "$(dirname "$0")/.."

PORT="${PORT:-8080}"
force_rebuild=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --rebuild) force_rebuild=true; shift ;;
    --port) PORT="${2:?--port needs a number}"; shift 2 ;;
    -h|--help) sed -n '2,10p' "$0" | sed 's/^# \?//'; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 1 ;;
  esac
done

say() { printf '\n\033[1m==> %s\033[0m\n' "$1"; }

if ! command -v node >/dev/null 2>&1; then
  echo "node is not installed. This project needs Node $(cat .nvmrc 2>/dev/null || echo 22)." >&2
  exit 1
fi

node_major="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$node_major" -lt 22 ]]; then
  echo "Node $node_major is too old; this project needs 22 or newer." >&2
  exit 1
fi

if [[ ! -d node_modules ]]; then
  say "Installing dependencies (first run only, takes a few minutes)"
  npm install
fi

# These three are the outputs a working server needs. The client bundle and the
# card JSON come from the webpack build; styles.css comes from Less.
needs_build=false
for artifact in build/src/server/server.js build/styles.css src/genfiles/cards.json; do
  if [[ ! -f "$artifact" ]]; then
    needs_build=true
  fi
done

# A source file newer than the compiled server means the build is stale.
if [[ "$needs_build" == false && -f build/src/server/server.js ]]; then
  if [[ -n "$(find src -name '*.ts' -newer build/src/server/server.js -print -quit)" ]]; then
    needs_build=true
  fi
fi

if [[ "$force_rebuild" == true || "$needs_build" == true ]]; then
  say "Building (a few minutes the first time)"
  npm run build
else
  say "Build is up to date"
fi

say "Serving on http://localhost:${PORT}"
cat <<'HOWTO'
To play against the computer:
  1. Click NEW GAME
  2. Choose 2 players
  3. Tick "Computer opponent" on the second seat and pick a difficulty
  4. Click Create game, then click your own name in the player list

Press Ctrl+C to stop the server.
HOWTO

PORT="$PORT" exec node build/src/server/server.js
