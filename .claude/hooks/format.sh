#!/usr/bin/env bash
# cc-rig hook: format — auto-format after file write
# Event: PostToolUse (Write|Edit)
set -euo pipefail

# Extract file path from CC hook JSON input on stdin
FILE=$(cat | grep -oE '"file_path" *: *"[^"]*"' | head -1 | cut -d'"' -f4 2>/dev/null || true)

if [ -n "$FILE" ] && [ -f "$FILE" ]; then
  npx prettier --write "$FILE" 2>/dev/null || true
fi

exit 0
