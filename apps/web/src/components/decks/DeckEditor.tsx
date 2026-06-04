"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { validateDeckStructure, deckToMtgaExport } from "@mtga/core";
import type { Deck, Format } from "@mtga/core";

import {
  CardSearchFilters,
  DEFAULT_FILTERS,
  type CardFilters,
} from "@/components/cards/CardSearchFilters";
import { DeckCardRow, type CardRowData } from "./DeckCardRow";
import { ManaCurveChart } from "./ManaCurveChart";
import { ColorBreakdown } from "./ColorBreakdown";

interface DeckEditorProps {
  deck: {
    id: string;
    name: string;
    format: string;
    description: string | null;
    deck_cards: CardRowData[];
  };
}

type SearchCard = {
  id: string;
  oracle_id: string;
  name: string;
  mana_cost: string | null;
  cmc: number;
  type_line: string;
  colors: string[];
  image_uri_normal: string | null;
  rarity: string;
};

const TYPE_ORDER = [
  "Creature",
  "Planeswalker",
  "Instant",
  "Sorcery",
  "Artifact",
  "Enchantment",
  "Land",
  "Other",
];

function cardTypeGroup(typeLine: string): string {
  const t = typeLine.toLowerCase();
  if (t.includes("creature")) return "Creature";
  if (t.includes("planeswalker")) return "Planeswalker";
  if (t.includes("instant")) return "Instant";
  if (t.includes("sorcery")) return "Sorcery";
  if (t.includes("artifact")) return "Artifact";
  if (t.includes("enchantment")) return "Enchantment";
  if (t.includes("land")) return "Land";
  return "Other";
}

