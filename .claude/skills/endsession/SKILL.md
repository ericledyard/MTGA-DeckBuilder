---
name: endsession
description: End the current coding session — updates todo.md with current phase progress and checked tasks, syncs memory files so the next session has full context, commits todo.md to git, and prints a handoff summary. Use this skill whenever the user says /endsession, "end session", "wrap up", "let's stop here", "save progress", or "I'm done for today". Always invoke this skill at session end — never just summarize in chat without actually writing the files.
---

# End Session

Save all session progress to `todo.md` and memory files so the next terminal/session can pick up with zero lost context.

**Announce at start:** "Running /endsession — saving progress and syncing memory."

---

## Step 1: Gather session state

Before writing anything, collect:

- Current git branch (`git branch --show-current`)
- What was completed this session (review the conversation)
- Any new gotchas, rules, or decisions made
- What's blocked or waiting on the user
- What Phase 2 work starts next

---

## Step 2: Update `todo.md` in the project root

Read the current `todo.md` first, then update it. Keep the full file intact — only change what changed this session:

- Mark completed tasks with `[x]` (change `[ ]` to `[x]`)
- Add any new tasks discovered this session under the right phase
- Add new entries to the **Gotchas & Rules** section if rules were established
- Update the `_Last updated_` date at the top
- Update the active branch name if it changed

Keep the structure, headings, and all existing content. This file is the single source of truth for project state — do not truncate or rewrite sections that didn't change.

---

## Step 3: Update memory files

Memory files live at:

```
~/.claude/projects/-Users-ericledyard-MTGA-DeckBuilder/memory/
```

### Always update: `project_status.md`

Replace the **Current state** and **Immediate next actions** sections with what's true right now:

- Active branch
- What was just completed
- What's blocked (user action required vs. code work)
- What starts next session

### Update if new rules were established: `gotchas_and_rules.md`

If this session produced any new gotchas, API quirks, tool behavior surprises, or project conventions — add them. Format:

```
**Rule:** [the rule]
**Why:** [why it exists — what went wrong or what was decided]
**How to apply:** [when this kicks in]
```

### Update `MEMORY.md` index only if a new memory file was created

Add one line per new file: `- [Title](filename.md) — one-line hook`

---

## Step 4: Commit `todo.md`

Stage and commit only `todo.md` (memory files are outside the repo):

```bash
git add todo.md
git commit -m "chore: update session todo and progress [date]"
```

If the cc-rig hook blocks a direct push to main, do not push — just commit locally. The commit records the state; pushing can happen via PR when the user is ready.

Do **not** stage unrelated files. Do **not** push.

---

## Step 5: Print handoff summary

Print a concise summary in this format:

```
## Session saved ✓

**Branch:** [branch name]
**Completed this session:**
- [bullet list of what was done]

**Blocked — user action needed:**
- [anything the user must do before code work continues]

**Next session starts with:**
- [first task to pick up]

**Files updated:**
- todo.md (committed)
- memory/project_status.md
- memory/gotchas_and_rules.md (if changed)
```

---

## Rules for this skill

- Always read the existing file before writing — never overwrite blindly.
- Never truncate sections that didn't change.
- Never push to remote — commit only.
- If git is not initialized in the project root, skip the commit step and note it in the summary.
- Memory file paths use the project slug format: `/Users/[username]` becomes `-Users-[username]-` in the path. For this project the slug is `-Users-ericledyard-MTGA-DeckBuilder`.
