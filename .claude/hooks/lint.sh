#!/usr/bin/env bash
# cc-rig hook: lint — lint before git commit
# Event: PreToolUse (Bash matching git commit)
set -euo pipefail

# Read the tool input from stdin
INPUT=$(cat 2>/dev/null || echo "")

# Only run on git commit commands
if echo "$INPUT" | grep -q "git commit"; then
  OUTPUT=$(npm run lint 2>&1) && exit 0
  RC=$?
  LINES=$(echo "$OUTPUT" | wc -l)
  if [ "$LINES" -gt 20 ]; then
    echo "$OUTPUT" | head -20
    echo "... ($LINES total lines, showing first 20)"
  else
    echo "$OUTPUT"
  fi
  exit $RC
fi

exit 0
