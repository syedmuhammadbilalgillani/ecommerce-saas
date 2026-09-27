#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR"

if [ "$(basename "$SCRIPT_DIR")" = "scripts" ]; then
  ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
fi

cd "$ROOT_DIR"

TARGET="${1:-all}"

echo "=================================================="
echo " Building POSflow Project: $TARGET"
echo " Directory: $ROOT_DIR"
echo "=================================================="

case "$TARGET" in
  merchant|merchant-admin)
    echo "📦 Building merchant-admin..."
    pnpm --filter merchant-admin build
    ;;
  platform|platform-admin)
    echo "📦 Building platform-admin..."
    pnpm --filter platform-admin build
    ;;
  api)
    echo "📦 Building api..."
    pnpm --filter api build
    ;;
  web|storefront)
    echo "📦 Building web storefront..."
    pnpm --filter web build
    ;;
  all)
    echo "📦 Building all apps and packages via Turbo..."
    pnpm build
    ;;
  *)
    echo "Unknown target: $TARGET"
    echo "Usage: ./build.sh [all|merchant|platform|api|web]"
    exit 1
    ;;
esac

echo "✔ Build finished successfully!"
