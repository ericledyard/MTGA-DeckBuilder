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

/**
 * Basic land names, used only when a card's type line is unavailable. The type
 * line is the real test — it catches Snow-Covered basics, Wastes, and anything
 * printed later — but decks saved before type lines were carried have names
 * and nothing else.
 */
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

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
};

/** "A deck can have any number of cards named Relentless Rats." */
const ANY_NUMBER_RE = /a deck can have any number of cards named/i;

/** "A deck can have up to nine cards named Nazgûl." */
const UP_TO_RE = /a deck can have up to (\w+) cards named/i;

function isBasicLand(card: {
  name: string;
  typeLine?: string | null;
}): boolean {
  if (card.typeLine) {
    const t = card.typeLine.toLowerCase();
    return t.includes("basic") && t.includes("land");
  }
  return BASIC_LANDS.has(card.name);
}

/**
 * How many copies of this card the deck may hold.
 *
 * Three rules, in order of precedence:
 *
 *  1. Basic lands are unlimited in every format.
 *  2. A card may grant itself an allowance in its own rules text — either
 *     unlimited ("any number of cards named Relentless Rats") or a specific
 *     count ("up to nine cards named Nazgûl"). This overrides singleton: nine
 *     Nazgûl are legal in Commander.
 *  3. Otherwise the format's limit — 1 for Commander/Brawl, 4 elsewhere.
 *
 * Returns `Infinity` for unlimited. Missing type line or oracle text falls
 * back to the format limit rather than blocking the card, on the same
 * principle as `isWithinColorIdentity`: refusing a card because its data has
 * not loaded is a worse failure than missing one genuinely over the limit.
 */
export function maxCopiesForCard(
  card: { name: string; typeLine?: string | null; oracleText?: string | null },
  format: Format,
): number {
  if (isBasicLand(card)) return Infinity;

  const text = card.oracleText ?? "";
  if (ANY_NUMBER_RE.test(text)) return Infinity;

  const match = text.match(UP_TO_RE);
  if (match) {
    const word = match[1].toLowerCase();
    const parsed = NUMBER_WORDS[word] ?? Number(word);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return FORMAT_RULES[format].maxCopies;
}

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

  // Copy count validation. The commander IS counted: a commander in the
  // command zone plus a copy in the deck is two copies of one name, which
  // singleton does not allow.
  const allCards = deck.cards.filter((c) => !c.isCompanion);
  const countByName = new Map<string, number>();
  const cardByName = new Map<string, DeckCard>();
  for (const card of allCards) {
    countByName.set(
      card.name,
      (countByName.get(card.name) ?? 0) + card.quantity,
    );
    if (!cardByName.has(card.name)) cardByName.set(card.name, card);
  }
  for (const [name, count] of countByName) {
    const sample = cardByName.get(name)!;
    const limit = maxCopiesForCard(
      {
        name,
        typeLine: sample.typeLine,
        oracleText: sample.oracleText,
      },
      deck.format,
    );
    if (count > limit) {
      errors.push({
        type: rules.singleton ? "singleton" : "card_count",
        message: rules.singleton
          ? `${name} appears ${count} times — ${deck.format} is a singleton format`
          : `${name} appears ${count} times — maximum is ${limit}`,
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
    const limit = maxCopiesForCard(card, format);
    if (card.quantity > limit) {
      errors.push({
        type: rules.singleton ? "singleton" : "card_count",
        message: rules.singleton
          ? `${card.name} — ${format} is singleton`
          : `${card.name}: max ${limit} copies`,
        cardName: card.name,
      });
    }
  }
  return errors;
}
