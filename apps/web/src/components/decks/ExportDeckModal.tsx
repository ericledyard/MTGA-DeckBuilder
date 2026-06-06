"use client";

import { useState, useMemo } from "react";
import type { CardRowData } from "./DeckCardRow";

interface ExportDeckModalProps {
  deckName: string;
  deckCards: CardRowData[];
  onClose: () => void;
}

type ExportFormat = "plain" | "mtga";

function cardName(row: CardRowData): string {
  return row.card?.name ?? row.oracle_id;
}

// MTGA needs the full combined name for split/fuse/aftermath cards (Fire // Ice)
// but only the front-face name for DFCs and Adventure cards.
// Split cards have Instant or Sorcery on both halves of the type_line.
// Adventure cards have "Adventure" on the right half. Everything else is a DFC.
function mtgaCardName(row: CardRowData): string {
  const name = cardName(row);
  if (!name.includes(" // ")) return name;
  const typeLine = row.card?.type_line ?? "";
  const slashIdx = typeLine.indexOf(" // ");
  const typeLeft = slashIdx >= 0 ? typeLine.slice(0, slashIdx) : typeLine;
  const typeRight = slashIdx >= 0 ? typeLine.slice(slashIdx + 4) : "";
  const isSplit =
    !typeRight.includes("Adventure") &&
    (typeLeft.includes("Instant") || typeLeft.includes("Sorcery")) &&
    (typeRight.includes("Instant") || typeRight.includes("Sorcery"));
  return isSplit ? name : name.split(" // ")[0];
}

function toPlainText(deckCards: CardRowData[]): string {
  const commander = deckCards.filter((c) => c.is_commander);
  const main = deckCards.filter((c) => !c.is_sideboard && !c.is_commander);
  const side = deckCards.filter((c) => c.is_sideboard);

  const lines: string[] = [];

  if (commander.length > 0) {
    lines.push("Commander");
    for (const c of commander) lines.push(`1 ${cardName(c)}`);
    lines.push("");
  }

  lines.push("Deck");
  for (const c of main) lines.push(`${c.quantity} ${cardName(c)}`);

  if (side.length > 0) {
    lines.push("", "Sideboard");
    for (const c of side) lines.push(`${c.quantity} ${cardName(c)}`);
  }

  return lines.join("\n");
}

function toMtgaFormat(deckCards: CardRowData[]): string {
  const commander = deckCards.filter((c) => c.is_commander);
  const main = deckCards.filter((c) => !c.is_sideboard && !c.is_commander);
  const side = deckCards.filter((c) => c.is_sideboard);

  function cardLine(c: CardRowData, qty: number): string {
    const name = mtgaCardName(c);
    let set = c.card?.set_code;
    let num = c.card?.collector_number;
    if (set && num) {
      // The List (PLST): "MH2-232" → set=MH2, num=232
      const listMatch = num.match(/^([A-Z][A-Z0-9]{1,4})-(\d+)$/);
      if (listMatch) {
        set = listMatch[1];
        num = listMatch[2];
      }
      // Alchemy: Scryfall uses "A-85" but MTGA expects just "85"
      const alchemyMatch = num.match(/^A-(\d+)$/);
      if (alchemyMatch) num = alchemyMatch[1];
    }
    // PRM and SPG are Scryfall-only umbrella set codes MTGA doesn't recognise.
    // Fall back to name-only so MTGA can match by card name.
    const setUpper = set?.toUpperCase();
    if (setUpper === "SPG" || setUpper === "PRM") return `${qty} ${name}`;
    if (set && num) return `${qty} ${name} (${set.toUpperCase()}) ${num}`;
    return `${qty} ${name}`;
  }

  const lines: string[] = [];

  if (commander.length > 0) {
    lines.push("Commander");
    for (const c of commander) lines.push(cardLine(c, 1));
    lines.push("");
  }

  lines.push("Deck");
  for (const c of main) lines.push(cardLine(c, c.quantity));

  if (side.length > 0) {
    lines.push("", "Sideboard");
    for (const c of side) lines.push(cardLine(c, c.quantity));
  }

  return lines.join("\n");
}

export function ExportDeckModal({
  deckName,
  deckCards,
  onClose,
}: ExportDeckModalProps) {
  const [format, setFormat] = useState<ExportFormat>("mtga");
  const [copied, setCopied] = useState(false);

  const text = useMemo(
    () =>
      format === "mtga" ? toMtgaFormat(deckCards) : toPlainText(deckCards),
    [format, deckCards],
  );

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the textarea text so user can copy manually
      const el = document.querySelector<HTMLTextAreaElement>(
        "[data-export-textarea]",
      );
      el?.select();
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-gray-900 border border-gray-700 rounded-xl shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-800 shrink-0">
          <h2 className="text-sm font-bold text-gray-100 tracking-wide uppercase">
            Export — {deckName}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-200 transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Format tabs */}
        <div className="flex gap-1 px-5 pt-4 shrink-0">
          {(
            [
              { id: "mtga", label: "MTGA Format" },
              { id: "plain", label: "Plain Text" },
            ] as { id: ExportFormat; label: string }[]
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setFormat(tab.id);
                setCopied(false);
              }}
              className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                format === tab.id
                  ? "bg-amber-500 text-gray-900 font-bold"
                  : "bg-gray-800 text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Format description */}
        <p className="px-5 pt-2 pb-1 text-[11px] text-gray-500 shrink-0">
          {format === "mtga"
            ? "Includes set code and collector number — paste directly into MTGA."
            : "Card names and quantities only — for sharing or use in other tools."}
        </p>

        {/* Textarea */}
        <div className="flex-1 overflow-y-auto px-5 pb-4">
          <textarea
            data-export-textarea
            readOnly
            value={text}
            rows={16}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2.5 text-xs text-gray-200 font-mono resize-none focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-transparent"
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          />
        </div>

        {/* Footer */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-5 py-3.5 border-t border-gray-800">
          <span className="text-[11px] text-gray-600">
            {deckCards
              .filter((c) => !c.is_sideboard && !c.is_commander)
              .reduce((s, c) => s + c.quantity, 0)}{" "}
            cards
            {deckCards.some((c) => c.is_sideboard) &&
              ` · ${deckCards.filter((c) => c.is_sideboard).reduce((s, c) => s + c.quantity, 0)} sideboard`}
          </span>
          <button
            onClick={handleCopy}
            className="px-4 py-1.5 text-xs font-bold bg-amber-500 hover:bg-amber-400 text-gray-900 rounded-md transition-colors"
          >
            {copied ? "✓ Copied!" : "Copy to Clipboard"}
          </button>
        </div>
      </div>
    </div>
  );
}
