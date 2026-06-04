import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// PostgREST serialises .in() as a URL query string — large name lists hit the
// ~2 kB URL limit and get silently truncated. Batch into chunks of 40.
const CHUNK_SIZE = 40;

function chunk<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

// POST { names: string[] }
// Returns one SearchCard per unique matched name, deduplicated (prefers arena + image).
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const rawNames: unknown = body.names;
  if (!Array.isArray(rawNames) || rawNames.length === 0) {
    return NextResponse.json([]);
  }

  const uniqueNames = [
    ...new Set(
      (rawNames as string[]).map((n) => String(n).trim()).filter(Boolean),
    ),
  ];

  if (uniqueNames.length === 0) return NextResponse.json([]);

  const supabase = await createSupabaseServerClient();

  // Run batched queries in parallel to avoid PostgREST URL length limits
  const batches = chunk(uniqueNames, CHUNK_SIZE);
  const results = await Promise.all(
    batches.map((names) =>
      supabase
        .from("cards")
        .select(
          "id, oracle_id, name, mana_cost, cmc, type_line, colors, image_uri_normal, rarity, available_on_arena",
        )
        .in("name", names)
        .not("oracle_id", "is", null)
        .limit(500),
    ),
  );

  const allCards = results.flatMap((r) => r.data ?? []);

  // One result per name — prefer arena card, then card with image
  const byName = new Map<string, (typeof allCards)[0]>();
  for (const card of allCards) {
    const existing = byName.get(card.name);
    if (!existing) {
      byName.set(card.name, card);
    } else {
      const score = (c: typeof card) =>
        (c.available_on_arena ? 2 : 0) + (c.image_uri_normal ? 1 : 0);
      if (score(card) > score(existing)) {
        byName.set(card.name, card);
      }
    }
  }

  return NextResponse.json(Array.from(byName.values()));
}
