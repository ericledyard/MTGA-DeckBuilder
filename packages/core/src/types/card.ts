export type Format =
  | "standard"
  | "alchemy"
  | "historic"
  | "brawl"
  | "timeless"
  | "pioneer"
  | "modern"
  | "legacy"
  | "vintage"
  | "commander"
  | "pauper";

export type LegalityStatus =
  "legal" | "not_legal" | "banned" | "restricted" | "suspended";

export type Rarity =
  "common" | "uncommon" | "rare" | "mythic" | "special" | "bonus";

export type Color = "W" | "U" | "B" | "R" | "G";

export interface CardLegality {
  format: Format;
  status: LegalityStatus;
}

export interface Card {
  id: string;
  scryfallId: string;
  oracleId: string;
  name: string;
  manaCost: string | null;
  cmc: number;
  typeLine: string;
  oracleText: string | null;
  power: string | null;
  toughness: string | null;
  loyalty: string | null;
  colors: Color[];
  colorIdentity: Color[];
  keywords: string[];
  setCode: string;
  setName: string;
  collectorNumber: string;
  rarity: Rarity;
  availableOnArena: boolean;
  isAlchemy: boolean;
  imageUriNormal: string | null;
  imageUriLarge: string | null;
  imageUriArtCrop: string | null;
  artist: string | null;
  flavorText: string | null;
  digital: boolean;
  scryfallUri: string;
  legalities: CardLegality[];
  updatedAt: string;
}

export interface DeckCard {
  oracleId: string;
  name: string;
  quantity: number;
  isSideboard: boolean;
  isCompanion: boolean;
  isCommander: boolean;
  /**
   * Colour identity, for the Commander/Brawl rule that every card must sit
   * inside the commander's identity. Optional: callers that never validate a
   * singleton-commander deck have no reason to carry it, and an absent value
   * is treated as "unknown", never as "illegal".
   */
  colorIdentity?: Color[];
  /**
   * Type line and oracle text, for the copy-limit rules. Basic lands are
   * exempt from every limit, and a handful of cards carry their own allowance
   * ("A deck can have any number of cards named Relentless Rats", "up to nine
   * cards named Nazgûl"). Both optional: an absent value falls back to the
   * format's plain limit rather than blocking a card whose data has not
   * loaded, matching how `colorIdentity` treats unknown.
   */
  typeLine?: string | null;
  oracleText?: string | null;
}

export interface Deck {
  id: string;
  userId: string;
  name: string;
  format: Format;
  description: string | null;
  isPublic: boolean;
  coverCardId: string | null;
  cards: DeckCard[];
  createdAt: string;
  updatedAt: string;
}

export interface OwnedCard {
  oracleId: string;
  name: string;
  quantityRegular: number;
  quantityFoil: number;
  importedFrom: "untapped" | "manual" | "scan";
}
