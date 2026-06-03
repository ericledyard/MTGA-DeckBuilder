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

  const { data, error } = await supabase.rpc("search_cards", {
    p_query: q,
    p_format: format,
    p_arena_only: arenaOnly,
    p_limit: limit,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
