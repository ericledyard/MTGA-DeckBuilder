"use client";

import { ManaCost } from "@/components/ui/ManaCost";

export interface CardRowData {
  oracle_id: string;
  quantity: number;
  is_sideboard: boolean;
  is_companion: boolean;
  card: {
    name: string;
    mana_cost: string | null;
    cmc: number;
    type_line: string;
    colors: string[];
    image_uri_normal: string | null;
    rarity: string;
  } | null;
}

interface DeckCardRowProps {
  row: CardRowData;
  onIncrement: (oracleId: string, isSideboard: boolean) => void;
  onDecrement: (oracleId: string, isSideboard: boolean) => void;
  isIllegal?: boolean;
}

const RARITY_COLOR: Record<string, string> = {
  common: "text-gray-400",
  uncommon: "text-slate-300",
  rare: "text-yellow-400",
  mythic: "text-orange-400",
};

export function DeckCardRow({
  row,
  onIncrement,
  onDecrement,
  isIllegal,
}: DeckCardRowProps) {
  const name = row.card?.name ?? row.oracle_id;
  const rarityColor = RARITY_COLOR[row.card?.rarity ?? ""] ?? "text-gray-400";

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1 rounded-md hover:bg-gray-800/60 group ${
        isIllegal ? "bg-red-950/30" : ""
      }`}
    >
      {/* Quantity controls */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onDecrement(row.oracle_id, row.is_sideboard)}
          className="w-5 h-5 rounded text-gray-500 hover:text-white hover:bg-gray-700 transition-colors text-xs leading-none flex items-center justify-center"
          aria-label={`Remove one ${name}`}
        >
          −
        </button>
        <span className="w-5 text-center text-sm font-semibold text-gray-200">
          {row.quantity}
        </span>
        <button
          onClick={() => onIncrement(row.oracle_id, row.is_sideboard)}
          className="w-5 h-5 rounded text-gray-500 hover:text-white hover:bg-gray-700 transition-colors text-xs leading-none flex items-center justify-center"
          aria-label={`Add one ${name}`}
        >
          +
        </button>
      </div>

      {/* Card name */}
      <span
        className={`flex-1 text-sm truncate ${rarityColor} ${isIllegal ? "text-red-400" : ""}`}
      >
        {name}
      </span>

      {/* Mana cost */}
      {row.card?.mana_cost && (
        <div className="shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
          <ManaCost cost={row.card.mana_cost} size={14} />
        </div>
      )}

      {isIllegal && (
        <span
          className="shrink-0 text-xs text-red-400"
          title="Not legal in this format"
        >
          ✕
        </span>
      )}
    </div>
  );
}