export function DeckEditor({ deck }: DeckEditorProps) {
  const router = useRouter();
  const [deckCards, setDeckCards] = useState<CardRowData[]>(deck.deck_cards);
  const [activeTab, setActiveTab] = useState<"mainboard" | "sideboard">(
    "mainboard",
  );
  const [filters, setFilters] = useState<CardFilters>(DEFAULT_FILTERS);
  const [searchResults, setSearchResults] = useState<SearchCard[]>([]);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Run search whenever filters change
  useEffect(() => {
    const hasQuery =
      filters.query ||
      filters.colors.length > 0 ||
      filters.cmcValues.length > 0 ||
      filters.rarities.length > 0 ||
      filters.types.length > 0 ||
      filters.setCodes.length > 0 ||
      filters.format;
    if (!hasQuery) {
      setSearchResults([]);
      return;
    }
    const params = new URLSearchParams({ limit: "20" });
    if (filters.query) params.set("q", filters.query);
    if (filters.colors.length) params.set("colors", filters.colors.join(","));
    if (filters.cmcValues.length)
      params.set("cmc", filters.cmcValues.join(","));
    if (filters.rarities.length)
      params.set("rarities", filters.rarities.join(","));
    if (filters.types.length) params.set("types", filters.types.join(","));
    if (filters.setCodes.length) params.set("sets", filters.setCodes.join(","));
    if (filters.format) params.set("format", filters.format);
    if (filters.arenaOnly) params.set("arena_only", "true");

    fetch(`/api/cards/search?${params}`)
      .then((r) => r.json())
      .then((data) => setSearchResults(data.cards ?? []))
      .catch(() => {});
  }, [filters]);

  // --- Derived state ---
  const mainboard = deckCards.filter((c) => !c.is_sideboard);
  const sideboard = deckCards.filter((c) => c.is_sideboard);
  const visibleCards = activeTab === "mainboard" ? mainboard : sideboard;
  const mainCount = mainboard.reduce((s, c) => s + c.quantity, 0);
  const sideCount = sideboard.reduce((s, c) => s + c.quantity, 0);

  // Validation
  const deckForValidation: Deck = {
    id: deck.id,
    userId: "",
    name: deck.name,
    format: deck.format as Format,
    description: deck.description,
    isPublic: false,
    coverCardId: null,
    createdAt: "",
    updatedAt: "",
    cards: deckCards
      .filter((c) => c.card)
      .map((c) => ({
        oracleId: c.oracle_id,
        name: c.card!.name,
        quantity: c.quantity,
        isSideboard: c.is_sideboard,
        isCompanion: c.is_companion,
      })),
  };
  const validationErrors = validateDeckStructure(deckForValidation);
  const illegalCards = new Set(
    validationErrors.filter((e) => e.cardName).map((e) => e.cardName as string),
  );

  // Group cards by type for display
  const grouped = TYPE_ORDER.reduce(
    (acc, type) => {
      const group = visibleCards.filter(
        (c) => c.card && cardTypeGroup(c.card.type_line) === type,
      );
      if (group.length > 0)
        acc.push({
          type,
          cards: group,
          count: group.reduce((s, c) => s + c.quantity, 0),
        });
      return acc;
    },
    [] as { type: string; cards: CardRowData[]; count: number }[],
  );
  // Cards with no card data (oracle_id only)
  const unknownCards = visibleCards.filter((c) => !c.card);
  if (unknownCards.length > 0) {
    grouped.push({
      type: "Unknown",
      cards: unknownCards,
      count: unknownCards.reduce((s, c) => s + c.quantity, 0),
    });
  }

  // Stats data (mainboard only for curve/colors)
  const statsCards = mainboard
    .filter((c) => c.card)
    .map((c) => ({ ...c.card!, quantity: c.quantity }));

  // --- Card operations ---
  async function upsertCard(
    oracleId: string,
    delta: number,
    isSideboard: boolean,
  ) {
    const existing = deckCards.find(
      (c) => c.oracle_id === oracleId && c.is_sideboard === isSideboard,
    );
    const newQty = (existing?.quantity ?? 0) + delta;

    if (newQty <= 0) {
      setDeckCards((prev) =>
        prev.filter(
          (c) => !(c.oracle_id === oracleId && c.is_sideboard === isSideboard),
        ),
      );
    } else {
      setDeckCards((prev) =>
        existing
          ? prev.map((c) =>
              c.oracle_id === oracleId && c.is_sideboard === isSideboard
                ? { ...c, quantity: newQty }
                : c,
            )
          : prev,
      );
    }

    await fetch(`/api/decks/${deck.id}/cards`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oracle_id: oracleId,
        quantity: newQty,
        is_sideboard: isSideboard,
      }),
    });
  }

  function addCardFromSearch(card: SearchCard) {
    const isSideboard = activeTab === "sideboard";
    const existing = deckCards.find(
      (c) => c.oracle_id === card.oracle_id && c.is_sideboard === isSideboard,
    );

    if (existing) {
      setDeckCards((prev) =>
        prev.map((c) =>
          c.oracle_id === card.oracle_id && c.is_sideboard === isSideboard
            ? { ...c, quantity: c.quantity + 1 }
            : c,
        ),
      );
    } else {
      setDeckCards((prev) => [
        ...prev,
        {
          oracle_id: card.oracle_id,
          quantity: 1,
          is_sideboard: isSideboard,
          is_companion: false,
          card: {
            name: card.name,
            mana_cost: card.mana_cost,
            cmc: card.cmc,
            type_line: card.type_line,
            colors: card.colors,
            image_uri_normal: card.image_uri_normal,
            rarity: card.rarity,
          },
        },
      ]);
    }

    fetch(`/api/decks/${deck.id}/cards`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oracle_id: card.oracle_id,
        quantity: 1,
        is_sideboard: isSideboard,
      }),
    });
  }

  async function handleExport() {
    const text = deckToMtgaExport(deckForValidation);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleDelete() {
    if (!confirm(`Delete "${deck.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    await fetch(`/api/decks/${deck.id}`, { method: "DELETE" });
    router.push("/decks");
    router.refresh();
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-0">
      {/* Left — card search */}
      <div className="lg:w-80 xl:w-96 shrink-0 flex flex-col gap-4">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wide mb-3">
            Add cards — clicking adds to{" "}
            <span className="text-amber-400">{activeTab}</span>
          </p>
          <CardSearchFilters
            filters={filters}
            onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
          />
        </div>

        {searchResults.length > 0 && (
          <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="max-h-[50vh] overflow-y-auto">
              {searchResults.map((card) => (
                <button
                  key={card.id}
                  onClick={() => addCardFromSearch(card)}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-800 transition-colors text-left border-b border-gray-800/50 last:border-0"
                >
                  {card.image_uri_normal && (
                    <img
                      src={card.image_uri_normal}
                      alt={card.name}
                      className="w-8 h-11 object-cover rounded shrink-0"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-200 truncate">
                      {card.name}
                    </p>
                    <p className="text-xs text-gray-500 truncate">
                      {card.type_line}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Right — deck */}
      <div className="flex-1 min-w-0 flex flex-col gap-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-gray-100">{deck.name}</h1>
            <span className="text-xs capitalize text-gray-500">
              {deck.format}
            </span>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleExport}
              className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors"
            >
              {copied ? "Copied!" : "Export MTGA"}
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="px-3 py-1.5 text-xs bg-red-950/40 hover:bg-red-900/50 text-red-400 rounded-lg transition-colors disabled:opacity-50"
            >
              Delete
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">
              Cards
            </p>
            <p className="text-2xl font-bold text-gray-100">{mainCount}</p>
            {sideCount > 0 && (
              <p className="text-xs text-gray-600">+{sideCount} sideboard</p>
            )}
          </div>
          <div className="sm:col-span-2">
            <ManaCurveChart cards={statsCards} />
          </div>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <ColorBreakdown cards={statsCards} />
        </div>

        {/* Validation errors */}
        {validationErrors.length > 0 && (
          <div className="bg-red-950/30 border border-red-900 rounded-xl p-4">
            <p className="text-xs font-semibold text-red-400 uppercase tracking-wide mb-2">
              Deck issues
            </p>
            <ul className="space-y-1">
              {validationErrors.map((e, i) => (
                <li key={i} className="text-sm text-red-300">
                  {e.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-gray-900 border border-gray-800 rounded-lg p-1 w-fit">
          <button
            onClick={() => setActiveTab("mainboard")}
            className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
              activeTab === "mainboard"
                ? "bg-gray-700 text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Mainboard ({mainCount})
          </button>
          <button
            onClick={() => setActiveTab("sideboard")}
            className={`px-4 py-1.5 rounded-md text-sm transition-colors ${
              activeTab === "sideboard"
                ? "bg-gray-700 text-white"
                : "text-gray-500 hover:text-gray-300"
            }`}
          >
            Sideboard ({sideCount})
          </button>
        </div>

        {/* Card list grouped by type */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
          {grouped.length === 0 ? (
            <p className="text-center text-gray-600 text-sm py-10">
              No cards yet — search and click to add
            </p>
          ) : (
            grouped.map(({ type, cards, count }) => (
              <div key={type} className="p-3">
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1 px-2">
                  {type} ({count})
                </p>
                {cards.map((row) => (
                  <DeckCardRow
                    key={`${row.oracle_id}-${row.is_sideboard}`}
                    row={row}
                    onIncrement={(id, side) => upsertCard(id, 1, side)}
                    onDecrement={(id, side) => upsertCard(id, -1, side)}
                    isIllegal={!!row.card && illegalCards.has(row.card.name)}
                  />
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
