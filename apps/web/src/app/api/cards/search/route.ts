import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@mtga/db";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const format = searchParams.get("format") ?? "";
  const arenaOnly = searchParams.get("arena") === "1";
  const limit = Math.min(Number(searchParams.get("limit") ?? "48"), 200);

  const colors = searchParams.get("colors")?.split(",").filter(Boolean) ?? null;
  const cmcValues =
    searchParams
      .get("cmc")
      ?.split(",")
      .map(Number)
      .filter((n) => !isNaN(n)) ?? null;
  const rarities =
    searchParams.get("rarities")?.split(",").filter(Boolean) ?? null;
  const types = searchParams.get("types")?.split(",").filter(Boolean) ?? null;
  const setCodes = searchParams.get("sets")?.split(",").filter(Boolean) ?? null;

  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("search_cards", {
    p_query: q,
    p_format: format,
    p_arena_only: arenaOnly,
    p_limit: limit,
    p_colors: colors?.length ? colors : undefined,
    p_cmc_values: cmcValues?.length ? cmcValues : undefined,
    p_rarities: rarities?.length ? rarities : undefined,
    p_types: types?.length ? types : undefined,
    p_set_codes: setCodes?.length ? setCodes : undefined,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
