#!/usr/bin/env bash
# cc-rig hook: stop-validator — check work before stopping
# Event: Stop
set -euo pipefail

# Only warn if there are uncommitted changes
if ! git diff --quiet 2>/dev/null || ! git diff --cached --quiet 2>/dev/null; then
  echo "WARNING: uncommitted changes."
fi

exit 0
