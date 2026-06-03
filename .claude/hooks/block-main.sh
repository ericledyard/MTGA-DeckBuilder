#!/usr/bin/env bash
# cc-rig hook: block-main — block push to main/master
# Event: PreToolUse (Bash matching git push)
# Exit 2 = block the tool use
set -euo pipefail

# Extract command from JSON input
INPUT=$(cat 2>/dev/null || echo '')
CMD=$(echo "$INPUT" | grep -oE '"command" *: *"[^"]*"' | head -1 | cut -d'"' -f4 2>/dev/null || true)

# Only check git push commands
if echo "$CMD" | grep -q "git push"; then
  # Block push to main or master
  if echo "$CMD" | grep -qE 'git push.*(main|master)($|\s)'; then
    echo "BLOCKED: direct push to main/master. Use a feature branch." >&2
    exit 2
  fi

  # Also block if current branch is main/master
  CURRENT_BRANCH=$(git branch --show-current 2>/dev/null || echo "")
  if [ "$CURRENT_BRANCH" = "main" ] || [ "$CURRENT_BRANCH" = "master" ]; then
    # Allow if pushing to a different remote branch
    if ! echo "$CMD" | grep -qE 'git push.*origin\s+[a-zA-Z]'; then
      echo "BLOCKED: pushing from main/master branch. Create a feature branch." >&2
      exit 2
    fi
  fi
fi

exit 0
