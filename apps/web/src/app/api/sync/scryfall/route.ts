import { NextRequest, NextResponse } from "next/server";
import { createWriteStream, createReadStream } from "node:fs";
import { unlink } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import streamArray from "stream-json/streamers/StreamArray";

export const runtime = "nodejs";
export const maxDuration = 300;

const SCRYFALL_BULK_INDEX = "https://api.scryfall.com/bulk-data";
const BATCH_SIZE = 500;
const UA = "MTGADeckBuilder/1.0 (contact: ledyard111@gmail.com)";

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

function isAuthorized(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return token === process.env.SYNC_SECRET;
}

function getImageUris(card: Record<string, unknown>) {
  const uris =
    (card.image_uris as Record<string, string> | undefined) ??
    (
      card.card_faces as
        | Array<{ image_uris?: Record<string, string> }>
        | undefined
    )?.[0]?.image_uris;
  return {
    normal: uris?.normal ?? null,
    large: uris?.large ?? null,
    art_crop: uris?.art_crop ?? null,
  };
}

async function runSync(): Promise<{ cards: number; legalities: number }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Fetch bulk data index
  const indexRes = await fetch(SCRYFALL_BULK_INDEX, {
    headers: { "User-Agent": UA },
  });
  const index = (await indexRes.json()) as {
    data: Array<{ type: string; download_uri: string }>;
  };
  const entry = index.data.find((e) => e.type === "default_cards");
  if (!entry) throw new Error("default_cards bulk entry not found");

  // Download bulk file to /tmp
  const tmpFile = join(tmpdir(), `scryfall-${Date.now()}.json`);
  const dlRes = await fetch(entry.download_uri, {
    headers: { "User-Agent": UA },
  });
  if (!dlRes.ok || !dlRes.body)
    throw new Error(`Download failed: ${dlRes.status}`);
  const dest = createWriteStream(tmpFile);
  // @ts-expect-error — Web ReadableStream → Node stream pipeline
  await pipeline(dlRes.body, dest);

  function streamCards(): AsyncIterable<Record<string, unknown>> {
    // @ts-expect-error — stream-json types don't declare withParserAsStream as static
    const stream = streamArray.withParserAsStream();
    createReadStream(tmpFile).pipe(stream);
    return {
      [Symbol.asyncIterator]() {
        return (async function* () {
          for await (const { value } of stream) {
            yield value as Record<string, unknown>;
          }
        })();
      },
    };
  }

  // Pass 1: collect sets
  const setsMap = new Map<string, object>();
  for await (const c of streamCards()) {
    if (!setsMap.has(c.set as string)) {
      setsMap.set(c.set as string, {
        code: c.set,
        name: c.set_name,
        set_type: c.set_type,
        released_at: (c.released_at as string) ?? null,
        available_on_arena: (c.games as string[]).includes("arena"),
      });
    }
  }
  const setRows = [...setsMap.values()];
  for (let i = 0; i < setRows.length; i += BATCH_SIZE) {
    await supabase
      .from("sets")
      .upsert(setRows.slice(i, i + BATCH_SIZE), { onConflict: "code" });
  }

  // Pass 2: cards + legalities
  let cardCount = 0;
  let legalityCount = 0;
  let cardBatch: object[] = [];
  let legalityBatch: object[] = [];
  const seenOracles = new Set<string>();
  const updatedAt = new Date().toISOString();

  const flushCards = async () => {
    if (!cardBatch.length) return;
    const { error } = await supabase
      .from("cards")
      .upsert(cardBatch, { onConflict: "scryfall_id" });
    if (error) console.error("Card upsert error:", error.message);
    cardBatch = [];
  };

  const flushLegalities = async () => {
    if (!legalityBatch.length) return;
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

  for await (const c of streamCards()) {
    if (!c.oracle_id) continue;
    const imgs = getImageUris(c);
    const isAlchemy =
      c.set_type === "alchemy" || (c.name as string).startsWith("A-");

    cardBatch.push({
      scryfall_id: c.id,
      oracle_id: c.oracle_id,
      name: c.name,
      mana_cost: (c.mana_cost as string) ?? null,
      cmc: c.cmc,
      type_line: c.type_line,
      oracle_text: (c.oracle_text as string) ?? null,
      power: (c.power as string) ?? null,
      toughness: (c.toughness as string) ?? null,
      loyalty: (c.loyalty as string) ?? null,
      colors: (c.colors as string[]) ?? [],
      color_identity: c.color_identity,
      set_code: c.set,
      set_name: c.set_name,
      collector_number: c.collector_number,
      rarity: c.rarity,
      available_on_arena: (c.games as string[]).includes("arena"),
      is_alchemy: isAlchemy,
      image_uri_normal: imgs.normal,
      image_uri_large: imgs.large,
      image_uri_art_crop: imgs.art_crop,
      artist: (c.artist as string) ?? null,
      flavor_text: (c.flavor_text as string) ?? null,
      digital: c.digital,
      scryfall_uri: c.scryfall_uri,
      updated_at: updatedAt,
    });

    if (!seenOracles.has(c.oracle_id as string)) {
      seenOracles.add(c.oracle_id as string);
      for (const [format, status] of Object.entries(
        c.legalities as Record<string, string>,
      )) {
        if (!SUPPORTED_FORMATS.has(format)) continue;
        legalityBatch.push({ oracle_id: c.oracle_id, format, status });
      }
    }

    cardCount++;
    if (cardBatch.length >= BATCH_SIZE) await flushCards();
    if (legalityBatch.length >= BATCH_SIZE) await flushLegalities();
  }

  await flushCards();
  await flushLegalities();
  await unlink(tmpFile);

  return { cards: cardCount, legalities: legalityCount };
}

// POST — triggered manually with bearer token
export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runSync();
    return NextResponse.json({ status: "ok", ...result });
  } catch (err) {
    console.error("Sync failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

// GET — called by Vercel cron (no auth needed, Vercel signs cron requests)
export async function GET() {
  try {
    const result = await runSync();
    return NextResponse.json({ status: "ok", ...result });
  } catch (err) {
    console.error("Sync failed:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
