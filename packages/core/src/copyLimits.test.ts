import { describe, expect, it } from "vitest";

import { maxCopiesForCard, validateDeckStructure } from "./deckValidator";
import type { Deck, DeckCard, Format } from "./types/card";

/**
 * Copy limits. The interesting cases are the exceptions: basic lands, and the
 * handful of cards that grant themselves an allowance in their own rules text.
 * Those are what MTGA enforces, so they are what the editor has to enforce.
 */

function card(over: Partial<DeckCard> & { name: string }): DeckCard {
  return {
    oracleId: over.name.toLowerCase().replace(/\s+/g, "-"),
    quantity: 1,
    isSideboard: false,
    isCompanion: false,
    isCommander: false,
    ...over,
  };
}

function deck(format: Format, cards: DeckCard[]): Deck {
  return {
    id: "d1",
    userId: "u1",
    name: "Test Deck",
    format,
    description: null,
    isPublic: false,
    coverCardId: null,
    createdAt: "",
    updatedAt: "",
    cards,
  };
}

function filler(count: number): DeckCard[] {
  return Array.from({ length: count }, (_, i) => card({ name: `Filler ${i}` }));
}

const typesOf = (errors: { type: string }[]) => errors.map((e) => e.type);

describe("maxCopiesForCard — format defaults", () => {
  it("allows one copy in commander", () => {
    expect(
      maxCopiesForCard(
        { name: "Attercop", typeLine: "Creature — Spider", oracleText: null },
        "commander",
      ),
    ).toBe(1);
  });

  it("allows one copy in brawl", () => {
    expect(
      maxCopiesForCard(
        { name: "Attercop", typeLine: "Creature — Spider", oracleText: null },
        "brawl",
      ),
    ).toBe(1);
  });

  it("allows four copies in standard", () => {
    expect(
      maxCopiesForCard(
        {
          name: "Llanowar Elves",
          typeLine: "Creature — Elf",
          oracleText: null,
        },
        "standard",
      ),
    ).toBe(4);
  });
});

describe("maxCopiesForCard — basic lands", () => {
  it("is unlimited for a basic land in commander", () => {
    expect(
      maxCopiesForCard(
        { name: "Forest", typeLine: "Basic Land — Forest", oracleText: null },
        "commander",
      ),
    ).toBe(Infinity);
  });

  it("is unlimited for a snow-covered basic", () => {
    expect(
      maxCopiesForCard(
        {
          name: "Snow-Covered Island",
          typeLine: "Basic Snow Land — Island",
          oracleText: null,
        },
        "commander",
      ),
    ).toBe(Infinity);
  });

  it("is unlimited for Wastes", () => {
    expect(
      maxCopiesForCard(
        { name: "Wastes", typeLine: "Basic Land", oracleText: null },
        "commander",
      ),
    ).toBe(Infinity);
  });

  it("does NOT exempt a non-basic land", () => {
    expect(
      maxCopiesForCard(
        {
          name: "Command Tower",
          typeLine: "Land",
          oracleText:
            "{T}: Add one mana of any colour in your commander's identity.",
        },
        "commander",
      ),
    ).toBe(1);
  });

  it("does NOT exempt a card merely named like a basic", () => {
    expect(
      maxCopiesForCard(
        {
          name: "Forest Bear",
          typeLine: "Creature — Bear",
          oracleText: null,
        },
        "commander",
      ),
    ).toBe(1);
  });
});

describe("maxCopiesForCard — cards with their own allowance", () => {
  it("is unlimited for Relentless Rats", () => {
    expect(
      maxCopiesForCard(
        {
          name: "Relentless Rats",
          typeLine: "Creature — Rat",
          oracleText:
            "Relentless Rats gets +1/+1 for each other creature on the battlefield named Relentless Rats. A deck can have any number of cards named Relentless Rats.",
        },
        "commander",
      ),
    ).toBe(Infinity);
  });

  it("is unlimited for Dragon's Approach", () => {
    expect(
      maxCopiesForCard(
        {
          name: "Dragon's Approach",
          typeLine: "Sorcery",
          oracleText:
            "Dragon's Approach deals 3 damage to each opponent. A deck can have any number of cards named Dragon's Approach.",
        },
        "commander",
      ),
    ).toBe(Infinity);
  });

  it("allows nine Nazgûl", () => {
    expect(
      maxCopiesForCard(
        {
          name: "Nazgûl",
          typeLine: "Creature — Wraith Knight",
          oracleText:
            "A deck can have up to nine cards named Nazgûl. Whenever the Ring tempts you, put a +1/+1 counter on Nazgûl.",
        },
        "commander",
      ),
    ).toBe(9);
  });

  it("allows seven Seven Dwarves", () => {
    expect(
      maxCopiesForCard(
        {
          name: "Seven Dwarves",
          typeLine: "Creature — Dwarf",
          oracleText:
            "Seven Dwarves gets +1/+1 for each other creature you control named Seven Dwarves. A deck can have up to seven cards named Seven Dwarves.",
        },
        "commander",
      ),
    ).toBe(7);
  });

  it("honours the allowance in a 60-card format too", () => {
    expect(
      maxCopiesForCard(
        {
          name: "Persistent Petitioners",
          typeLine: "Creature — Human Advisor",
          oracleText:
            "A deck can have any number of cards named Persistent Petitioners.",
        },
        "standard",
      ),
    ).toBe(Infinity);
  });
});

describe("maxCopiesForCard — unknown data falls back, never blocks", () => {
  it("uses the format limit when oracle text is missing", () => {
    expect(
      maxCopiesForCard(
        { name: "Legacy Card", typeLine: null, oracleText: null },
        "commander",
      ),
    ).toBe(1);
  });

  it("uses the format limit when the card is entirely unknown", () => {
    expect(maxCopiesForCard({ name: "Legacy Card" }, "standard")).toBe(4);
  });

  it("still exempts a known basic land name without a type line", () => {
    expect(maxCopiesForCard({ name: "Mountain" }, "commander")).toBe(Infinity);
  });
});

describe("validateDeckStructure honours per-card allowances", () => {
  it("does not flag nine Nazgûl in a commander deck", () => {
    const errors = validateDeckStructure(
      deck("commander", [
        card({ name: "Aragorn and Arwen, Wed", isCommander: true }),
        card({
          name: "Nazgûl",
          quantity: 9,
          typeLine: "Creature — Wraith Knight",
          oracleText: "A deck can have up to nine cards named Nazgûl.",
        }),
        ...filler(90),
      ]),
    );
    expect(typesOf(errors)).not.toContain("singleton");
  });

  it("flags a tenth Nazgûl", () => {
    const errors = validateDeckStructure(
      deck("commander", [
        card({ name: "Aragorn and Arwen, Wed", isCommander: true }),
        card({
          name: "Nazgûl",
          quantity: 10,
          typeLine: "Creature — Wraith Knight",
          oracleText: "A deck can have up to nine cards named Nazgûl.",
        }),
        ...filler(89),
      ]),
    );
    expect(typesOf(errors)).toContain("singleton");
  });

  it("counts the commander toward its own name's limit", () => {
    // A commander in the command zone plus a copy in the deck is two copies of
    // one name, which singleton does not allow.
    const errors = validateDeckStructure(
      deck("commander", [
        card({ name: "Sol Ring", isCommander: true }),
        card({ name: "Sol Ring" }),
        ...filler(98),
      ]),
    );
    expect(typesOf(errors)).toContain("singleton");
  });
});
