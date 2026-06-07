# Session Log (git-tracked, shared)

Brief log of what was done each session. Keep only the last 20 entries.
Older entries should be summarized into a single "history" line.

Format: `[YYYY-MM-DD] <one-line summary of session>`

<!-- Entries below -->

[2026-06-03] Session 1: Phase 1 complete — Supabase provisioned, Scryfall sync (114k cards), card browser + detail page live in production
[2026-06-03] Session 2: Card browser advanced filters (color/CMC/rarity/type/expansion), mana symbol SVGs, printings carousel with zoom fix, migration 003 deployed
[2026-06-04] Session 3: Phase 2 complete — Supabase auth, deck CRUD API, MTGA split-pane deck editor (card grid + deck list), fixed multiple React 19 error boundary crashes, corrected Brawl format rules (100 cards)
[2026-06-04] Session 4: Phase 2.5 — default sort CMC/name, filter persistence via URL params, oracle text keyword search on card browser + deck editor, fixed all hook absolute paths in settings.json
[2026-06-04] Session 5: Phase 2.6 — hover zoom in deck editor, filter panels collapsed behind Filters button, 350ms search debounce, full CMC/Rarity/Type/Expansion filters in deck editor, deploy workflow fixed (PR→merge pipeline), global CLAUDE.md created
[2026-06-05] Session 6: Phase 2.7 — Clear list + Undo button, deck list import modal (MTGA/MTGO/Moxfield), fixed PostgREST comma-in-name bug with lookup_cards_by_names RPC (PRs #10–12)
[2026-06-05] Session 7: Phase 2.8 — Scryfall sync cron live, set_type filter, stream-json replaced with node:readline, import precision (set+collector lookup), PRs #13–21
[2026-06-05] Session 8: Phase 2.9 — Full commander support: migration 008 (is_commander + keywords), parser/validator/editor/import all updated, card image click-to-preview, commander counts as 1 of 100 (PRs #22–24)
[2026-06-07] Session 12: Phase 3 complete — Supabase PAT fixed (CLI works from Bash), migration 012, /collection page, import modal, card grid +/− controls, "Collection" toggle in deck editor (PRs #37–38)
