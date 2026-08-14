"use client";

import { useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { DeckEditor } from "@/components/decks/DeckEditor";
import { getDeck, type LocalDeck } from "@/lib/builder/storage";

/**
 * Never fires. The deck is read once, after hydration, and DeckEditor owns the
 * state from then on — re-rendering the editor on every localStorage write
 * would rebuild the whole card grid each time a card is added, for nothing.
 */
function subscribeNever() {
  return () => {};
}

/** Server render cannot see localStorage; `undefined` means "not read yet". */
function readNothing(): LocalDeck | null | undefined {
  return undefined;
}

interface BuilderDeckEditorProps {
  deckId: string;
}

export function BuilderDeckEditor({ deckId }: BuilderDeckEditorProps) {
  const read = useCallback(() => getDeck(deckId), [deckId]);
  const deck = useSyncExternalStore(subscribeNever, read, readNothing);

  if (deck === undefined) {
    return (
      <p className="py-16 text-center text-sm text-gray-500">Loading deck…</p>
    );
  }

  if (deck === null) {
    return (
      <div className="py-16 text-center space-y-3">
        <p className="text-gray-300 font-medium">Deck not found</p>
        <p className="text-sm text-gray-500 max-w-md mx-auto">
          Decks built here are stored in this browser. This one may have been
          discarded, or created in a different browser or on another device.
        </p>
        <Link
          href="/builder"
          className="inline-block px-4 py-2 bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold rounded-lg transition-colors text-sm"
        >
          Back to your decks
        </Link>
      </div>
    );
  }

  return <DeckEditor deck={deck} mode="local" />;
}
