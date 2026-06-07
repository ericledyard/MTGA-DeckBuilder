"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ImportCollectionModal,
  type ResolvedCollectionCard,
} from "./ImportCollectionModal";

interface CollectionCard {
  oracle_id: string;
  name: string;
  mana_cost: string | null;
  cmc: number;
  type_line: string;
  colors: string[];
  rarity: string;
  image_uri_normal: string | null;
  set_code: string;
  set_name: string;
  available_on_arena: boolean;
  is_alchemy: boolean;
  quantity_regular: number;
  quantity_foil: number;
  imported_from: string;
}

const RARITY_COLOR: Record<string, string> = {
  common: "text-gray-400",
  uncommon: "text-blue-400",
  rare: "text-amber-400",
  mythic: "text-orange-400",
};

function CollectionCardTile({
  card,
  onQtyChange,
}: {
  card: CollectionCard;
  onQtyChange: (oracle_id: string, delta: number) => void;
}) {
  const qty = card.quantity_regular + card.quantity_foil;

  return (
    <div className="group relative rounded-xl overflow-hidden border border-gray-800 hover:border-amber-500/60 transition-all bg-gray-900">
      <Link href={`/cards/${card.oracle_id}`} className="block">
        <div className="aspect-[5/7] relative bg-gray-800">
          {card.image_uri_normal ? (
            <Image
              src={card.image_uri_normal}
              alt={card.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
              className="object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              No image
            </div>
          )}
          {/* Quantity badge */}
          <div className="absolute top-2 right-2 min-w-[1.5rem] h-6 px-1.5 flex items-center justify-center bg-gray-950/90 border border-gray-700 rounded-md text-sm font-bold text-white">
            {qty}
          </div>
          {card.is_alchemy && (
            <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded text-xs bg-purple-900/90 text-purple-300 font-medium">
              A
            </span>
          )}
        </div>
      </Link>

      <div className="p-2 space-y-1">
        <p className="text-xs font-medium text-white truncate">{card.name}</p>
        <div className="flex items-center justify-between">
          <span
            className={`text-xs capitalize ${RARITY_COLOR[card.rarity] ?? "text-gray-400"}`}
          >
            {card.rarity}
          </span>
          <span className="text-xs text-gray-500 uppercase">
            {card.set_code}
          </span>
        </div>
        {/* +/- controls */}
        <div className="flex items-center gap-1 pt-1">
          <button
            onClick={() => onQtyChange(card.oracle_id, -1)}
            className="flex-1 py-0.5 text-sm rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
          >
            −
          </button>
          <span className="w-8 text-center text-sm font-mono text-white">
            {qty}
          </span>
          <button
            onClick={() => onQtyChange(card.oracle_id, +1)}
            className="flex-1 py-0.5 text-sm rounded bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}

export function CollectionClient({
  initialCollection,
}: {
  initialCollection: CollectionCard[];
}) {
  const [collection, setCollection] =
    useState<CollectionCard[]>(initialCollection);
  const [showImport, setShowImport] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = collection.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase()),
  );

  const handleQtyChange = useCallback(
    async (oracle_id: string, delta: number) => {
      const card = collection.find((c) => c.oracle_id === oracle_id);
      if (!card) return;

      const newQty = Math.max(0, card.quantity_regular + delta);

      // Optimistic update
      setCollection((prev) =>
        newQty === 0
          ? prev.filter((c) => c.oracle_id !== oracle_id)
          : prev.map((c) =>
              c.oracle_id === oracle_id
                ? { ...c, quantity_regular: newQty }
                : c,
            ),
      );

      if (newQty === 0) {
        fetch(`/api/collection/${oracle_id}`, { method: "DELETE" }).catch(
          () => {},
        );
      } else {
        fetch(`/api/collection/${oracle_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantity_regular: newQty,
            quantity_foil: card.quantity_foil,
          }),
        }).catch(() => {});
      }
    },
    [collection],
  );

  const handleImport = useCallback(async (cards: ResolvedCollectionCard[]) => {
    await fetch("/api/collection/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cards: cards.map((c) => ({
          oracle_id: c.oracle_id,
          quantity_regular: c.quantity_regular,
          quantity_foil: c.quantity_foil,
        })),
      }),
    });

    // Merge into local state
    setCollection((prev) => {
      const map = new Map(prev.map((c) => [c.oracle_id, { ...c }]));
      for (const c of cards) {
        const existing = map.get(c.oracle_id);
        if (existing) {
          existing.quantity_regular = c.quantity_regular;
          existing.quantity_foil = c.quantity_foil;
        } else {
          map.set(c.oracle_id, {
            oracle_id: c.oracle_id,
            name: c.name,
            mana_cost: null,
            cmc: 0,
            type_line: "",
            colors: [],
            rarity: c.rarity,
            image_uri_normal: c.image_uri_normal,
            set_code: "",
            set_name: "",
            available_on_arena: false,
            is_alchemy: false,
            quantity_regular: c.quantity_regular,
            quantity_foil: c.quantity_foil,
            imported_from: "untapped",
          });
        }
      }
      return Array.from(map.values());
    });
  }, []);

  const totalCards = collection.reduce(
    (sum, c) => sum + c.quantity_regular + c.quantity_foil,
    0,
  );
  const uniqueCards = collection.length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">My Collection</h1>
          {uniqueCards > 0 && (
            <p className="text-sm text-gray-500 mt-0.5">
              {uniqueCards.toLocaleString()} unique cards ·{" "}
              {totalCards.toLocaleString()} total
            </p>
          )}
        </div>
        <button
          onClick={() => setShowImport(true)}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold rounded-lg transition-colors text-sm shrink-0"
        >
          Import from untapped.gg
        </button>
      </div>

      {/* Search */}
      {uniqueCards > 0 && (
        <div className="mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search your collection…"
            className="w-full sm:w-72 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      )}

      {/* Empty state */}
      {uniqueCards === 0 && (
        <div className="text-center py-24 text-gray-500">
          <p className="text-lg mb-2">No cards yet</p>
          <p className="text-sm mb-6">
            Import your untapped.gg collection to get started
          </p>
          <button
            onClick={() => setShowImport(true)}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-gray-950 font-semibold rounded-lg transition-colors text-sm"
          >
            Import collection
          </button>
        </div>
      )}

      {/* Card grid */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
          {filtered.map((card) => (
            <CollectionCardTile
              key={card.oracle_id}
              card={card}
              onQtyChange={handleQtyChange}
            />
          ))}
        </div>
      )}

      {filtered.length === 0 && uniqueCards > 0 && (
        <p className="text-center py-16 text-gray-500 text-sm">
          No cards match &ldquo;{query}&rdquo;
        </p>
      )}

      {showImport && (
        <ImportCollectionModal
          onImport={handleImport}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}
