#!/usr/bin/env bash
# =============================================================================
# Automated Export Package Script
# Prepares a clean deployment archive for local server / PostgreSQL deployment
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
TIMESTAMP="$(date +'%Y%m%d_%H%M%S')"
EXPORT_DIR="$ROOT_DIR/export_bundle"
ARCHIVE_NAME="itsm_app_export_${TIMESTAMP}.tar.gz"

echo "=========================================================="
echo "📦 Preparing Local Server & PostgreSQL Export Package"
echo "=========================================================="

cd "$ROOT_DIR"

# 1. Clean previous build / export artifacts
rm -rf "$EXPORT_DIR"
mkdir -p "$EXPORT_DIR"

echo "1. Building production frontend & server bundle..."
npm run build

echo "2. Copying essential application files..."
# Root configuration files
cp package.json "$EXPORT_DIR/"
cp package-lock.json "$EXPORT_DIR/" 2>/dev/null || true
cp tsconfig.json "$EXPORT_DIR/"
cp vite.config.ts "$EXPORT_DIR/"
cp server.ts "$EXPORT_DIR/"
cp index.html "$EXPORT_DIR/"
cp Dockerfile "$EXPORT_DIR/"
cp docker-compose.yml "$EXPORT_DIR/"
cp .dockerignore "$EXPORT_DIR/"
cp .env.example "$EXPORT_DIR/"
cp init-db.sql "$EXPORT_DIR/"
cp DEPLOYMENT_LOCAL_POSTGRES.md "$EXPORT_DIR/"
cp windows-setup.bat "$EXPORT_DIR/" 2>/dev/null || true
cp windows-start.bat "$EXPORT_DIR/" 2>/dev/null || true

# Compiled dist directory
cp -r dist "$EXPORT_DIR/"

# Source code & database schemas
mkdir -p "$EXPORT_DIR/src"
cp -r src "$EXPORT_DIR/"

# Public assets
if [ -d "public" ]; then
  cp -r public "$EXPORT_DIR/"
fi

# Drizzle migrations
if [ -d "drizzle" ]; then
  cp -r drizzle "$EXPORT_DIR/"
fi

# Clean storage directories
mkdir -p "$EXPORT_DIR/asset archive"
mkdir -p "$EXPORT_DIR/ticket requests"
mkdir -p "$EXPORT_DIR/tickets archive"

echo "3. Creating compressed archive: $ARCHIVE_NAME..."
tar -czf "$ROOT_DIR/$ARCHIVE_NAME" -C "$EXPORT_DIR" .

# Clean temporary folder
rm -rf "$EXPORT_DIR"

echo "=========================================================="
echo "✅ Export complete!"
echo "   Archive generated: $ROOT_DIR/$ARCHIVE_NAME"
echo "   You can transfer this archive to your local server."
echo "=========================================================="
