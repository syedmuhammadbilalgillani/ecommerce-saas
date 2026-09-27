#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"

if [ "$(basename "$SCRIPT_DIR")" = "scripts" ]; then
  ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

cd "$ROOT_DIR"

echo "=================================================="
echo " Building api for Production"
echo " Directory: $ROOT_DIR"
echo "=================================================="

pnpm --filter api build

echo "✔ api build complete!"
