/**
 * Where a deck editor writes its changes.
 *
 * The editor is identical whether a deck lives in Supabase or in the browser,
 * so the difference is isolated here rather than forked into a second copy of
 * DeckEditor.
 *
 * The two implementations persist at different granularities, and each no-ops
 * the half it does not use:
 *
 *   - the API store writes **deltas** (`setQuantity`, `addCards`, …) as
 *     fire-and-forget requests, matching the existing /api/decks endpoints;
 *     it ignores `persist`.
 *   - the local store writes a **snapshot** through `persist`, driven by an
 *     effect on the editor's card state, so what is stored is always exactly
 *     what is rendered — no chance of the two drifting apart. It ignores the
 *     delta methods.
 */

import type { CardRowData } from "@/components/decks/DeckCardRow";
import * as local from "@/lib/builder/storage";

export interface DeckStore {
  /** Which backing store this is. The editor uses it for copy, not behavior. */
  kind: "api" | "local";
  /** Where "back to decks" and post-delete navigation should land. */
  listHref: string;

  /** Set a card to an exact quantity; quantity <= 0 removes it. */
  setQuantity(row: CardRowData): void;
  /** Add cards on top of whatever is already in the deck. */
  addCards(rows: CardRowData[]): void;
  /** Remove every card, keeping the deck itself. */
  clearCards(): Promise<void>;
  /** Remove the deck entirely. */
  deleteDeck(): Promise<void>;
  /** Snapshot the full card list. */
  persist(cards: CardRowData[]): void;
}

export function createApiDeckStore(deckId: string): DeckStore {
  const cardsUrl = `/api/decks/${deckId}/cards`;

  return {
    kind: "api",
    listHref: "/decks",

    setQuantity(row) {
      fetch(cardsUrl, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oracle_id: row.oracle_id,
          quantity: row.quantity,
          is_sideboard: row.is_sideboard,
          is_commander: row.is_commander,
        }),
      }).catch(() => {});
    },

    addCards(rows) {
      for (const row of rows) {
        fetch(cardsUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            oracle_id: row.oracle_id,
            quantity: row.quantity,
            is_sideboard: row.is_sideboard,
            is_commander: row.is_commander,
          }),
        }).catch(() => {});
      }
    },

    async clearCards() {
      await fetch(cardsUrl, { method: "DELETE" }).catch(() => {});
    },

    async deleteDeck() {
      await fetch(`/api/decks/${deckId}`, { method: "DELETE" }).catch(() => {});
    },

    persist() {
      // Deltas already cover it.
    },
  };
}

export function createLocalDeckStore(deckId: string): DeckStore {
  return {
    kind: "local",
    listHref: "/builder",

    setQuantity() {
      // persist() covers it.
    },
    addCards() {
      // persist() covers it.
    },
    async clearCards() {
      // persist() covers it.
    },

    async deleteDeck() {
      local.deleteDeck(deckId);
    },

    persist(cards) {
      local.saveDeckCards(deckId, cards);
    },
  };
}
