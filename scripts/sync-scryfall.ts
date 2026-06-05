/**
 * Scryfall bulk data sync script.
 * Downloads default_cards bulk JSON from Scryfall and upserts into Supabase.
 * Streams the file to disk first to avoid Node's string length limit (~500MB).
 * Run with: pnpm tsx scripts/sync-scryfall.ts
 *
 * Env required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { createWriteStream, createReadStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import streamArray from "stream-json/streamers/stream-array";
import { createServiceClient } from "../packages/db/src/client";

const SCRYFALL_BULK_INDEX = "https://api.scryfall.com/bulk-data";
const BATCH_SIZE = 500;

// Only formats in our mtg_format enum — Scryfall includes many others
// (explorer, historicbrawl, oathbreaker, penny, premodern, etc.) that we ignore
const SUPPORTED_FORMATS = new Set([
  "standard",
  "alchemy",
  "historic",
  "brawl",
  "timeless",
  "pioneer",
  "modern",
  "legacy",
  "vintage",
  "commander",
  "pauper",
]);

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

async function downloadToFile(downloadUri: string, destPath: string) {
  const res = await fetch(downloadUri, {
    headers: {
      "User-Agent": "MTGADeckBuilder/1.0 (contact: ledyard111@gmail.com)",
    },
  });
  if (!res.ok || !res.body)
    throw new Error(`Download failed: ${res.status} ${res.statusText}`);
  const dest = createWriteStream(destPath);
  // @ts-expect-error — Web ReadableStream → Node stream pipeline
  await pipeline(res.body, dest);
}

function streamCards(filePath: string): AsyncIterable<ScryfallCard> {
  const stream = streamArray.withParserAsStream();
  createReadStream(filePath).pipe(stream);
  return {
    [Symbol.asyncIterator]() {
      return (async function* () {
        for await (const { value } of stream) {
          yield value as ScryfallCard;
        }
      })();
    },
  };
}

async function syncCards(downloadUri: string) {
  const supabase = createServiceClient();
  const tmpFile = join(tmpdir(), `scryfall-cards-${Date.now()}.json`);

  console.log(`Downloading card data from ${downloadUri}…`);
  await downloadToFile(downloadUri, tmpFile);
  console.log("Download complete. Processing cards…");

  // Pass 1: collect unique sets (small — ~1000 entries)
  const setsMap = new Map<string, object>();
  for await (const card of streamCards(tmpFile)) {
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

  // Pass 2: stream cards + legalities in batches
  let cardCount = 0;
  let legalityCount = 0;
  let cardBatch: object[] = [];
  let legalityBatch: object[] = [];
  const seenOracles = new Set<string>();
  const updatedAt = new Date().toISOString();

  const flushCards = async () => {
    if (cardBatch.length === 0) return;
    const { error } = await supabase
      .from("cards")
      .upsert(cardBatch, { onConflict: "scryfall_id" });
    if (error) console.error("Card upsert error:", error.message);
    cardBatch = [];
  };

  const flushLegalities = async () => {
    if (legalityBatch.length === 0) return;
    const { error } = await supabase
      .from("card_legalities")
      .upsert(legalityBatch, { onConflict: "oracle_id,format" });
    if (error) {
      console.error("Legality upsert error:", error.message);
    } else {
      legalityCount += legalityBatch.length;
    }
    legalityBatch = [];
  };

  for await (const c of streamCards(tmpFile)) {
    if (!c.oracle_id) continue; // skip tokens/art cards with no oracle_id
    const imgs = getImageUris(c);
    cardBatch.push({
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
      image_uri_normal: imgs.normal,
      image_uri_large: imgs.large,
      image_uri_art_crop: imgs.art_crop,
      artist: c.artist ?? null,
      flavor_text: c.flavor_text ?? null,
      digital: c.digital,
      scryfall_uri: c.scryfall_uri,
      set_type: c.set_type,
      updated_at: updatedAt,
    });

    if (!seenOracles.has(c.oracle_id)) {
      seenOracles.add(c.oracle_id);
      for (const [format, status] of Object.entries(c.legalities)) {
        if (!SUPPORTED_FORMATS.has(format)) continue;
        legalityBatch.push({ oracle_id: c.oracle_id, format, status });
      }
    }

    cardCount++;
    if (cardBatch.length >= BATCH_SIZE) await flushCards();
    if (legalityBatch.length >= BATCH_SIZE) await flushLegalities();
    if (cardCount % 5000 === 0) console.log(`  ${cardCount} cards processed…`);
  }

  await flushCards();
  await flushLegalities();

  await unlink(tmpFile);
  console.log(
    `Done. ${cardCount} cards and ${legalityCount} legality rows synced.`,
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
