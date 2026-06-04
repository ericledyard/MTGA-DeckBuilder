"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { validateDeckStructure, deckToMtgaExport, FORMAT_RULES } from "@mtga/core";
import type { Deck, Format } from "@mtga/core";
import { DeckCardRow, type CardRowData } from "./DeckCardRow";
import { ManaCurveChart } from "./ManaCurveChart";

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

const COLORS = [
  { value: "W", label: "White" },
  { value: "U", label: "Blue" },
  { value: "B", label: "Black" },
  { value: "R", label: "Red" },
  { value: "G", label: "Green" },
  { value: "C", label: "Colorless" },
];

const RARITY_DOT: Record<string, string> = {
  common: "bg-gray-400",
  uncommon: "bg-slate-300",
  rare: "bg-yellow-400",
  mythic: "bg-orange-400",
};

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

function ManaSymbols({ cost, size = 13 }: { cost: string | null; size?: number }) {
  if (!cost) return null;
  const symbols = [...cost.matchAll(/\{([^}]+)\}/g)].map((m) => m[1]);
  return (
    <span className="inline-flex items-center gap-px">
      {symbols.map((sym, i) => (
        <img
          key={i}
          src={`https://svgs.scryfall.io/card-symbols/${sym.replace(/\//g, "")}.svg`}
          alt={sym}
          width={size}
          height={size}
          style={{ width: size, height: size }}
        />
      ))}
    </span>
  );
}

