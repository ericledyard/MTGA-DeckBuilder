"use client";

import { ManaCost } from "@/components/ui/ManaCost";

export interface CardRowData {
  oracle_id: string;
  quantity: number;
  is_sideboard: boolean;
  is_companion: boolean;
  is_commander: boolean;
  card: {
    name: string;
    mana_cost: string | null;
    cmc: number;
    type_line: string;
    colors: string[];
    /**
     * Commander/Brawl colour rules key off identity, not `colors` — a card
     * costing {2} with a "{B}:" ability is colourless by `colors` and black by
     * identity. Optional because decks saved before this existed have rows
     * without it; treated as unknown, never as illegal.
     */
    color_identity?: string[];
    /** Needed to spot "can be your commander" cards, e.g. Backgrounds. */
    oracle_text?: string | null;
    image_uri_normal: string | null;
    rarity: string;
    set_code: string | null;
    collector_number: string | null;
  } | null;
}

interface DeckCardRowProps {
  row: CardRowData;
  onIncrement: (oracleId: string, isSideboard: boolean) => void;
  onDecrement: (oracleId: string, isSideboard: boolean) => void;
  onCardClick?: (imageUri: string, name: string) => void;
  isIllegal?: boolean;
  /** At the format's copy limit for this card — the + control is disabled. */
  atLimit?: boolean;
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
  onCardClick,
  isIllegal,
  atLimit,
}: DeckCardRowProps) {
  const name = row.card?.name ?? row.oracle_id;
  const rarityColor = RARITY_COLOR[row.card?.rarity ?? ""] ?? "text-gray-400";
  const hasImage = !!row.card?.image_uri_normal;

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
          disabled={atLimit}
          className="w-5 h-5 rounded text-gray-500 hover:text-white hover:bg-gray-700 transition-colors text-xs leading-none flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-500"
          aria-label={
            atLimit
              ? `${name} is at its copy limit for this format`
              : `Add one ${name}`
          }
          title={atLimit ? "At the copy limit for this format" : undefined}
        >
          +
        </button>
      </div>

      {/* Card name */}
      {onCardClick && hasImage ? (
        <button
          onClick={() => onCardClick(row.card!.image_uri_normal!, name)}
          className={`flex-1 text-sm truncate text-left transition-opacity hover:opacity-75 ${rarityColor} ${isIllegal ? "text-red-400" : ""}`}
          aria-label={`View ${name}`}
        >
          {name}
        </button>
      ) : (
        <span
          className={`flex-1 text-sm truncate ${rarityColor} ${isIllegal ? "text-red-400" : ""}`}
        >
          {name}
        </span>
      )}

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
