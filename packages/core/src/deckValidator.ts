import type { Color, Deck, DeckCard, Format } from "./types/card";

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

/**
 * A card may be played in a Commander/Brawl deck only if its colour identity is
 * a subset of the commander's. Colourless cards fit any commander, which falls
 * out of the subset test for free.
 *
 * An unknown (undefined) card identity returns true. The rule exists to catch
 * real mistakes, and flagging a card red because its data has not loaded is
 * worse than missing one that is genuinely off-colour.
 */
export function isWithinColorIdentity(
  cardIdentity: Color[] | undefined,
  commanderIdentity: Color[],
): boolean {
  if (!cardIdentity) return true;
  return cardIdentity.every((c) => commanderIdentity.includes(c));
}

export interface ValidationError {
  type:
    | "deck_size"
    | "sideboard_size"
    | "card_count"
    | "singleton"
    | "format_illegal"
    | "arena_unavailable"
    | "missing_commander"
    | "color_identity";
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

  const commanderCount = rules.requiresCommander
    ? deck.cards
        .filter((c) => c.isCommander)
        .reduce((sum, c) => sum + c.quantity, 0)
    : 0;
  const mainCount =
    mainCards.reduce((sum, c) => sum + c.quantity, 0) + commanderCount;
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

  // Colour identity. Only meaningful once a commander is actually set — with no
  // commander there is nothing to measure against, and "missing_commander"
  // above already says what is wrong.
  if (rules.requiresCommander) {
    const commanders = deck.cards.filter((c) => c.isCommander);
    const commanderIdentity = [
      ...new Set(commanders.flatMap((c) => c.colorIdentity ?? [])),
    ];
    const identityKnown = commanders.some((c) => c.colorIdentity !== undefined);

    if (commanders.length > 0 && identityKnown) {
      for (const card of deck.cards) {
        if (card.isCommander) continue;
        if (isWithinColorIdentity(card.colorIdentity, commanderIdentity)) {
          continue;
        }
        const offending = (card.colorIdentity ?? []).filter(
          (c) => !commanderIdentity.includes(c),
        );
        errors.push({
          type: "color_identity",
          message: `${card.name} is outside your commander's colour identity (${offending.join("")})`,
          cardName: card.name,
        });
      }
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
