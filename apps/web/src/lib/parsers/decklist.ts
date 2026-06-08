export interface ParsedDeckCard {
  name: string;
  quantity: number;
  isSideboard: boolean;
  isCommander: boolean;
  setCode: string | null;
  collectorNumber: string | null;
}

export interface ParsedDecklist {
  main: ParsedDeckCard[];
  sideboard: ParsedDeckCard[];
  commander: ParsedDeckCard[];
}

// Matches: "4 Lightning Bolt (M21) 160"  OR  "4 Lightning Bolt"
const CARD_LINE = /^(\d+)x?\s+(.+?)(?:\s+\(([A-Z0-9]+)\)\s+(\S+))?$/i;

// Moonveil/category header: "Commander - 1", "Creatures - 57", "Instants & Sorceries - 2"
const MOONVEIL_HEADER = /^([A-Za-z\s&/]+?)\s*-\s*\d+$/;

// Name with trailing count for basic lands: "Forest 10", "Mountain 6"
const NAME_WITH_COUNT = /^(.+?)\s+(\d+)$/;

function parseLine(line: string): ParsedDeckCard | null {
  const m = line.trim().match(CARD_LINE);
  if (!m) return null;
  return {
    quantity: parseInt(m[1], 10),
    name: m[2].trim(),
    setCode: m[3]?.toUpperCase() ?? null,
    collectorNumber: m[4] ?? null,
    isSideboard: false,
    isCommander: false,
  };
}

// Some exports use plural basic land names — normalize to the actual card name.
const PLURAL_BASICS: Record<string, string> = {
  forests: "Forest",
  mountains: "Mountain",
  islands: "Island",
  swamps: "Swamp",
  "snow-covered forests": "Snow-Covered Forest",
  "snow-covered mountains": "Snow-Covered Mountain",
  "snow-covered islands": "Snow-Covered Island",
  "snow-covered swamps": "Snow-Covered Swamp",
};

// Parses a name-only card line (Moonveil format). Handles "Forest 10" as qty=10.
function parseMoonveilLine(line: string): ParsedDeckCard {
  const withCount = line.match(NAME_WITH_COUNT);
  let name: string;
  let quantity: number;
  if (withCount) {
    name = withCount[1].trim();
    quantity = parseInt(withCount[2], 10);
  } else {
    name = line.trim();
    quantity = 1;
  }
  name = PLURAL_BASICS[name.toLowerCase()] ?? name;
  return {
    quantity,
    name,
    setCode: null,
    collectorNumber: null,
    isSideboard: false,
    isCommander: false,
  };
}

const MAIN_HEADERS = new Set([
  "deck",
  "main",
  "maindeck",
  "main deck",
  "mainboard",
  "companion",
]);
const COMMANDER_HEADERS = new Set(["commander"]);
const SIDE_HEADERS = new Set(["sideboard", "side", "sb"]);

/**
 * Universal decklist parser.
 *
 * Handles:
 * - MTGA:     section headers "Deck" / "Sideboard" / "Commander", lines "4 Name (SET) 123"
 * - MTGO:     sideboard lines prefixed with "SB: "
 * - Moxfield: "// Commander" style comment headers
 * - Plain:    "4x Name" or "4 Name" with optional "Sideboard" header
 * - Moonveil: category headers "Creatures - 57", name-only lines, "Forest 10" for basic land counts
 */
export function parseDecklist(text: string): ParsedDecklist {
  const main: ParsedDeckCard[] = [];
  const sideboard: ParsedDeckCard[] = [];
  const commander: ParsedDeckCard[] = [];
  let section: "main" | "sideboard" | "commander" = "main";
  let moonveilMode = false;

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    // MTGO sideboard prefix: "SB: 4 Lightning Bolt"
    if (/^SB:\s+/i.test(line)) {
      const card = parseLine(line.replace(/^SB:\s+/i, ""));
      if (card) sideboard.push({ ...card, isSideboard: true });
      continue;
    }

    // Strip Moxfield-style "// " comment prefix to normalise section headers
    const stripped = line.replace(/^\/\/\s*/, "").trim();
    const lower = stripped.toLowerCase();

    if (MAIN_HEADERS.has(lower)) {
      section = "main";
      continue;
    }
    if (COMMANDER_HEADERS.has(lower)) {
      section = "commander";
      continue;
    }
    if (SIDE_HEADERS.has(lower)) {
      section = "sideboard";
      continue;
    }

    // Skip remaining pure comment lines
    if (line.startsWith("//")) continue;

    // Moonveil-style category header: "Commander - 1", "Creatures - 57"
    const moonveilHeader = stripped.match(MOONVEIL_HEADER);
    if (moonveilHeader) {
      moonveilMode = true;
      const category = moonveilHeader[1].trim().toLowerCase();
      section = COMMANDER_HEADERS.has(category) ? "commander" : "main";
      continue;
    }

    const card =
      parseLine(stripped) ??
      (moonveilMode ? parseMoonveilLine(stripped) : null);
    if (!card) continue;

    if (section === "commander") {
      commander.push({ ...card, isCommander: true });
    } else if (section === "sideboard") {
      sideboard.push({ ...card, isSideboard: true });
    } else {
      main.push(card);
    }
  }

  // Merge duplicate names within each section
  function merge(cards: ParsedDeckCard[]): ParsedDeckCard[] {
    const seen = new Map<string, ParsedDeckCard>();
    for (const c of cards) {
      const key = c.name.toLowerCase();
      const existing = seen.get(key);
      if (existing) {
        existing.quantity += c.quantity;
      } else {
        seen.set(key, { ...c });
      }
    }
    return Array.from(seen.values());
  }

  return {
    main: merge(main),
    sideboard: merge(sideboard),
    commander: merge(commander),
  };
}
