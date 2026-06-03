"use client";

import type { Format } from "@mtga/core";

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

interface Props {
  query: string;
  format: Format | "";
  arenaOnly: boolean;
  onQueryChange: (v: string) => void;
  onFormatChange: (v: Format | "") => void;
  onArenaOnlyChange: (v: boolean) => void;
}

export function CardSearchFilters({
  query,
  format,
  arenaOnly,
  onQueryChange,
  onFormatChange,
  onArenaOnlyChange,
}: Props) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <input
        type="search"
        placeholder="Search cards…"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        aria-label="Search cards"
        className="flex-1 min-w-48 px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-amber-500"
      />

      <select
        value={format}
        onChange={(e) => onFormatChange(e.target.value as Format | "")}
        aria-label="Filter by format"
        className="px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-white focus:outline-none focus:border-amber-500"
      >
        {FORMATS.map((f) => (
          <option key={f.value} value={f.value}>
            {f.label}
          </option>
        ))}
      </select>

      <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
        <input
          type="checkbox"
          checked={arenaOnly}
          onChange={(e) => onArenaOnlyChange(e.target.checked)}
          className="accent-amber-500"
        />
        Arena only
      </label>
    </div>
  );
}
