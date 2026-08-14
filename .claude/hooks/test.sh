#!/usr/bin/env bash
# cc-rig hook: test — run the test suite before git commit
# Event: PreToolUse (Bash matching git commit)
set -euo pipefail

# Read the tool input from stdin
INPUT=$(cat 2>/dev/null || echo "")

# Only run on git commit commands
if echo "$INPUT" | grep -q "git commit"; then
  # `pnpm test` is turbo -> vitest run. Capture the exit code with an explicit
  # `|| RC=$?`: reading `$?` after an `if` gives the status of the `if` itself,
  # not the command inside it, which silently makes the gate fail-open.
  RC=0
  OUTPUT=$(pnpm test 2>&1) || RC=$?
  if [ "$RC" -eq 0 ]; then
    exit 0
  fi
  LINES=$(echo "$OUTPUT" | wc -l)
  if [ "$LINES" -gt 30 ]; then
    echo "$OUTPUT" | tail -30
    echo "... ($LINES total lines, showing last 30)"
  else
    echo "$OUTPUT"
  fi
  exit $RC
fi

exit 0
