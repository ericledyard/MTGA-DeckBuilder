"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FORMAT_RULES } from "@mtga/core";
import type { Format } from "@mtga/core";
import {
  createDeck,
  deleteDeck,
  getDeckIndex,
  getServerDeckIndex,
  isStorageAvailable,
  subscribe,
} from "@/lib/builder/storage";

const FORMATS = Object.keys(FORMAT_RULES) as Format[];

export function BuilderDeckList() {
  const router = useRouter();
  // useSyncExternalStore rather than an effect: localStorage does not exist
  // during SSR, and this repo treats setState-in-effect as an error. The
  // server snapshot is a stable empty list, so the first client render matches
  // the server HTML and then swaps in the real decks.
  const decks = useSyncExternalStore(
    subscribe,
    getDeckIndex,
    getServerDeckIndex,
  );
  const storageOk = useSyncExternalStore(
    subscribe,
    isStorageAvailable,
    () => true,
  );

  const [name, setName] = useState("");
  const [format, setFormat] = useState<string>("standard");
  const [error, setError] = useState<string | null>(null);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const deck = createDeck(name.trim(), format);
    if (!deck) {
      setError(
        "Could not save to this browser. Private browsing or blocked site data will do that.",
      );
      return;
    }
    router.push(`/builder/${deck.id}`);
  }

  function handleDiscard(id: string, deckName: string) {
    if (!confirm(`Discard "${deckName}"? This cannot be undone.`)) return;
    deleteDeck(id);
  }

  return (
    <div className="space-y-6">
      {!storageOk && (
        <p
          role="alert"
          className="text-sm rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-red-300"
        >
          This browser is blocking local storage, so decks cannot be kept
          between visits. You can still build and export in this tab, but
          reloading will lose the deck.
        </p>
      )}

      <form
        onSubmit={handleCreate}
        className="bg-gray-900 border border-gray-800 rounded-xl p-4 space-y-3"
      >
        <h2 className="font-semibold text-gray-100">Start a deck</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label
              htmlFor="builder-deck-name"
              className="block text-sm text-gray-400 mb-1.5"
            >
              Deck name
            </label>
            <input
              id="builder-deck-name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome Deck"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent text-sm"
            />
          </div>
          <div className="sm:w-48">
            <label
              htmlFor="builder-deck-format"
              className="block text-sm text-gray-400 mb-1.5"
            >
              Format
            </label>
            <select
              id="builder-deck-format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm capitalize"
            >
              {FORMATS.map((f) => (
                <option key={f} value={f} className="capitalize">
                  {f}
                </option>
              ))}
            </select>
          </div>
        </div>
        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold rounded-lg transition-colors text-sm"
        >
          Build it
        </button>
      </form>

      <section className="space-y-2">
        <h2 className="font-semibold text-gray-100">Decks in this browser</h2>
        {decks.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center border border-dashed border-gray-800 rounded-xl">
            Nothing here yet. Start a deck above.
          </p>
        ) : (
          <ul className="space-y-2">
            {decks.map((deck) => (
              <li
                key={deck.id}
                className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-xl px-4 py-3 hover:border-amber-500/50 transition-colors"
              >
                <Link href={`/builder/${deck.id}`} className="min-w-0 flex-1">
                  <span className="block font-medium text-gray-100 truncate">
                    {deck.name || "Untitled deck"}
                  </span>
                  <span className="block text-xs text-gray-500 capitalize">
                    {deck.format} · {deck.card_count} cards
                  </span>
                </Link>
                <button
                  onClick={() => handleDiscard(deck.id, deck.name)}
                  aria-label={`Discard ${deck.name || "Untitled deck"}`}
                  className="shrink-0 px-2 py-1 text-[11px] bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded transition-colors"
                >
                  Discard
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
