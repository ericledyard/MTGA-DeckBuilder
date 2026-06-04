import type { Deck } from "../types/card";

// Parses MTGA copy/paste deck format:
// "4 Lightning Bolt (M21) 160\n1 Mountain (ANB) 115"

export interface MtgaCard {
  quantity: number;
  name: string;
  setCode: string | null;
  collectorNumber: string | null;
}

export interface MtgaDeck {
  main: MtgaCard[];
  sideboard: MtgaCard[];
  companion: MtgaCard[];
}

const CARD_LINE = /^(\d+)\s+(.+?)(?:\s+\(([A-Z0-9]+)\)\s+(\S+))?$/;

function parseLine(line: string): MtgaCard | null {
  const match = line.trim().match(CARD_LINE);
  if (!match) return null;
  return {
    quantity: parseInt(match[1], 10),
    name: match[2].trim(),
    setCode: match[3] ?? null,
    collectorNumber: match[4] ?? null,
  };
}

export function parseMtgaExport(text: string): MtgaDeck {
  const result: MtgaDeck = { main: [], sideboard: [], companion: [] };
  let section: "main" | "sideboard" | "companion" = "main";

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const lower = line.toLowerCase();
    if (lower === "deck") {
      section = "main";
      continue;
    }
    if (lower === "sideboard") {
      section = "sideboard";
      continue;
    }
    if (lower === "companion") {
      section = "companion";
      continue;
    }
    const card = parseLine(line);
    if (card) result[section].push(card);
  }

  return result;
}

export function deckToMtgaExport(deck: Deck): string {
  const lines: string[] = ["Deck"];

  for (const card of deck.cards.filter(
    (c) => !c.isSideboard && !c.isCompanion,
  )) {
    lines.push(`${card.quantity} ${card.name}`);
  }

  const sideboard = deck.cards.filter((c) => c.isSideboard);
  if (sideboard.length > 0) {
    lines.push("", "Sideboard");
    for (const card of sideboard) {
      lines.push(`${card.quantity} ${card.name}`);
    }
  }

  const companion = deck.cards.find((c) => c.isCompanion);
  if (companion) {
    lines.push("", "Companion");
    lines.push(`1 ${companion.name}`);
  }

  return lines.join("\n");
}
