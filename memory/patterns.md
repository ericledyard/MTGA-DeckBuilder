# Patterns (git-tracked, shared)

Discovered code patterns and established conventions. One line per entry.

Format: `[YYYY-MM-DD] Pattern: <description>`

<!-- Entries below -->
[2026-08-13] Pattern: sync local state to an external value during render, never in an effect — `react-hooks/set-state-in-effect` is an error in this repo. Two shapes in use: `useSyncedState(external)` in CardSearchFilters.tsx (compare-previous-value, for mirroring a URL param into a debounced input) and the `filterSignature` block in DeckEditor.tsx (JSON.stringify signature, for resetting page + loading when any filter changes). Use stringify not identity — an identity compare loops when a dep array is rebuilt each render.
[2026-08-13] Pattern: early-return guards must sit below every hook. CardPrintingsCarousel had `if (!active) return null` above three hooks, so any null render desynced hook order. Compute the guard value after the last hook.
