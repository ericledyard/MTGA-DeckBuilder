# Decisions (git-tracked, shared)

Architectural decisions and rationale. One line per entry.

Format: `[YYYY-MM-DD] Decision: <description> — Reason: <why>`

<!-- Entries below -->
[2026-08-13] Decision: push directly to main; no feature branches or PRs — Reason: hobby project, and Vercel auto-deploys from main. The cc-rig `block-main` hook is unregistered in .claude/settings.json (script kept on disk so it is a one-line revert). Note PRs #1-52 in earlier session logs predate this.
[2026-08-13] Decision: gate `images.unoptimized` to development rather than converting card art to raw <img> or dropping next/image — Reason: keeps Vercel's image optimization in production, where it works, while sidestepping Scryfall's User-Agent block locally. Two lines, no component changes.
[2026-08-13] Decision: `.claude/skills/project-patterns` is the authority on conventions, over agent_docs/conventions.md — Reason: conventions.md claims kebab-case component files but the tree has always used PascalCase; project-patterns was written from the actual tree.
[2026-08-13] Decision: gh + supabase installed as user-local binaries in ~/.local/bin rather than via Homebrew — Reason: Homebrew was absent and its installer needs sudo, which could not run unattended. Homebrew is now installed, so these can be migrated to `brew install gh supabase/tap/supabase` whenever convenient; upgrades are manual re-downloads until then.
