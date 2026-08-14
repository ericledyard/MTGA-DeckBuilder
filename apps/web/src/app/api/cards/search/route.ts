import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@mtga/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rpcWithRetry } from "@/lib/rpcRetry";

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
  // Commander/Brawl colour identity. Distinct from `colors`: identity is what
  // the deckbuilding rule is written against, and the two differ for cards with
  // coloured activated abilities.
  const colorIdentity =
    searchParams.get("identity")?.split(",").filter(Boolean) ?? null;

  // Default browse order is newest sets first. Sorting by (cmc, name) put a
  // blank placeholder land and nine World Championship advertisements on page
  // one; newest-first opens on the cards people are actually brewing with.
  // Whitelisted here so an unknown value can't reach the SQL sort branch.
  const SORTS = new Set(["released", "cmc", "name"]);
  const sortParam = searchParams.get("sort") ?? "released";
  const sort = SORTS.has(sortParam) ? sortParam : "released";

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

  // Migration 018 raised statement_timeout on service_role to 5 minutes so the
  // sync can refresh cards_playable. That ceiling must not apply to user-facing
  // search: an 8s abort keeps a pathological query failing fast here rather than
  // hanging until Vercel's own function timeout.
  const SEARCH_TIMEOUT_MS = 8000;

  let data: unknown;
  try {
    data = await rpcWithRetry<unknown>("search_cards", () =>
      supabase
        .rpc("search_cards", {
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
          p_sort: sort,
          p_color_identity: colorIdentity?.length ? colorIdentity : undefined,
        })
        .abortSignal(AbortSignal.timeout(SEARCH_TIMEOUT_MS)),
    );
  } catch (err) {
    console.error("cards/search failed:", err);
    return NextResponse.json(
      { error: "Card search failed. Please try again." },
      { status: 503 },
    );
  }

  const isUserSpecific = ownedOnly && !!userId;
  const response = NextResponse.json(data ?? []);
  if (!isUserSpecific) {
    // max-age=0 makes browsers revalidate while the CDN still serves from cache
    // for an hour. Without it there is no browser directive at all, so browsers
    // cache heuristically and keep showing the previous catalogue after a sync —
    // observed serving pre-sync results until a hard reload.
    response.headers.set(
      "Cache-Control",
      "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
    );
  }
  return response;
}
