"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { validateDeckStructure, FORMAT_RULES } from "@mtga/core";
import type { Deck, Format } from "@mtga/core";
import { DeckCardRow, type CardRowData } from "./DeckCardRow";
import { ManaCurveChart } from "./ManaCurveChart";
import { ImportDeckModal, type ResolvedImportCard } from "./ImportDeckModal";
import { ExportDeckModal } from "./ExportDeckModal";

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
  cmc: number | null;
  type_line: string;
  colors: string[] | null;
  image_uri_normal: string | null;
  rarity: string;
  set_code: string | null;
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

const CMC_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

const RARITIES = [
  { value: "common", label: "Common", color: "#c0c0c0" },
  { value: "uncommon", label: "Uncommon", color: "#a0b8c8" },
  { value: "rare", label: "Rare", color: "#c8a800" },
  { value: "mythic", label: "Mythic", color: "#e07020" },
];

const FILTER_TYPES = [
  "Creature",
  "Instant",
  "Sorcery",
  "Enchantment",
  "Artifact",
  "Planeswalker",
  "Battle",
  "Land",
];

type SetOption = { code: string; name: string; icon_svg_uri: string | null };

function toggle<T>(arr: T[], v: T): T[] {
  return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
}

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

function ManaSymbols({
  cost,
  size = 13,
}: {
  cost: string | null;
  size?: number;
}) {
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
  const [activeTab, setActiveTab] = useState<"mainboard" | "sideboard">(
    "mainboard",
  );
  const [searchResults, setSearchResults] = useState<SearchCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [textQuery, setTextQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [debouncedTextQuery, setDebouncedTextQuery] = useState("");
  const [colors, setColors] = useState<string[]>([]);
  const [arenaOnly, setArenaOnly] = useState(true);
  const [cmcValues, setCmcValues] = useState<number[]>([]);
  const [rarities, setRarities] = useState<string[]>([]);
  const [filterTypes, setFilterTypes] = useState<string[]>([]);
  const [setCodes, setSetCodes] = useState<string[]>([]);
  const [sets, setSets] = useState<SetOption[]>([]);
  const [setSearch, setSetSearch] = useState("");
  const [setsExpanded, setSetsExpanded] = useState(false);
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [clearedSnapshot, setClearedSnapshot] = useState<CardRowData[] | null>(
    null,
  );
  const [importOpen, setImportOpen] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<SearchCard | null>(null);
  const [previewCard, setPreviewCard] = useState<{
    imageUri: string;
    name: string;
  } | null>(null);
  const searchRef = useRef<AbortController | null>(null);
  const isDraggingRef = useRef(false);
  const hoverTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce text inputs — update debounced values 350ms after typing stops
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query), 350);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedTextQuery(textQuery), 350);
    return () => clearTimeout(t);
  }, [textQuery]);

  // Fetch fires only on debounced values + instant filter toggles
  useEffect(() => {
    if (searchRef.current) searchRef.current.abort();
    const ctrl = new AbortController();
    searchRef.current = ctrl;

    setLoading(true);
    const params = new URLSearchParams({ limit: "60" });
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (debouncedTextQuery) params.set("text", debouncedTextQuery);
    if (colors.length) params.set("colors", colors.join(","));
    if (arenaOnly) params.set("arena", "1");
    if (cmcValues.length) params.set("cmc", cmcValues.join(","));
    if (rarities.length) params.set("rarities", rarities.join(","));
    if (filterTypes.length) params.set("types", filterTypes.join(","));
    if (setCodes.length) params.set("sets", setCodes.join(","));

    fetch(`/api/cards/search?${params}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then((data) => {
        setSearchResults(Array.isArray(data) ? data : (data.cards ?? []));
        setLoading(false);
      })
      .catch(() => {});
  }, [
    debouncedQuery,
    debouncedTextQuery,
    colors,
    arenaOnly,
    cmcValues,
    rarities,
    filterTypes,
    setCodes,
  ]);

  // Fetch sets lazily the first time the filter panel opens
  useEffect(() => {
    if (!filtersExpanded || sets.length > 0) return;
    fetch("/api/cards/sets")
      .then((r) => r.json())
      .then(setSets)
      .catch(() => {});
  }, [filtersExpanded]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derived
  const commanderCards = deckCards.filter((c) => c.is_commander);
  const mainboard = deckCards.filter((c) => !c.is_sideboard && !c.is_commander);
  const sideboard = deckCards.filter((c) => c.is_sideboard);
  const visibleCards = activeTab === "mainboard" ? mainboard : sideboard;
  const commanderCount = commanderCards.reduce((s, c) => s + c.quantity, 0);
  const mainCount =
    mainboard.reduce((s, c) => s + c.quantity, 0) +
    (FORMAT_RULES[deck.format as Format]?.requiresCommander
      ? commanderCount
      : 0);
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
      .filter((c) => c.card || c.is_commander)
      .map((c) => ({
        oracleId: c.oracle_id,
        name: c.card?.name ?? c.oracle_id,
        quantity: c.quantity,
        isSideboard: c.is_sideboard,
        isCompanion: c.is_companion,
        isCommander: c.is_commander,
      })),
  };
  const validationErrors = validateDeckStructure(deckForValidation);
  const illegalCards = new Set(
    validationErrors.filter((e) => e.cardName).map((e) => e.cardName as string),
  );

  const grouped = Array.from({ length: 8 }, (_, i) => {
    const label = i === 7 ? "7+" : String(i);
    const cards = visibleCards
      .filter((c) => {
        if (!c.card) return false;
        const idx = Math.min(
          Math.max(0, Math.floor(Number(c.card.cmc) || 0)),
          7,
        );
        return idx === i;
      })
      .sort((a, b) => (a.card?.name ?? "").localeCompare(b.card?.name ?? ""));
    if (cards.length === 0) return null;
    return {
      type: label,
      cards,
      count: cards.reduce((s, c) => s + c.quantity, 0),
    };
  }).filter(Boolean) as { type: string; cards: CardRowData[]; count: number }[];

  const statsCards = mainboard
    .filter((c) => c.card)
    .map((c) => ({ ...c.card!, quantity: c.quantity }));

  // Card operations
  async function upsertCard(
    oracleId: string,
    delta: number,
    isSideboard: boolean,
    isCommander = false,
  ) {
    const match = (c: CardRowData) =>
      c.oracle_id === oracleId &&
      c.is_sideboard === isSideboard &&
      c.is_commander === isCommander;

    const existing = deckCards.find(match);
    const newQty = (existing?.quantity ?? 0) + delta;

    if (newQty <= 0) {
      setDeckCards((prev) => prev.filter((c) => !match(c)));
    } else if (existing) {
      setDeckCards((prev) =>
        prev.map((c) => (match(c) ? { ...c, quantity: newQty } : c)),
      );
    }

    fetch(`/api/decks/${deck.id}/cards`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        oracle_id: oracleId,
        quantity: newQty,
        is_sideboard: isSideboard,
        is_commander: isCommander,
      }),
    }).catch(() => {});
  }

  function addCardFromSearch(card: SearchCard, isSideboardOverride?: boolean) {
    if (clearedSnapshot) setClearedSnapshot(null);
    const isSideboard = isSideboardOverride ?? activeTab === "sideboard";
    const existing = deckCards.find(
      (c) =>
        c.oracle_id === card.oracle_id &&
        c.is_sideboard === isSideboard &&
        !c.is_commander,
    );
    if (existing) {
      setDeckCards((prev) =>
        prev.map((c) =>
          c.oracle_id === card.oracle_id &&
          c.is_sideboard === isSideboard &&
          !c.is_commander
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
          is_commander: false,
          card: {
            name: card.name,
            mana_cost: card.mana_cost,
            cmc: card.cmc ?? 0,
            type_line: card.type_line,
            colors: card.colors ?? [],
            image_uri_normal: card.image_uri_normal,
            rarity: card.rarity,
            set_code: card.set_code ?? null,
            collector_number: null,
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
    }).catch(() => {});
  }

  // Drag-and-drop handlers
  function handleDragStart(e: React.DragEvent, card: SearchCard) {
    isDraggingRef.current = true;
    setHoveredCard(null);
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    e.dataTransfer.setData("application/json", JSON.stringify(card));
    e.dataTransfer.effectAllowed = "copy";
  }

  function handleDragEnd() {
    // Small delay so the click event (which fires after dragend on some browsers) is suppressed
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  }

  function handleCardMouseEnter(card: SearchCard) {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => setHoveredCard(card), 80);
  }

  function handleCardMouseLeave() {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    setHoveredCard(null);
  }

  function handleDrop(e: React.DragEvent, isSideboard: boolean) {
    e.preventDefault();
    try {
      const card: SearchCard = JSON.parse(
        e.dataTransfer.getData("application/json"),
      );
      addCardFromSearch(card, isSideboard);
    } catch {
      // ignore malformed data
    }
  }

  function handleExport() {
    setExportOpen(true);
  }

  async function handleDelete() {
    if (!confirm(`Delete "${deck.name}"? This cannot be undone.`)) return;
    setDeleting(true);
    await fetch(`/api/decks/${deck.id}`, { method: "DELETE" });
    router.push("/decks");
    router.refresh();
  }

  function handleClearDeck() {
    if (deckCards.length === 0) return;
    if (
      !confirm(
        `Clear all cards from "${deck.name}"? You can undo this right after.`,
      )
    )
      return;
    setClearedSnapshot(deckCards);
    setDeckCards([]);
    fetch(`/api/decks/${deck.id}/cards`, { method: "DELETE" }).catch(() => {});
  }

  function handleUndoClear() {
    if (!clearedSnapshot) return;
    const snapshot = clearedSnapshot;
    setClearedSnapshot(null);
    setDeckCards(snapshot);
    for (const card of snapshot) {
      fetch(`/api/decks/${deck.id}/cards`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oracle_id: card.oracle_id,
          quantity: card.quantity,
          is_sideboard: card.is_sideboard,
          is_commander: card.is_commander,
        }),
      }).catch(() => {});
    }
  }

  async function handleImport(cards: ResolvedImportCard[], replace: boolean) {
    if (replace && deckCards.length > 0) {
      await fetch(`/api/decks/${deck.id}/cards`, { method: "DELETE" });
      setDeckCards([]);
    }

    const newRows: CardRowData[] = cards.map((c) => ({
      oracle_id: c.oracle_id,
      quantity: c.quantity,
      is_sideboard: c.isSideboard,
      is_companion: false,
      is_commander: c.isCommander,
      card: {
        name: c.name,
        mana_cost: c.mana_cost,
        cmc: c.cmc,
        type_line: c.type_line,
        colors: c.colors,
        image_uri_normal: c.image_uri_normal,
        rarity: c.rarity,
        set_code: c.set_code ?? null,
        collector_number: c.collector_number ?? null,
      },
    }));

    setDeckCards((prev) => (replace ? newRows : [...prev, ...newRows]));

    for (const c of cards) {
      fetch(`/api/decks/${deck.id}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          oracle_id: c.oracle_id,
          quantity: c.quantity,
          is_sideboard: c.isSideboard,
          is_commander: c.isCommander,
        }),
      }).catch(() => {});
    }

    setImportOpen(false);
  }

  function toggleColor(c: string) {
    setColors((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c],
    );
  }

  // Map oracle_id -> quantity in current tab for badge display
  const deckQtyMap = new Map(
    visibleCards.map((c) => [c.oracle_id, c.quantity]),
  );

  return (
    <>
      <div
        className="flex gap-0 -mx-4 -my-8 overflow-hidden"
        style={{ height: "calc(100vh - 3.5rem)" }}
      >
        {/* ── LEFT: Card browser ───────────────────────────────────── */}
        <div className="relative flex flex-col flex-1 min-w-0 bg-gray-950 border-r border-gray-800">
          {/* Filter bar */}
          <div className="shrink-0 flex flex-col bg-gray-900 border-b border-gray-800">
            {/* Row 1: name search + card count + Filters button */}
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name…"
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

              <span className="text-xs text-gray-600 shrink-0">
                {loading ? "…" : `${searchResults.length}`}
              </span>

              {/* Filters toggle */}
              {(() => {
                const activeCount =
                  colors.length +
                  cmcValues.length +
                  rarities.length +
                  filterTypes.length +
                  setCodes.length +
                  (!arenaOnly ? 1 : 0);
                return (
                  <button
                    onClick={() => setFiltersExpanded((v) => !v)}
                    aria-expanded={filtersExpanded}
                    className={`shrink-0 px-2.5 py-1 rounded text-xs font-bold border transition-all ${
                      filtersExpanded || activeCount > 0
                        ? "bg-amber-500 border-amber-400 text-gray-900 shadow-md shadow-amber-900/40"
                        : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-amber-500/20 hover:border-amber-500/50 hover:text-amber-300"
                    }`}
                  >
                    Filters
                    {activeCount > 0 && (
                      <span
                        className={`ml-1 inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold ${
                          filtersExpanded
                            ? "bg-gray-900 text-amber-400"
                            : "bg-amber-400 text-gray-900"
                        }`}
                      >
                        {activeCount}
                      </span>
                    )}
                  </button>
                );
              })()}
            </div>

            {/* Row 2: oracle text search */}
            <div className="px-3 pb-2">
              <input
                type="text"
                value={textQuery}
                onChange={(e) => setTextQuery(e.target.value)}
                placeholder="Card text contains… (e.g. Connive, +1/+1, flying)"
                aria-label="Search card oracle text"
                className="w-full px-3 py-1 bg-gray-800 border border-gray-700 rounded-md text-xs text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>

            {/* Expanded filter panel */}
            {filtersExpanded && (
              <div className="border-t border-gray-800/60 px-3 py-2 space-y-3 max-h-72 overflow-y-auto">
                {/* Color + Arena row */}
                <div className="flex items-center gap-2 flex-wrap">
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
                  <span className="ml-auto text-xs text-gray-600 shrink-0">
                    Click to add to{" "}
                    <span className="text-amber-400 font-medium">
                      {activeTab}
                    </span>
                  </span>
                </div>

                {/* CMC */}
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                    CMC
                  </p>
                  <div className="flex items-center gap-1 flex-wrap">
                    {CMC_OPTIONS.map((v) => (
                      <button
                        key={v}
                        onClick={() => setCmcValues((prev) => toggle(prev, v))}
                        className={`w-7 h-7 rounded-full border text-xs font-bold transition-all ${
                          cmcValues.includes(v)
                            ? "bg-amber-500 border-amber-400 text-gray-900"
                            : "bg-gray-800 border-gray-600 text-gray-300 hover:border-amber-500/60"
                        }`}
                      >
                        {v === 7 ? "7+" : v}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rarity */}
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                    Rarity
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {RARITIES.map((r) => (
                      <button
                        key={r.value}
                        onClick={() =>
                          setRarities((prev) => toggle(prev, r.value))
                        }
                        className={`px-2.5 py-1 rounded border text-xs font-bold transition-all ${
                          rarities.includes(r.value)
                            ? "border-current bg-black/30"
                            : "border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300"
                        }`}
                        style={
                          rarities.includes(r.value)
                            ? { color: r.color, borderColor: r.color }
                            : {}
                        }
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Type */}
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1.5">
                    Type
                  </p>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {FILTER_TYPES.map((t) => (
                      <button
                        key={t}
                        onClick={() =>
                          setFilterTypes((prev) => toggle(prev, t))
                        }
                        className={`px-2.5 py-1 rounded border text-xs font-medium transition-all ${
                          filterTypes.includes(t)
                            ? "bg-amber-500/20 border-amber-500/60 text-amber-300"
                            : "bg-gray-800/60 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Expansion */}
                <div>
                  <button
                    type="button"
                    onClick={() => setSetsExpanded((v) => !v)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                      Expansion
                      {setCodes.length > 0 && (
                        <span className="ml-1.5 text-amber-400 normal-case">
                          ({setCodes.length})
                        </span>
                      )}
                    </p>
                    <span className="text-gray-600 text-xs">
                      {setsExpanded ? "▲" : "▼"}
                    </span>
                  </button>
                  {setsExpanded && (
                    <div className="mt-1.5 space-y-1.5">
                      <input
                        type="search"
                        placeholder="Filter sets…"
                        value={setSearch}
                        onChange={(e) => setSetSearch(e.target.value)}
                        className="w-full px-2.5 py-1 rounded bg-gray-800 border border-gray-700 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
                      />
                      <div className="max-h-36 overflow-y-auto space-y-0.5">
                        {sets
                          .filter((s) =>
                            s.name
                              .toLowerCase()
                              .includes(setSearch.toLowerCase()),
                          )
                          .map((s) => {
                            const active = setCodes.includes(s.code);
                            return (
                              <button
                                key={s.code}
                                type="button"
                                onClick={() =>
                                  setSetCodes((prev) => toggle(prev, s.code))
                                }
                                className={`flex items-center gap-2 w-full px-2.5 py-1.5 rounded text-xs text-left transition-colors ${
                                  active
                                    ? "bg-amber-500/20 border border-amber-500/40 text-amber-200"
                                    : "border border-transparent text-gray-300 hover:bg-gray-800"
                                }`}
                              >
                                {s.icon_svg_uri && (
                                  <img
                                    src={s.icon_svg_uri}
                                    alt=""
                                    width={14}
                                    height={14}
                                    className="opacity-70 shrink-0"
                                  />
                                )}
                                <span className="flex-1 truncate">
                                  {s.name}
                                </span>
                                <span className="text-gray-600 uppercase shrink-0">
                                  {s.code}
                                </span>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Reset */}
                {(colors.length > 0 ||
                  cmcValues.length > 0 ||
                  rarities.length > 0 ||
                  filterTypes.length > 0 ||
                  setCodes.length > 0 ||
                  !arenaOnly) && (
                  <button
                    type="button"
                    onClick={() => {
                      setColors([]);
                      setCmcValues([]);
                      setRarities([]);
                      setFilterTypes([]);
                      setSetCodes([]);
                      setArenaOnly(true);
                    }}
                    className="text-xs text-gray-500 hover:text-amber-400 transition-colors underline underline-offset-2"
                  >
                    Reset filters
                  </button>
                )}
              </div>
            )}
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
                      onClick={() => {
                        if (!isDraggingRef.current) addCardFromSearch(card);
                      }}
                      draggable
                      onDragStart={(e) => handleDragStart(e, card)}
                      onDragEnd={handleDragEnd}
                      onMouseEnter={() => handleCardMouseEnter(card)}
                      onMouseLeave={handleCardMouseLeave}
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

          {/* Hover zoom overlay — centered within the card browser panel */}
          {hoveredCard?.image_uri_normal && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
              <div
                className="relative"
                style={{
                  width: "80%",
                  aspectRatio: "2.5/3.5",
                  maxHeight: "80%",
                }}
              >
                <img
                  src={hoveredCard.image_uri_normal}
                  alt={hoveredCard.name}
                  className="w-full h-full object-contain rounded-xl shadow-2xl shadow-black/80"
                  style={{ filter: "drop-shadow(0 0 32px rgba(0,0,0,0.9))" }}
                />
              </div>
            </div>
          )}
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
                <span className="text-xs capitalize text-gray-500">
                  {deck.format}
                </span>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={handleExport}
                  className="px-2 py-1 text-[11px] bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
                >
                  Export
                </button>
                <button
                  onClick={() => setImportOpen(true)}
                  className="px-2 py-1 text-[11px] bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
                >
                  Import
                </button>
                {clearedSnapshot ? (
                  <button
                    onClick={handleUndoClear}
                    className="px-2 py-1 text-[11px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-400 border border-amber-500/40 rounded transition-colors"
                  >
                    Undo
                  </button>
                ) : (
                  <button
                    onClick={handleClearDeck}
                    disabled={deckCards.length === 0}
                    className="px-2 py-1 text-[11px] bg-gray-800 hover:bg-gray-700 text-gray-400 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    Clear
                  </button>
                )}
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
                  <span
                    className={`text-sm font-semibold ${met ? "text-green-400" : "text-amber-400"}`}
                  >
                    {mainCount}
                  </span>
                  <span className="text-xs text-gray-600">{label}</span>
                  {sideCount > 0 && (
                    <span className="text-xs text-gray-600 ml-auto">
                      +{sideCount} side
                    </span>
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

          {/* Commander slot */}
          {commanderCards.length > 0 && (
            <div className="shrink-0 border-b border-amber-900/40 bg-amber-950/20">
              <div className="flex items-center gap-2 px-3 py-1">
                <span className="text-[10px] uppercase tracking-widest text-amber-600 font-semibold">
                  Commander
                </span>
                <div className="flex-1 h-px bg-amber-900/30" />
              </div>
              {commanderCards.map((row) => (
                <DeckCardRow
                  key={`${row.oracle_id}-commander`}
                  row={row}
                  onIncrement={() => {}}
                  onDecrement={(id) => upsertCard(id, -1, false, true)}
                  onCardClick={(uri, name) =>
                    setPreviewCard({ imageUri: uri, name })
                  }
                  isIllegal={!!row.card && illegalCards.has(row.card.name)}
                />
              ))}
            </div>
          )}

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
                <svg
                  className="w-8 h-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
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
                        onCardClick={(uri, name) =>
                          setPreviewCard({ imageUri: uri, name })
                        }
                        isIllegal={
                          !!row.card && illegalCards.has(row.card.name)
                        }
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {importOpen && (
        <ImportDeckModal
          deckId={deck.id}
          currentCardCount={deckCards.length}
          onImport={handleImport}
          onClose={() => setImportOpen(false)}
        />
      )}

      {exportOpen && (
        <ExportDeckModal
          deckName={deck.name}
          deckCards={deckCards}
          onClose={() => setExportOpen(false)}
        />
      )}

      {previewCard && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setPreviewCard(null)}
        >
          <div
            className="relative"
            style={{ width: "min(425px, 80vw)", aspectRatio: "2.5/3.5" }}
          >
            <img
              src={previewCard.imageUri}
              alt={previewCard.name}
              className="w-full h-full object-contain rounded-xl shadow-2xl shadow-black/80"
            />
          </div>
        </div>
      )}
    </>
  );
}
