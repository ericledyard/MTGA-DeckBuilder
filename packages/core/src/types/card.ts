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
  | "legal"
  | "not_legal"
  | "banned"
  | "restricted"
  | "suspended";

export type Rarity =
  | "common"
  | "uncommon"
  | "rare"
  | "mythic"
  | "special"
  | "bonus";

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
