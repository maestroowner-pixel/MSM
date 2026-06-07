#!/usr/bin/env bash
# Sync the shared source into the separate Windows build copy.
# The Windows native project (windows/) and node_modules in MSM_Windows are
# preserved — only app source/config is mirrored from the main project.
#
# Usage:  bash scripts/sync-windows.sh
set -euo pipefail

SRC="$(cd "$(dirname "$0")/.." && pwd)"
DST="/Users/Inspector/MSM_Windows"

rsync -a \
  --exclude='.git/' \
  --exclude='node_modules/' \
  --exclude='ios/' \
  --exclude='android/' \
  --exclude='windows/' \
  --exclude='credentials/' \
  --exclude='.expo/' \
  --exclude='dist/' \
  --exclude='*.log' \
  --exclude='*.binlog' \
  --exclude='.DS_Store' \
  "$SRC"/ "$DST"/

echo "Synced source → $DST (windows/ and node_modules preserved)."
