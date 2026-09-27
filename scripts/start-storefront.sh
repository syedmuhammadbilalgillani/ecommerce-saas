#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"

if [ "$(basename "$SCRIPT_DIR")" = "scripts" ]; then
  ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

cd "$ROOT_DIR"

APP_NAME="web"
DEFAULT_PORT=3000
PORT="${PORT:-$DEFAULT_PORT}"
NODE_ENV="production"
export NODE_ENV
export PORT

echo "=================================================="
echo " Starting $APP_NAME (Storefront) for Deployment"
echo " Environment: $NODE_ENV"
echo " Port:        $PORT"
echo " Directory:   $ROOT_DIR"
echo "=================================================="

if [ -f "$ROOT_DIR/.env" ]; then
  echo "✔ Found root .env configuration"
else
  echo "⚠ Warning: No root .env file found at $ROOT_DIR/.env"
fi

if [ "$1" = "--build" ] || [ "$BUILD" = "1" ] || [ ! -d "$ROOT_DIR/apps/$APP_NAME/.next" ]; then
  echo "📦 Building $APP_NAME for production..."
  pnpm --filter "$APP_NAME" build
fi

echo "🚀 Starting $APP_NAME on port $PORT..."
exec pnpm --filter "$APP_NAME" exec next start -p "$PORT"
