#!/usr/bin/env bash
# cc-rig hook: block-rm-rf — block dangerous commands
# Event: PreToolUse (Bash)
# Exit 2 = block the tool use
set -euo pipefail

# Read the tool input from stdin
INPUT=$(cat 2>/dev/null || echo "")

# Block dangerous rm commands
if echo "$INPUT" | grep -qE 'rm\s+(-[a-zA-Z]*)?r[a-zA-Z]*f[a-zA-Z]*\s+/($|\s)'; then
  echo "BLOCKED: rm -rf / is not allowed" >&2
  exit 2
fi

# Block rm -rf on home directory
if echo "$INPUT" | grep -qE 'rm\s+(-[a-zA-Z]*)?r[a-zA-Z]*f[a-zA-Z]*\s+~($|/)'; then
  echo "BLOCKED: rm -rf ~ is not allowed" >&2
  exit 2
fi

# Block DROP TABLE
if echo "$INPUT" | grep -qiE 'DROP\s+TABLE|DROP\s+DATABASE'; then
  echo "BLOCKED: DROP TABLE/DATABASE is not allowed" >&2
  exit 2
fi

# Block disk overwrite
if echo "$INPUT" | grep -qE '> /dev/sd[a-z]'; then
  echo "BLOCKED: disk overwrite is not allowed" >&2
  exit 2
fi

exit 0
