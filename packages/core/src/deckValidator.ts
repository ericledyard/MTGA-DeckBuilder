import type { Deck, DeckCard, Format } from "./types/card";

export function canBeCommander(card: {
  typeLine: string;
  oracleText: string | null;
  keywords?: string[];
}): boolean {
  const t = card.typeLine.toLowerCase();
  const isLegendary = t.includes("legendary");
  const isCreatureOrPlaneswalker =
    t.includes("creature") || t.includes("planeswalker");
  const hasCommanderText =
    card.oracleText?.toLowerCase().includes("can be your commander") ?? false;
  return isLegendary && (isCreatureOrPlaneswalker || hasCommanderText);
}

export interface ValidationError {
  type:
    | "deck_size"
    | "sideboard_size"
    | "card_count"
    | "singleton"
    | "format_illegal"
    | "arena_unavailable"
    | "missing_commander";
  message: string;
  cardName?: string;
}

interface FormatRules {
  minDeckSize: number;
  maxDeckSize: number | null;
  maxSideboardSize: number;
  maxCopies: number; // 4 for most, 1 for singleton formats
  singleton: boolean;
  requiresCommander: boolean;
}

export const FORMAT_RULES: Record<Format, FormatRules> = {
  // 60-card constructed formats — min 60, no max, 15 sideboard, 4 copies
  standard: {
    minDeckSize: 60,
    maxDeckSize: null,
    maxSideboardSize: 15,
    maxCopies: 4,
    singleton: false,
    requiresCommander: false,
  },
  alchemy: {
    minDeckSize: 60,
    maxDeckSize: null,
    maxSideboardSize: 15,
    maxCopies: 4,
    singleton: false,
    requiresCommander: false,
  },
  historic: {
    minDeckSize: 60,
    maxDeckSize: null,
    maxSideboardSize: 15,
    maxCopies: 4,
    singleton: false,
    requiresCommander: false,
  },
  timeless: {
    minDeckSize: 60,
    maxDeckSize: null,
    maxSideboardSize: 15,
    maxCopies: 4,
    singleton: false,
    requiresCommander: false,
  },
  pioneer: {
    minDeckSize: 60,
    maxDeckSize: null,
    maxSideboardSize: 15,
    maxCopies: 4,
    singleton: false,
    requiresCommander: false,
  },
  modern: {
    minDeckSize: 60,
    maxDeckSize: null,
    maxSideboardSize: 15,
    maxCopies: 4,
    singleton: false,
    requiresCommander: false,
  },
  legacy: {
    minDeckSize: 60,
    maxDeckSize: null,
    maxSideboardSize: 15,
    maxCopies: 4,
    singleton: false,
    requiresCommander: false,
  },
  // Vintage: 60-card minimum, restricted list limits many cards to 1 copy (not enforced here without banlist)
  vintage: {
    minDeckSize: 60,
    maxDeckSize: null,
    maxSideboardSize: 15,
    maxCopies: 4,
    singleton: false,
    requiresCommander: false,
  },
  pauper: {
    minDeckSize: 60,
    maxDeckSize: null,
    maxSideboardSize: 15,
    maxCopies: 4,
    singleton: false,
    requiresCommander: false,
  },
  // Singleton commander formats — exactly 100 cards, no sideboard
  brawl: {
    minDeckSize: 100,
    maxDeckSize: 100,
    maxSideboardSize: 0,
    maxCopies: 1,
    singleton: true,
    requiresCommander: true,
  },
  commander: {
    minDeckSize: 100,
    maxDeckSize: 100,
    maxSideboardSize: 0,
    maxCopies: 1,
    singleton: true,
    requiresCommander: true,
  },
};

// Basic lands that are exempt from copy limits
const BASIC_LANDS = new Set([
  "Plains",
  "Island",
  "Swamp",
  "Mountain",
  "Forest",
  "Wastes",
  "Snow-Covered Plains",
  "Snow-Covered Island",
  "Snow-Covered Swamp",
  "Snow-Covered Mountain",
  "Snow-Covered Forest",
]);

export function validateDeckStructure(deck: Deck): ValidationError[] {
  const errors: ValidationError[] = [];
  const rules = FORMAT_RULES[deck.format];

  const mainCards = deck.cards.filter(
    (c) => !c.isSideboard && !c.isCompanion && !c.isCommander,
  );
  const sideCards = deck.cards.filter((c) => c.isSideboard);

  if (rules.requiresCommander) {
    const hasCommander = deck.cards.some((c) => c.isCommander);
    if (!hasCommander) {
      errors.push({
        type: "missing_commander",
        message: `${deck.format} decks require a commander`,
      });
    }
  }

  const mainCount = mainCards.reduce((sum, c) => sum + c.quantity, 0);
  const sideCount = sideCards.reduce((sum, c) => sum + c.quantity, 0);

  if (mainCount < rules.minDeckSize) {
    errors.push({
      type: "deck_size",
      message: `Deck must have at least ${rules.minDeckSize} cards (currently ${mainCount})`,
    });
  }
  if (rules.maxDeckSize && mainCount > rules.maxDeckSize) {
    errors.push({
      type: "deck_size",
      message: `Deck must have exactly ${rules.maxDeckSize} cards (currently ${mainCount})`,
    });
  }
  if (sideCount > rules.maxSideboardSize) {
    errors.push({
      type: "sideboard_size",
      message: `Sideboard can have at most ${rules.maxSideboardSize} cards (currently ${sideCount})`,
    });
  }

  // Copy count validation (commander is a separate slot — exclude from copy counts)
  const allCards = deck.cards.filter((c) => !c.isCompanion && !c.isCommander);
  const countByName = new Map<string, number>();
  for (const card of allCards) {
    countByName.set(
      card.name,
      (countByName.get(card.name) ?? 0) + card.quantity,
    );
  }
  for (const [name, count] of countByName) {
    if (!BASIC_LANDS.has(name) && count > rules.maxCopies) {
      errors.push({
        type: rules.singleton ? "singleton" : "card_count",
        message: rules.singleton
          ? `${name} appears ${count} times — ${deck.format} is a singleton format`
          : `${name} appears ${count} times — maximum is ${rules.maxCopies}`,
        cardName: name,
      });
    }
  }

  return errors;
}

export function validateCardCopies(
  cards: DeckCard[],
  format: Format,
): ValidationError[] {
  const rules = FORMAT_RULES[format];
  const errors: ValidationError[] = [];
  for (const card of cards) {
    if (!BASIC_LANDS.has(card.name) && card.quantity > rules.maxCopies) {
      errors.push({
        type: rules.singleton ? "singleton" : "card_count",
        message: rules.singleton
          ? `${card.name} — ${format} is singleton`
          : `${card.name}: max ${rules.maxCopies} copies`,
        cardName: card.name,
      });
    }
  }
  return errors;
}
