#!/usr/bin/env bash
# cc-rig hook: block-env — block writing sensitive files
# Event: PreToolUse (Write|Edit)
# Exit 2 = block the tool use
set -euo pipefail

# Extract file_path from JSON input
INPUT=$(cat 2>/dev/null || echo '')
FILE_PATH=$(echo "$INPUT" | grep -oE '"file_path" *: *"[^"]*"' | head -1 | cut -d'"' -f4 2>/dev/null || true)

[ -z "$FILE_PATH" ] && exit 0

# Check for sensitive file patterns in the path only
BLOCKED_PATTERNS=(
  "\.env$"
  "\.env\.local$"
  "\.env\.production$"
  "credentials"
  "secrets"
  "\.pem$"
  "\.key$"
  "id_rsa"
  "id_ed25519"
)

for pattern in "${BLOCKED_PATTERNS[@]}"; do
  if echo "$FILE_PATH" | grep -qiE "$pattern"; then
    echo "BLOCKED: writing to sensitive file matching $pattern" >&2
    exit 2
  fi
done

exit 0
