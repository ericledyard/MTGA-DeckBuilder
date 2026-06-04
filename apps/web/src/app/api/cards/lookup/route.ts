import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  const { data, error } = await supabase
    .from("cards")
    .select(
      "id, oracle_id, name, mana_cost, cmc, type_line, colors, image_uri_normal, rarity, available_on_arena",
    )
    .in("name", uniqueNames)
    .not("oracle_id", "is", null)
    .limit(2000);

  if (error) return NextResponse.json([], { status: 500 });

  // One result per name — prefer arena card, then card with image
  const byName = new Map<string, (typeof data)[0]>();
  for (const card of data ?? []) {
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
