import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@mtga/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const format = searchParams.get("format") ?? "";
  const arenaOnly = searchParams.get("arena") === "1";
  const limit = Math.min(Number(searchParams.get("limit") ?? "48"), 200);

  const supabase = createServiceClient();

  // Build query — one canonical printing per oracle_id (lowest collector number)
  let query = supabase
    .from("cards")
    .select(
      "id, oracle_id, name, mana_cost, type_line, rarity, image_uri_normal, image_uri_art_crop, available_on_arena, is_alchemy, set_code, set_name",
    )
    .order("name")
    .limit(limit);

  if (q) {
    // pg_trgm similarity search via ilike for prefix, falls back to trigram index
    query = query.ilike("name", `%${q}%`);
  }

  if (arenaOnly) {
    query = query.eq("available_on_arena", true);
  }

  if (format) {
    // Join card_legalities to filter legal cards in format
    // Supabase doesn't support joins in .from() directly — use rpc or filter via oracle_id subquery
    const { data: legalOracles } = await supabase
      .from("card_legalities")
      .select("oracle_id")
      .eq("format", format)
      .eq("status", "legal");

    const oracleIds = (legalOracles ?? []).map(
      (r: { oracle_id: string }) => r.oracle_id,
    );
    if (oracleIds.length === 0) {
      return NextResponse.json([]);
    }
    query = query.in("oracle_id", oracleIds);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
