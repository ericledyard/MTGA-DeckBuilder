"use client";

import { useEffect, useRef, useState } from "react";
import type { Format } from "@mtga/core";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CardFilters {
  query: string;
  textQuery: string;
  colors: string[];
  cmcValues: number[];
  rarities: string[];
  types: string[];
  setCodes: string[];
  format: Format | "";
  arenaOnly: boolean;
}

export const DEFAULT_FILTERS: CardFilters = {
  query: "",
  textQuery: "",
  colors: [],
  cmcValues: [],
  rarities: [],
  types: [],
  setCodes: [],
  format: "",
  arenaOnly: false,
};

interface SetOption {
  code: string;
  name: string;
  icon_svg_uri: string | null;
  available_on_arena: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = [
  { value: "W", label: "White", symbol: "W" },
  { value: "U", label: "Blue", symbol: "U" },
  { value: "B", label: "Black", symbol: "B" },
  { value: "R", label: "Red", symbol: "R" },
  { value: "G", label: "Green", symbol: "G" },
  { value: "C", label: "Colorless", symbol: "C" },
];

const CMC_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

const RARITIES = [
  { value: "common", label: "Common", color: "#c0c0c0" },
  { value: "uncommon", label: "Uncommon", color: "#a0b8c8" },
  { value: "rare", label: "Rare", color: "#c8a800" },
  { value: "mythic", label: "Mythic", color: "#e07020" },
];

const TYPES = [
  "Creature",
  "Instant",
  "Sorcery",
  "Enchantment",
  "Artifact",
  "Planeswalker",
  "Battle",
  "Land",
];

const FORMATS: { value: Format | ""; label: string }[] = [
  { value: "", label: "All Formats" },
  { value: "standard", label: "Standard" },
  { value: "alchemy", label: "Alchemy" },
  { value: "historic", label: "Historic" },
  { value: "timeless", label: "Timeless" },
  { value: "brawl", label: "Brawl" },
  { value: "pioneer", label: "Pioneer" },
  { value: "modern", label: "Modern" },
  { value: "legacy", label: "Legacy" },
  { value: "vintage", label: "Vintage" },
  { value: "commander", label: "Commander" },
  { value: "pauper", label: "Pauper" },
];

function toggle<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-2">
      {children}
    </p>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  filters: CardFilters;
  onChange: (patch: Partial<CardFilters>) => void;
}

