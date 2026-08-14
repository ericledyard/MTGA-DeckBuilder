import { describe, expect, it } from "vitest";

import {
  canBeCommander,
  isWithinColorIdentity,
  validateDeckStructure,
} from "./deckValidator";
import type { Color, Deck, DeckCard, Format } from "./types/card";

/**
 * Baseline coverage for the validator as it behaves today. Written before the
 * Commander copy-limit work so a regression there shows up as a failing test
 * rather than as a deck MTGA silently rejects.
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

/** Filler so deck-size errors don't drown out the rule under test. */
function filler(count: number, quantity = 1): DeckCard[] {
  return Array.from({ length: count }, (_, i) =>
    card({ name: `Filler ${i}`, quantity }),
  );
}

const typesOf = (errors: { type: string }[]) => errors.map((e) => e.type);

describe("canBeCommander", () => {
  it("accepts a legendary creature", () => {
    expect(
      canBeCommander({
        typeLine: "Legendary Creature — Human Elf Noble",
        oracleText: "Vigilance",
      }),
    ).toBe(true);
  });

  it("accepts a legendary planeswalker", () => {
    expect(
      canBeCommander({
        typeLine: "Legendary Planeswalker — Teferi",
        oracleText: null,
      }),
    ).toBe(true);
  });

  it("rejects a non-legendary creature", () => {
    expect(
      canBeCommander({ typeLine: "Creature — Bear", oracleText: null }),
    ).toBe(false);
  });

  it("rejects a legendary artifact with no commander clause", () => {
    expect(
      canBeCommander({
        typeLine: "Legendary Artifact",
        oracleText: "{T}: Add one mana of any colour.",
      }),
    ).toBe(false);
  });

  it("accepts a non-creature that says it can be your commander", () => {
    expect(
      canBeCommander({
        typeLine: "Legendary Enchantment — Background",
        oracleText: "Background (This can be your commander.)",
      }),
    ).toBe(true);
  });
});

describe("isWithinColorIdentity", () => {
  const commander: Color[] = ["G", "W"];

  it("allows a subset", () => {
    expect(isWithinColorIdentity(["G"], commander)).toBe(true);
  });

  it("allows a colourless card", () => {
    expect(isWithinColorIdentity([], commander)).toBe(true);
  });

  it("rejects a colour outside the identity", () => {
    expect(isWithinColorIdentity(["B"], commander)).toBe(false);
  });

  it("treats unknown identity as legal rather than illegal", () => {
    expect(isWithinColorIdentity(undefined, commander)).toBe(true);
  });
});

describe("validateDeckStructure — commander formats", () => {
  it("reports a missing commander", () => {
    const errors = validateDeckStructure(deck("commander", filler(100)));
    expect(typesOf(errors)).toContain("missing_commander");
  });

  it("counts the commander as one of the 100", () => {
    const errors = validateDeckStructure(
      deck("commander", [
        card({ name: "Aragorn and Arwen, Wed", isCommander: true }),
        ...filler(99),
      ]),
    );
    expect(typesOf(errors)).not.toContain("deck_size");
    expect(typesOf(errors)).not.toContain("missing_commander");
  });

  it("flags a duplicate non-basic as a singleton violation", () => {
    const errors = validateDeckStructure(
      deck("commander", [
        card({ name: "Sol Ring", isCommander: true }),
        card({ name: "Attercop", quantity: 2 }),
        ...filler(97),
      ]),
    );
    expect(typesOf(errors)).toContain("singleton");
  });

  it("exempts basic lands from the singleton rule", () => {
    const errors = validateDeckStructure(
      deck("commander", [
        card({ name: "Aragorn and Arwen, Wed", isCommander: true }),
        card({ name: "Forest", quantity: 40 }),
        ...filler(59),
      ]),
    );
    expect(typesOf(errors)).not.toContain("singleton");
  });

  it("flags a card outside the commander's colour identity", () => {
    const errors = validateDeckStructure(
      deck("commander", [
        card({
          name: "Aragorn and Arwen, Wed",
          isCommander: true,
          colorIdentity: ["G", "W"],
        }),
        card({ name: "Dark Ritual", colorIdentity: ["B"] }),
        ...filler(98),
      ]),
    );
    expect(typesOf(errors)).toContain("color_identity");
  });

  it("does not flag a card whose identity is unknown", () => {
    const errors = validateDeckStructure(
      deck("commander", [
        card({
          name: "Aragorn and Arwen, Wed",
          isCommander: true,
          colorIdentity: ["G", "W"],
        }),
        card({ name: "Legacy Card" }),
        ...filler(98),
      ]),
    );
    expect(typesOf(errors)).not.toContain("color_identity");
  });
});

describe("validateDeckStructure — 60-card formats", () => {
  it("allows four copies", () => {
    const errors = validateDeckStructure(
      deck("standard", [
        card({ name: "Llanowar Elves", quantity: 4 }),
        ...filler(56),
      ]),
    );
    expect(typesOf(errors)).not.toContain("card_count");
  });

  it("rejects a fifth copy", () => {
    const errors = validateDeckStructure(
      deck("standard", [
        card({ name: "Llanowar Elves", quantity: 5 }),
        ...filler(55),
      ]),
    );
    expect(typesOf(errors)).toContain("card_count");
  });

  it("does not require a commander", () => {
    const errors = validateDeckStructure(deck("standard", filler(60)));
    expect(typesOf(errors)).not.toContain("missing_commander");
  });
});
