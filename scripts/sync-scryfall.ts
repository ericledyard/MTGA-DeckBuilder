/**
 * Scryfall bulk data sync script.
 * Downloads default_cards + oracle_cards bulk JSON from Scryfall and upserts
 * into Supabase. Run with: pnpm tsx scripts/sync-scryfall.ts
 *
 * Env required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createServiceClient } from "../packages/db/src/client";

const SCRYFALL_BULK_INDEX = "https://api.scryfall.com/bulk-data";
const BATCH_SIZE = 500;

interface BulkDataEntry {
  type: string;
  download_uri: string;
  updated_at: string;
  size: number;
}

interface ScryfallCard {
  id: string;
  oracle_id: string;
  name: string;
  mana_cost?: string;
  cmc: number;
  type_line: string;
  oracle_text?: string;
  power?: string;
  toughness?: string;
  loyalty?: string;
  colors?: string[];
  color_identity: string[];
  set: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  games: string[];
  set_type: string;
  image_uris?: {
    normal?: string;
    large?: string;
    art_crop?: string;
  };
  artist?: string;
  flavor_text?: string;
  digital: boolean;
  scryfall_uri: string;
  legalities: Record<string, string>;
  released_at?: string;
  card_faces?: Array<{
    image_uris?: { normal?: string; large?: string; art_crop?: string };
  }>;
  updated_at?: string;
}

async function fetchBulkIndex(): Promise<BulkDataEntry[]> {
  const res = await fetch(SCRYFALL_BULK_INDEX, {
    headers: {
      "User-Agent": "MTGADeckBuilder/1.0 (contact: ledyard111@gmail.com)",
    },
  });
  const data = (await res.json()) as { data: BulkDataEntry[] };
  return data.data;
}

function isAlchemy(card: ScryfallCard): boolean {
  return card.set_type === "alchemy" || card.name.startsWith("A-");
}

function getImageUris(card: ScryfallCard) {
  // Double-faced cards store images on card_faces
  const uris = card.image_uris ?? card.card_faces?.[0]?.image_uris;
  return {
    normal: uris?.normal ?? null,
    large: uris?.large ?? null,
    art_crop: uris?.art_crop ?? null,
  };
}

async function syncCards(downloadUri: string) {
  const supabase = createServiceClient();
  console.log(`Downloading card data from ${downloadUri}…`);

  const res = await fetch(downloadUri, {
    headers: {
      "User-Agent": "MTGADeckBuilder/1.0 (contact: ledyard111@gmail.com)",
    },
  });
  const cards: ScryfallCard[] = (await res.json()) as ScryfallCard[];
  console.log(`Loaded ${cards.length} cards.`);

  // Upsert sets first
  const setsMap = new Map<string, object>();
  for (const card of cards) {
    if (!setsMap.has(card.set)) {
      setsMap.set(card.set, {
        code: card.set,
        name: card.set_name,
        set_type: card.set_type,
        released_at: card.released_at ?? null,
        available_on_arena: card.games.includes("arena"),
      });
    }
  }
  const setRows = [...setsMap.values()];
  for (let i = 0; i < setRows.length; i += BATCH_SIZE) {
    await supabase
      .from("sets")
      .upsert(setRows.slice(i, i + BATCH_SIZE), { onConflict: "code" });
  }
  console.log(`Upserted ${setRows.length} sets.`);

  // Upsert cards in batches
  let cardCount = 0;
  const legalityRows: object[] = [];

  for (let i = 0; i < cards.length; i += BATCH_SIZE) {
    const batch = cards.slice(i, i + BATCH_SIZE);
    const images = batch.map(getImageUris);

    const cardRows = batch.map((c, j) => ({
      scryfall_id: c.id,
      oracle_id: c.oracle_id,
      name: c.name,
      mana_cost: c.mana_cost ?? null,
      cmc: c.cmc,
      type_line: c.type_line,
      oracle_text: c.oracle_text ?? null,
      power: c.power ?? null,
      toughness: c.toughness ?? null,
      loyalty: c.loyalty ?? null,
      colors: c.colors ?? [],
      color_identity: c.color_identity,
      set_code: c.set,
      set_name: c.set_name,
      collector_number: c.collector_number,
      rarity: c.rarity,
      available_on_arena: c.games.includes("arena"),
      is_alchemy: isAlchemy(c),
      image_uri_normal: images[j].normal,
      image_uri_large: images[j].large,
      image_uri_art_crop: images[j].art_crop,
      artist: c.artist ?? null,
      flavor_text: c.flavor_text ?? null,
      digital: c.digital,
      scryfall_uri: c.scryfall_uri,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from("cards")
      .upsert(cardRows, { onConflict: "scryfall_id" });
    if (error) console.error(`Card upsert error at batch ${i}:`, error.message);

    // Collect legality rows (deduplicated by oracle_id)
    const seenOracles = new Set<string>();
    for (const c of batch) {
      if (seenOracles.has(c.oracle_id)) continue;
      seenOracles.add(c.oracle_id);
      for (const [format, status] of Object.entries(c.legalities)) {
        legalityRows.push({ oracle_id: c.oracle_id, format, status });
      }
    }

    cardCount += batch.length;
    if (cardCount % 5000 === 0)
      console.log(`  ${cardCount}/${cards.length} cards processed…`);
  }

  // Upsert legalities
  for (let i = 0; i < legalityRows.length; i += BATCH_SIZE) {
    const { error } = await supabase
      .from("card_legalities")
      .upsert(legalityRows.slice(i, i + BATCH_SIZE), {
        onConflict: "oracle_id,format",
      });
    if (error)
      console.error(`Legality upsert error at batch ${i}:`, error.message);
  }

  console.log(
    `Done. ${cardCount} cards and ${legalityRows.length} legality rows synced.`,
  );
}

async function main() {
  const entries = await fetchBulkIndex();
  const defaultCards = entries.find((e) => e.type === "default_cards");
  if (!defaultCards) throw new Error("default_cards bulk entry not found");
  console.log(`Bulk data last updated: ${defaultCards.updated_at}`);
  await syncCards(defaultCards.download_uri);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
