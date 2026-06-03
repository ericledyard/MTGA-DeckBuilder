#!/usr/bin/env bash
# cc-rig hook: session-context — print project context at session start
# Event: SessionStart
set -euo pipefail

echo 'Project context files:'
for f in agent_docs/architecture.md agent_docs/conventions.md agent_docs/testing.md agent_docs/deployment.md; do
  [ -f "$f" ] && echo "  $f"
done

if [ -d "memory" ]; then
  echo 'Team memory files:'
  for f in memory/decisions.md memory/session-log.md; do
    [ -f "$f" ] && echo "  $f"
  done
fi

echo 'cc-rig | standard + nextjs | 8 plugins, 9 hooks | /cc-rig for recipes + savings'

# Platform-loop return trigger: nudge a weekly retro if it has been
# >=7 days since the last retro (or since init when no retro yet).
if command -v python3 >/dev/null 2>&1 && [ -f .claude/cc-rig-state.json ]; then
python3 - <<'PYEOF'
import json, sys
from datetime import datetime, timezone
try:
    s = json.load(open('.claude/cc-rig-state.json'))
except Exception:
    sys.exit(0)
ref = s.get('last_retro') or s.get('created_at')
if not ref:
    sys.exit(0)
try:
    t = datetime.fromisoformat(str(ref).replace('Z', '+00:00'))
except Exception:
    sys.exit(0)
if t.tzinfo is None:
    t = t.replace(tzinfo=timezone.utc)
days = (datetime.now(timezone.utc) - t).days
if days >= 7:
    what = 'last retro' if s.get('last_retro') else 'cc-rig init'
    print(f'cc-rig | {days}d since {what}. Run /cc-rig retro for your weekly drift + savings review.')
PYEOF
fi

exit 0
