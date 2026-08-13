---
description: Wrap up the current session — update memory, session log, and todo — so it's safe to exit and start fresh
allowed-tools: Read, Write, Edit, Bash
---

You are closing out this terminal session. Do the following steps in order:

## 1. Check deployment status

- If there is a Vercel deployment in progress or recently completed this session, note the final state (READY / ERROR / still building).

## 2. Update `memory/session-log.md`

- Add a one-line entry for today's session: `[YYYY-MM-DD] Session <n>: <summary of what was done>`
- Keep the format consistent with existing entries — they are numbered sequentially and reference PR numbers where relevant.
- If there are more than 20 entries, summarize the oldest ones into a single "history" line.

## 3. Update team memory files as needed

Check whether anything from this session should be persisted:

- `memory/decisions.md` — any new architectural or design decisions made
- `memory/patterns.md` — any new patterns discovered or codified
- `memory/gotchas.md` — any new surprises, bugs, or known issues uncovered
- Only write entries for things that are **non-obvious and would help a future session** — skip anything already in code or git history.

## 4. Update personal auto-memory

Check `~/.claude/projects/-Users-ericledyard-MTGA-Deck-Builder-MTGA-DeckBuilder/memory/` for any personal notes that should be updated (feedback, user preferences, project state). Create the directory if it doesn't exist.

## 5. Check for uncommitted changes

- Run `git status --short`
- If there are uncommitted edits to tracked files, warn the user explicitly: list the files and ask whether to commit before exiting.
- Untracked files (build artifacts, downloaded reports, etc.) are fine to leave.

## 6. Update `todo.md`

- Review `todo.md` at the repo root and check off items completed this session.
- Update the current phase marker if the session advanced it.

## 7. Print a clean handoff summary

Output a short block the user can read at a glance:

```
── Session wrap-up ──────────────────────────────
Deploy:      [READY ✓ | ERROR ✗ | still building… | n/a]
Committed:   [yes / no — files if no]
Memory:      [updated / nothing new]
Next up:     [top 1–3 pending tasks]
─────────────────────────────────────────────────
```

That's it. Don't make changes beyond what's listed above.