export function CardSearchFilters({ filters, onChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [sets, setSets] = useState<SetOption[]>([]);
  const [setSearch, setSetSearch] = useState("");
  const [setsExpanded, setSetsExpanded] = useState(false);

  // Local text state so the input stays snappy; debounce before updating URL
  const [localQuery, setLocalQuery] = useState(filters.query);
  const [localTextQuery, setLocalTextQuery] = useState(filters.textQuery);
  const [localSetCode, setLocalSetCode] = useState(filters.setCodes[0] ?? "");
  const queryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const setCodeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync when URL params change externally (e.g. back navigation or reset)
  useEffect(() => setLocalQuery(filters.query), [filters.query]);
  useEffect(() => setLocalTextQuery(filters.textQuery), [filters.textQuery]);
  useEffect(
    () => setLocalSetCode(filters.setCodes[0] ?? ""),
    [filters.setCodes],
  );

  useEffect(() => {
    fetch("/api/cards/sets")
      .then((r) => r.json())
      .then(setSets)
      .catch(() => {});
  }, []);

  function handleQueryChange(val: string) {
    setLocalQuery(val);
    if (queryTimer.current) clearTimeout(queryTimer.current);
    queryTimer.current = setTimeout(() => onChange({ query: val }), 350);
  }

  function handleTextQueryChange(val: string) {
    setLocalTextQuery(val);
    if (textTimer.current) clearTimeout(textTimer.current);
    textTimer.current = setTimeout(() => onChange({ textQuery: val }), 350);
  }

  function handleSetCodeChange(val: string) {
    setLocalSetCode(val);
    if (setCodeTimer.current) clearTimeout(setCodeTimer.current);
    setCodeTimer.current = setTimeout(
      () =>
        onChange({ setCodes: val.trim() ? [val.trim().toUpperCase()] : [] }),
      350,
    );
  }

  const activeCount =
    filters.colors.length +
    filters.cmcValues.length +
    filters.rarities.length +
    filters.types.length +
    filters.setCodes.length +
    (filters.format !== "" ? 1 : 0) +
    (filters.arenaOnly ? 1 : 0);

  const hasActiveFilters =
    activeCount > 0 || filters.textQuery !== "" || filters.query !== "";

  const filteredSets = sets.filter((s) =>
    s.name.toLowerCase().includes(setSearch.toLowerCase()),
  );

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-3 space-y-3">
      {/* Always-visible search bar */}
      <div className="flex gap-2">
        <div className="flex-1 flex flex-col gap-2">
          <input
            type="search"
            placeholder="Search by name…"
            value={localQuery}
            onChange={(e) => handleQueryChange(e.target.value)}
            aria-label="Search cards by name"
            className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="search"
              placeholder="Card text contains… (e.g. Connive, flying)"
              value={localTextQuery}
              onChange={(e) => handleTextQueryChange(e.target.value)}
              aria-label="Search card oracle text"
              className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
            <input
              type="search"
              placeholder="Set code… (e.g. MH3, ZNR)"
              value={localSetCode}
              onChange={(e) => handleSetCodeChange(e.target.value)}
              aria-label="Filter by set code"
              className="w-full px-4 py-2.5 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
            />
          </div>
        </div>

        {/* Filters toggle button */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className={`shrink-0 self-stretch px-4 rounded-xl font-bold text-sm transition-all ${
            expanded || activeCount > 0
              ? "bg-amber-500 text-gray-900 shadow-lg shadow-amber-900/40"
              : "bg-gray-800 border border-gray-700 text-gray-300 hover:bg-amber-500/20 hover:border-amber-500/50 hover:text-amber-300"
          }`}
        >
          Filters
          {activeCount > 0 && (
            <span
              className={`ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold ${
                expanded
                  ? "bg-gray-900 text-amber-400"
                  : "bg-amber-400 text-gray-900"
              }`}
            >
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {/* Expandable filter panel */}
      {expanded && (
        <div className="pt-3 border-t border-gray-800 space-y-5">
          {/* Colors */}
          <div>
            <SectionLabel>Color</SectionLabel>
            <div className="flex items-center gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() =>
                    onChange({ colors: toggle(filters.colors, c.value) })
                  }
                  aria-label={`${filters.colors.includes(c.value) ? "Remove" : "Add"} ${c.label} filter`}
                  aria-pressed={filters.colors.includes(c.value)}
                  className={`relative rounded-full transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    filters.colors.includes(c.value)
                      ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-gray-900 scale-110"
                      : "opacity-60 hover:opacity-90 hover:scale-105"
                  }`}
                >
                  <img
                    src={`https://svgs.scryfall.io/card-symbols/${c.symbol}.svg`}
                    alt={c.label}
                    width={36}
                    height={36}
                    className="w-9 h-9"
                  />
                </button>
              ))}
              {filters.colors.length > 0 && (
                <span className="text-xs text-gray-500 ml-1">
                  — subset (AND) logic
                </span>
              )}
            </div>
          </div>

          {/* CMC */}
          <div>
            <SectionLabel>Mana Value (CMC)</SectionLabel>
            <div className="flex items-center gap-1.5 flex-wrap">
              {CMC_OPTIONS.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() =>
                    onChange({ cmcValues: toggle(filters.cmcValues, v) })
                  }
                  aria-label={`${filters.cmcValues.includes(v) ? "Remove" : "Add"} CMC ${v === 7 ? "7+" : v} filter`}
                  aria-pressed={filters.cmcValues.includes(v)}
                  className={`w-9 h-9 rounded-full border text-sm font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    filters.cmcValues.includes(v)
                      ? "bg-amber-500 border-amber-400 text-gray-900"
                      : "bg-gray-800 border-gray-600 text-gray-300 hover:border-amber-500/60 hover:text-white"
                  }`}
                >
                  {v === 7 ? "7+" : v}
                </button>
              ))}
            </div>
          </div>

          {/* Rarity */}
          <div>
            <SectionLabel>Rarity</SectionLabel>
            <div className="flex items-center gap-2 flex-wrap">
              {RARITIES.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() =>
                    onChange({ rarities: toggle(filters.rarities, r.value) })
                  }
                  aria-label={`${filters.rarities.includes(r.value) ? "Remove" : "Add"} ${r.label} filter`}
                  aria-pressed={filters.rarities.includes(r.value)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    filters.rarities.includes(r.value)
                      ? "border-current bg-black/30"
                      : "border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300"
                  }`}
                  style={
                    filters.rarities.includes(r.value)
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
            <SectionLabel>Type</SectionLabel>
            <div className="flex items-center gap-2 flex-wrap">
              {TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => onChange({ types: toggle(filters.types, t) })}
                  aria-label={`${filters.types.includes(t) ? "Remove" : "Add"} ${t} type filter`}
                  aria-pressed={filters.types.includes(t)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    filters.types.includes(t)
                      ? "bg-amber-500/20 border-amber-500/60 text-amber-300"
                      : "bg-gray-800/60 border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Format + Arena */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-36">
              <SectionLabel>Format</SectionLabel>
              <select
                value={filters.format}
                onChange={(e) =>
                  onChange({ format: e.target.value as Format | "" })
                }
                aria-label="Filter by format"
                className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm focus:outline-none focus:border-amber-500 transition-colors"
              >
                {FORMATS.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none mt-5">
              <input
                type="checkbox"
                checked={filters.arenaOnly}
                onChange={(e) => onChange({ arenaOnly: e.target.checked })}
                className="accent-amber-500 w-4 h-4"
              />
              Arena only
            </label>
          </div>

          {/* Expansion */}
          <div>
            <button
              type="button"
              onClick={() => setSetsExpanded((v) => !v)}
              className="flex items-center justify-between w-full text-left group"
              aria-expanded={setsExpanded}
            >
              <SectionLabel>
                Expansion
                {filters.setCodes.length > 0 && (
                  <span className="ml-2 text-amber-400 normal-case">
                    ({filters.setCodes.length} selected)
                  </span>
                )}
              </SectionLabel>
              <span className="text-gray-500 group-hover:text-gray-300 transition-colors text-xs mb-2">
                {setsExpanded ? "▲" : "▼"}
              </span>
            </button>
            {setsExpanded && (
              <div className="mt-2 space-y-2">
                <input
                  type="search"
                  placeholder="Filter sets…"
                  value={setSearch}
                  onChange={(e) => setSetSearch(e.target.value)}
                  aria-label="Filter expansion list"
                  className="w-full px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-700 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-amber-500"
                />
                <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1">
                  {filteredSets.map((s) => {
                    const active = filters.setCodes.includes(s.code);
                    return (
                      <button
                        key={s.code}
                        type="button"
                        onClick={() =>
                          onChange({
                            setCodes: toggle(filters.setCodes, s.code),
                          })
                        }
                        aria-pressed={active}
                        className={`flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-left transition-colors ${
                          active
                            ? "bg-amber-500/20 border border-amber-500/40 text-amber-200"
                            : "border border-transparent text-gray-300 hover:bg-gray-800 hover:text-white"
                        }`}
                      >
                        {s.icon_svg_uri ? (
                          <img
                            src={s.icon_svg_uri}
                            alt=""
                            width={18}
                            height={18}
                            className="w-4.5 h-4.5 flex-shrink-0 opacity-70"
                          />
                        ) : (
                          <span className="w-4.5 h-4.5 flex-shrink-0" />
                        )}
                        <span className="flex-1 truncate">{s.name}</span>
                        <span className="text-xs text-gray-600 uppercase flex-shrink-0">
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
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                onChange({
                  query: "",
                  textQuery: "",
                  colors: [],
                  cmcValues: [],
                  rarities: [],
                  types: [],
                  setCodes: [],
                  format: "",
                  arenaOnly: false,
                });
                setLocalQuery("");
                setLocalTextQuery("");
              }}
              className="text-xs text-gray-500 hover:text-amber-400 transition-colors underline underline-offset-2"
            >
              Reset all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}
