/**
 * Browser-local deck storage for the Stateless Deck Builder.
 *
 * Decks built at /builder never touch the database — they live in this
 * browser, in this profile, and are read back on the next visit. That is the
 * whole point of the feature: no account, no sync, export when you're done.
 *
 * localStorage rather than a cookie. A 100-card deck carries its card display
 * data (name, mana cost, type line, image URL) so the editor can render it
 * without a round trip, which lands around 25KB — comfortably inside
 * localStorage's multi-megabyte budget and several times over a cookie's 4KB
 * limit. Nothing here is sent to the server, so a cookie would buy nothing.
 *
 * Every read is cached and every write bumps a version counter, because these
 * feed `useSyncExternalStore`: React re-invokes getSnapshot on each render and
 * will loop forever if it returns a fresh object each time.
 */

import type { CardRowData } from "@/components/decks/DeckCardRow";

const PREFIX = "mtga:builder:v1";
const INDEX_KEY = `${PREFIX}:index`;
const deckKey = (id: string) => `${PREFIX}:deck:${id}`;

export interface LocalDeck {
  id: string;
  name: string;
  format: string;
  description: string | null;
  updated_at: string;
  deck_cards: CardRowData[];
}

export interface LocalDeckSummary {
  id: string;
  name: string;
  format: string;
  updated_at: string;
  card_count: number;
}

/**
 * localStorage throws rather than returning null when it is unavailable —
 * Safari private browsing, a storage quota, or a browser configured to block
 * site data. Callers surface this instead of silently losing a deck.
 */
export function isStorageAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const probe = `${PREFIX}:probe`;
    window.localStorage.setItem(probe, "1");
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
}

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // Corrupt or unreadable entry — treat as absent rather than crashing the
    // page. A deck that cannot be parsed is already lost; taking the editor
    // down with it helps nobody.
    return null;
  }
}

function writeJson(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// --- snapshot caching -------------------------------------------------------

const listeners = new Set<() => void>();
let indexCache: LocalDeckSummary[] | null = null;
const deckCache = new Map<string, LocalDeck | null>();

const EMPTY_INDEX: LocalDeckSummary[] = [];

function invalidate() {
  indexCache = null;
  deckCache.clear();
}

function emit() {
  invalidate();
  for (const listener of listeners) listener();
}

/** Subscribe for `useSyncExternalStore`. Also picks up writes from other tabs. */
export function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  const onStorage = (e: StorageEvent) => {
    if (e.key === null || e.key.startsWith(PREFIX)) emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onStorage);
  };
}

/** Stable snapshot of the deck index. Cached — see the note at the top. */
export function getDeckIndex(): LocalDeckSummary[] {
  if (indexCache === null) {
    indexCache = readJson<LocalDeckSummary[]>(INDEX_KEY) ?? EMPTY_INDEX;
  }
  return indexCache;
}

/** SSR snapshot. Always the same reference, so hydration sees no change. */
export function getServerDeckIndex(): LocalDeckSummary[] {
  return EMPTY_INDEX;
}

/** Stable snapshot of one deck. Cached — see the note at the top. */
export function getDeck(id: string): LocalDeck | null {
  if (!deckCache.has(id)) {
    deckCache.set(id, readJson<LocalDeck>(deckKey(id)));
  }
  return deckCache.get(id) ?? null;
}

export function getServerDeck(): LocalDeck | null {
  return null;
}

// --- mutations --------------------------------------------------------------

function writeIndex(entries: LocalDeckSummary[]): boolean {
  return writeJson(INDEX_KEY, entries);
}

function summarize(deck: LocalDeck): LocalDeckSummary {
  return {
    id: deck.id,
    name: deck.name,
    format: deck.format,
    updated_at: deck.updated_at,
    card_count: deck.deck_cards.reduce(
      (sum, row) => sum + (row.is_sideboard ? 0 : row.quantity),
      0,
    ),
  };
}

/**
 * Persist a deck and refresh its index entry. Returns false when the write was
 * rejected (quota, blocked storage) so the caller can warn instead of leaving
 * the user to discover the loss on reload.
 */
export function saveDeck(deck: LocalDeck): boolean {
  const stamped: LocalDeck = { ...deck, updated_at: new Date().toISOString() };
  if (!writeJson(deckKey(stamped.id), stamped)) return false;

  const summary = summarize(stamped);
  const others = getDeckIndex().filter((d) => d.id !== stamped.id);
  const ok = writeIndex([summary, ...others]);
  emit();
  return ok;
}

export function createDeck(
  name: string,
  format: string,
  description: string | null = null,
): LocalDeck | null {
  const deck: LocalDeck = {
    id: crypto.randomUUID(),
    name,
    format,
    description,
    updated_at: new Date().toISOString(),
    deck_cards: [],
  };
  return saveDeck(deck) ? deck : null;
}

export function deleteDeck(id: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(deckKey(id));
  } catch {
    // Nothing useful to do — fall through and drop the index entry anyway so
    // the deck stops appearing in the list.
  }
  writeIndex(getDeckIndex().filter((d) => d.id !== id));
  emit();
}

/** Replace a deck's cards, leaving its name and format untouched. */
export function saveDeckCards(id: string, cards: CardRowData[]): boolean {
  const deck = getDeck(id);
  if (!deck) return false;
  return saveDeck({ ...deck, deck_cards: cards });
}
