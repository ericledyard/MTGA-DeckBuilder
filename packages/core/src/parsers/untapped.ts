// Parses the untapped.gg deck/collection export format.
// Line format: "4 Lightning Bolt (M21) 160" or "4 Lightning Bolt"
// Section headers: "Deck", "Sideboard", "Commander"

export interface ParsedCard {
  quantity: number;
  name: string;
  setCode: string | null;
  collectorNumber: string | null;
}

export interface ParsedDeck {
  main: ParsedCard[];
  sideboard: ParsedCard[];
  companion: ParsedCard[];
}

const CARD_LINE = /^(\d+)\s+(.+?)(?:\s+\(([A-Z0-9]+)\)\s+(\S+))?$/;

function parseLine(line: string): ParsedCard | null {
  const match = line.trim().match(CARD_LINE);
  if (!match) return null;
  return {
    quantity: parseInt(match[1], 10),
    name: match[2].trim(),
    setCode: match[3] ?? null,
    collectorNumber: match[4] ?? null,
  };
}

export function parseUntappedExport(text: string): ParsedDeck {
  const result: ParsedDeck = { main: [], sideboard: [], companion: [] };
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

// Parses a flat collection export (one card per line, no sections)
export function parseUntappedCollection(text: string): ParsedCard[] {
  return text
    .split("\n")
    .map((l) => parseLine(l.trim()))
    .filter((c): c is ParsedCard => c !== null);
}
