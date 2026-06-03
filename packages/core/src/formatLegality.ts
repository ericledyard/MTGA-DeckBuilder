import type { Card, Format, LegalityStatus } from "./types/card";

export function getCardLegality(card: Card, format: Format): LegalityStatus {
  const entry = card.legalities.find((l) => l.format === format);
  return entry?.status ?? "not_legal";
}

export function isCardLegalInFormat(card: Card, format: Format): boolean {
  return getCardLegality(card, format) === "legal";
}

export function isArenaFormat(format: Format): boolean {
  return ["standard", "alchemy", "historic", "brawl", "timeless"].includes(
    format,
  );
}

// Arena only shows cards available on Arena or Alchemy cards
export function isCardAvailableInArena(card: Card): boolean {
  return card.availableOnArena || card.isAlchemy;
}
