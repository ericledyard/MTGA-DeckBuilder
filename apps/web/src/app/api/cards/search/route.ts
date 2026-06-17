import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@mtga/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  const format = searchParams.get("format") ?? "";
  const arenaOnly = searchParams.get("arena") === "1";
  const ownedOnly = searchParams.get("owned_only") === "1";
  const limit = Math.min(Number(searchParams.get("limit") ?? "48"), 200);
  const offset = Math.max(0, Number(searchParams.get("offset") ?? "0"));

  const textQuery = searchParams.get("text")?.trim() ?? "";
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

  // Resolve the user only when the owned-only filter is requested
  let userId: string | undefined;
  if (ownedOnly) {
    const authClient = await createSupabaseServerClient();
    const {
      data: { user },
    } = await authClient.auth.getUser();
    userId = user?.id;
  }

  const supabase = createServiceClient();

  const { data, error } = await supabase.rpc("search_cards", {
    p_query: q,
    p_text_query: textQuery,
    p_format: format,
    p_arena_only: arenaOnly,
    p_limit: limit,
    p_offset: offset,
    p_colors: colors?.length ? colors : undefined,
    p_cmc_values: cmcValues?.length ? cmcValues : undefined,
    p_rarities: rarities?.length ? rarities : undefined,
    p_types: types?.length ? types : undefined,
    p_set_codes: setCodes?.length ? setCodes : undefined,
    p_owned_only: ownedOnly && !!userId,
    p_user_id: userId,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const isUserSpecific = ownedOnly && !!userId;
  const response = NextResponse.json(data ?? []);
  if (!isUserSpecific) {
    response.headers.set(
      "Cache-Control",
      "public, s-maxage=3600, stale-while-revalidate=86400",
    );
  }
  return response;
}
