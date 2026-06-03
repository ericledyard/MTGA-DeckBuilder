---
description: Capture learnings and decisions to memory files
allowed-tools: Read, Write, Edit
---

$ARGUMENTS

Save the specified learning or decision to memory:

1. Determine if this is team-relevant or personal.
   - **Team** (architecture, patterns, gotchas, ownership): save to `memory/` files below.
   - **Personal** (local prefs, machine-specific notes): save to auto-memory instead.
2. Determine the category: decision, pattern, gotcha, or general.
3. Write a one-line entry to the appropriate file:
   - `memory/decisions.md` for architectural decisions
   - `memory/patterns.md` for discovered patterns
   - `memory/gotchas.md` for surprises and known issues
   - `memory/people.md` for ownership changes
4. Format: `[YYYY-MM-DD] Brief description`
5. If session-log.md has >20 entries, summarize older ones.

Keep entries concise. One line per learning. Team memory is git-tracked — everyone sees it.
