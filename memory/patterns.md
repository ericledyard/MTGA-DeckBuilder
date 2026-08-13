# Patterns (git-tracked, shared)

Discovered code patterns and established conventions. One line per entry.

Format: `[YYYY-MM-DD] Pattern: <description>`

<!-- Entries below -->
[2026-08-13] Pattern: sync local state to an external value during render, never in an effect — `react-hooks/set-state-in-effect` is an error in this repo. Two shapes in use: `useSyncedState(external)` in CardSearchFilters.tsx (compare-previous-value, for mirroring a URL param into a debounced input) and the `filterSignature` block in DeckEditor.tsx (JSON.stringify signature, for resetting page + loading when any filter changes). Use stringify not identity — an identity compare loops when a dep array is rebuilt each render.
[2026-08-13] Pattern: early-return guards must sit below every hook. CardPrintingsCarousel had `if (!active) return null` above three hooks, so any null render desynced hook order. Compute the guard value after the last hook.
[2026-08-13] Pattern: RPCs called with the user's cookie client are subject to RLS *and* to the per-role statement_timeout; RPCs called via `createServiceClient()` bypass both. `/api/cards/search` uses the service client and `/api/cards/lookup` uses the cookie client — which is why search kept working while import failed, and is the first thing to check when one card path breaks and another doesn't.
[2026-08-13] Pattern: never render a failed request as an empty result. Three separate bugs this session were the same shape — import said "88 not found", the card grid said "No cards found", and the expansion picker crashed — all because a non-2xx response or `{ error }` body was treated as data. Route side: retry transient failures, then return a non-2xx with a message. Client side: check `res.ok`, read the route's `error` field (not `statusText`), and render an error + Retry instead of the empty state.
