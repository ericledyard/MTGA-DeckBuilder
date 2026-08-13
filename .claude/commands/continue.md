---
description: Resume a session — read all memory, logs, and project state, then print a concise briefing on where we left off
allowed-tools: Read, Bash
---

You are starting a new session. Load all project context and print a crisp briefing. Do not make any changes.

## 1. Load team memory

Read these files in parallel:

- `memory/session-log.md` — what happened in recent sessions
- `memory/decisions.md` — architectural decisions in effect
- `memory/gotchas.md` — known issues and surprises
- `memory/patterns.md` — codified patterns
- `todo.md` (repo root) — pending tasks and current phase

## 2. Load personal auto-memory

Read all files in `~/.claude/projects/-Users-ericledyard-MTGA-Deck-Builder-MTGA-DeckBuilder/memory/` to pick up personal notes, feedback, and project state from previous sessions. Skip gracefully if the directory doesn't exist yet.

## 3. Check git state

Run these in parallel:

- `git status --short` — any uncommitted changes
- `git log --oneline -10` — recent commits to understand where code landed
- `git branch --show-current` — confirm active branch

## 4. Scan for open work

- Extract unchecked items from `todo.md`, noting which phase they belong to.
- Check `CLAUDE.md` "Current Context" section for any task noted there.

## 5. Print the session briefing

Output a structured block — keep it tight, no padding:

```
── Continue ─────────────────────────────────────
Branch:      <current branch>
Last commit: <hash + message>
Uncommitted: <none | list of files>

Last session (<date>):
  <one-sentence summary from session-log>

Active task:
  <task from todo.md or CLAUDE.md, or "none noted">

Pending todos:
  - <item 1>
  - <item 2>
  (none if empty)

Watch out for:
  <1–2 relevant gotchas if any apply to the active task, else "nothing flagged">

Key decisions in effect:
  <2–3 most recent or relevant decisions from decisions.md>
─────────────────────────────────────────────────
```

After the block, ask: **"Where do you want to pick up?"**

Do not propose plans, write code, or take any action beyond reading and printing the briefing.