export function DeckEditor({ deck }: DeckEditorProps) {
  const router = useRouter();
  const [deckCards, setDeckCards] = useState<CardRowData[]>(deck.deck_cards);
  const [activeTab, setActiveTab] = useState<"mainboard" | "sideboard">("mainboard");
  const [searchResults, setSearchResults] = useState<SearchCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [arenaOnly, setArenaOnly] = useState(true);
  const [copied, setCopied] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const searchRef = useRef<AbortController | null>(null);
  const isDraggingRef = useRef(false);

  // Auto-load on mount and whenever filters change
  useEffect(() => {
    if (searchRef.current) searchRef.current.abort();
    const ctrl = new AbortController();
    searchRef.current = ctrl;

    setLoading(true);
    const params = new URLSearchParams({ limit: "60" });
    if (query) params.set("q", query);
    if (colors.length) params.set("colors", colors.join(","));
    if (arenaOnly) params.set("arena", "1");

    fetch(`/api/cards/search?${params}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => {
        setSearchResults(Array.isArray(data) ? data : data.cards ?? []);
        setLoading(false);
      })
      .catch(() => {});
  }, [query, colors, arenaOnly]);

  // Derived
  const mainboard = deckCards.filter((c) => !c.is_sideboard);
  const sideboard = deckCards.filter((c) => c.is_sideboard);
  const visibleCards = activeTab === "mainboard" ? mainboard : sideboard;
  const mainCount = mainboard.reduce((s, c) => s + c.quantity, 0);
  const sideCount = sideboard.reduce((s, c) => s + c.quantity, 0);

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

  const grouped = TYPE_ORDER.reduce(
    (acc, type) => {
      const group = visibleCards.filter(
        (c) => c.card && cardTypeGroup(c.card.type_line) === type,
      );
      if (group.length > 0)
        acc.push({ type, cards: group, count: group.reduce((s, c) => s + c.quantity, 0) });
      return acc;
    },
    [] as { type: string; cards: CardRowData[]; count: number }[],
  );

  const statsCards = mainboard.filter((c) => c.card).map((c) => ({ ...c.card!, quantity: c.quantity }));

  // Card operations
  async function upsertCard(oracleId: string, delta: number, isSideboard: boolean) {
    const existing = deckCards.find(
      (c) => c.oracle_id === oracleId && c.is_sideboard === isSideboard,
    );
    const newQty = (existing?.quantity ?? 0) + delta;

    if (newQty <= 0) {
      setDeckCards((prev) =>
        prev.filter((c) => !(c.oracle_id === oracleId && c.is_sideboard === isSideboard)),
      );
    } else if (existing) {
      setDeckCards((prev) =>
        prev.map((c) =>
          c.oracle_id === oracleId && c.is_sideboard === isSideboard
            ? { ...c, quantity: newQty }
            : c,
        ),
      );
    }

    fetch(`/api/decks/${deck.id}/cards`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ oracle_id: oracleId, quantity: newQty, is_sideboard: isSideboard }),
    }).catch(() => {});
  }

  function addCardFromSearch(card: SearchCard, isSideboardOverride?: boolean) {
    const isSideboard = isSideboardOverride ?? activeTab === "sideboard";
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
      body: JSON.stringify({ oracle_id: card.oracle_id, quantity: 1, is_sideboard: isSideboard }),
    }).catch(() => {});
  }

  // Drag-and-drop handlers
  function handleDragStart(e: React.DragEvent, card: SearchCard) {
    isDraggingRef.current = true;
    e.dataTransfer.setData("application/json", JSON.stringify(card));
    e.dataTransfer.effectAllowed = "copy";
  }

  function handleDragEnd() {
    // Small delay so the click event (which fires after dragend on some browsers) is suppressed
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  }

  function handleDrop(e: React.DragEvent, isSideboard: boolean) {
    e.preventDefault();
    try {
      const card: SearchCard = JSON.parse(e.dataTransfer.getData("application/json"));
      addCardFromSearch(card, isSideboard);
    } catch {
      // ignore malformed data
    }
  }

  async function handleExport() {
    await navigator.clipboard.writeText(deckToMtgaExport(deckForValidation));
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

  function toggleColor(c: string) {
    setColors((prev) => (prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]));
  }

  // Map oracle_id -> quantity in current tab for badge display
  const deckQtyMap = new Map(
    visibleCards.map((c) => [c.oracle_id, c.quantity]),
  );

  return (
    <div
      className="flex gap-0 -mx-4 -my-8 overflow-hidden"
      style={{ height: "calc(100vh - 3.5rem)" }}
    >
      {/* ── LEFT: Card browser ───────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 bg-gray-950 border-r border-gray-800">
        {/* Filter bar */}
        <div className="shrink-0 flex items-center gap-2 px-3 py-2 bg-gray-900 border-b border-gray-800">
          {/* Search */}
          <div className="relative flex-1 max-w-xs">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search cards…"
              className="w-full pl-8 pr-3 py-1.5 bg-gray-800 border border-gray-700 rounded-md text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <svg
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>

          {/* Color toggles */}
          <div className="flex items-center gap-1">
            {COLORS.map(({ value }) => (
              <button
                key={value}
                onClick={() => toggleColor(value)}
                title={value}
                className={`w-7 h-7 rounded-full border-2 transition-all ${
                  colors.includes(value)
                    ? "border-amber-400 scale-110 shadow-lg shadow-amber-900/50"
                    : "border-transparent opacity-60 hover:opacity-100"
                }`}
              >
                <img
                  src={`https://svgs.scryfall.io/card-symbols/${value}.svg`}
                  alt={value}
                  className="w-full h-full"
                />
              </button>
            ))}
          </div>

          {/* Arena toggle */}
          <button
            onClick={() => setArenaOnly((v) => !v)}
            className={`px-2.5 py-1 rounded text-xs font-medium border transition-colors ${
              arenaOnly
                ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                : "bg-gray-800 border-gray-700 text-gray-500 hover:text-gray-300"
            }`}
          >
            Arena
          </button>

          <span className="text-xs text-gray-600 shrink-0">
            {loading ? "…" : `${searchResults.length} cards`}
          </span>

          <span className="ml-auto text-xs text-gray-600">
            Click to add to{" "}
            <span className="text-amber-400 font-medium">{activeTab}</span>
          </span>
        </div>

        {/* Card grid */}
        <div className="flex-1 overflow-y-auto p-3">
          {loading && searchResults.length === 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {Array.from({ length: 24 }).map((_, i) => (
                <div
                  key={i}
                  className="aspect-[2.5/3.5] rounded-lg bg-gray-800 animate-pulse"
                />
              ))}
            </div>
          ) : searchResults.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              No cards found
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
              {searchResults.map((card) => {
                const qty = deckQtyMap.get(card.oracle_id) ?? 0;
                return (
                  <button
                    key={card.id}
                    onClick={() => { if (!isDraggingRef.current) addCardFromSearch(card); }}
                    draggable
                    onDragStart={(e) => handleDragStart(e, card)}
                    onDragEnd={handleDragEnd}
                    className="group relative aspect-[2.5/3.5] rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-amber-500 cursor-grab active:cursor-grabbing"
                  >
                    {card.image_uri_normal ? (
                      <img
                        src={card.image_uri_normal}
                        alt={card.name}
                        className="w-full h-full object-cover transition-transform duration-150 group-hover:scale-105"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-full h-full bg-gray-800 flex items-center justify-center">
                        <span className="text-xs text-gray-500 text-center px-1 leading-tight">
                          {card.name}
                        </span>
                      </div>
                    )}

                    {/* Hover overlay */}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-150 flex items-end">
                      <div className="w-full translate-y-full group-hover:translate-y-0 transition-transform duration-150 bg-gradient-to-t from-black/90 to-transparent p-1.5">
                        <p className="text-white text-[10px] font-semibold leading-tight truncate">
                          {card.name}
                        </p>
                        <ManaSymbols cost={card.mana_cost} size={11} />
                      </div>
                    </div>

                    {/* Rarity dot */}
                    <div
                      className={`absolute top-1 right-1 w-2 h-2 rounded-full ${RARITY_DOT[card.rarity] ?? "bg-gray-500"} opacity-80`}
                    />

                    {/* In-deck badge */}
                    {qty > 0 && (
                      <div className="absolute top-1 left-1 min-w-[18px] h-[18px] bg-amber-500 text-gray-950 text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                        {qty}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Deck panel ────────────────────────────────────── */}
      <div
        className="flex flex-col w-72 xl:w-80 shrink-0 bg-gray-950"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => handleDrop(e, activeTab === "sideboard")}
      >
        {/* Deck header */}
        <div className="shrink-0 px-4 pt-3 pb-2 border-b border-gray-800">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <h1 className="font-bold text-gray-100 truncate leading-tight">
                {deck.name}
              </h1>
              <span className="text-xs capitalize text-gray-500">{deck.format}</span>
            </div>
            <div className="flex gap-1.5 shrink-0">
              <button
                onClick={handleExport}
                className="px-2 py-1 text-[11px] bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
              >
                {copied ? "✓" : "Export"}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-2 py-1 text-[11px] bg-red-950/40 hover:bg-red-900/60 text-red-400 rounded transition-colors"
              >
                Del
              </button>
            </div>
          </div>

          {/* Card count + validation */}
          {(() => {
            const rules = FORMAT_RULES[deck.format as Format];
            const min = rules?.minDeckSize ?? 60;
            const max = rules?.maxDeckSize ?? null;
            const met = max !== null ? mainCount === max : mainCount >= min;
            const label = max !== null ? `/ ${max} cards` : `/ ${min}+ cards`;
            return (
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${met ? "text-green-400" : "text-amber-400"}`}>
                  {mainCount}
                </span>
                <span className="text-xs text-gray-600">{label}</span>
                {sideCount > 0 && (
                  <span className="text-xs text-gray-600 ml-auto">+{sideCount} side</span>
                )}
                {validationErrors.length > 0 && (
                  <span
                    className="ml-auto text-xs text-red-400"
                    title={validationErrors.map((e) => e.message).join(", ")}
                  >
                    ⚠ {validationErrors.length}
                  </span>
                )}
              </div>
            );
          })()}

          {/* Mana curve — compact */}
          <div className="mt-2">
            <ManaCurveChart cards={statsCards} />
          </div>
        </div>

        {/* Tabs */}
        <div className="shrink-0 flex border-b border-gray-800">
          {(["mainboard", "sideboard"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-xs font-medium transition-colors capitalize ${
                activeTab === tab
                  ? "text-amber-400 border-b-2 border-amber-400 -mb-px"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab} ({tab === "mainboard" ? mainCount : sideCount})
            </button>
          ))}
        </div>

        {/* Card list — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {grouped.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-gray-700">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <p className="text-xs">Click cards to add</p>
            </div>
          ) : (
            <div className="py-1">
              {grouped.map(({ type, cards, count }) => (
                <div key={type}>
                  {/* Type header */}
                  <div className="flex items-center gap-2 px-3 py-1 sticky top-0 bg-gray-950/95 backdrop-blur-sm z-10">
                    <span className="text-[10px] uppercase tracking-widest text-gray-600 font-semibold">
                      {type}
                    </span>
                    <span className="text-[10px] text-gray-700">{count}</span>
                    <div className="flex-1 h-px bg-gray-800" />
                  </div>
                  {/* Card rows */}
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
