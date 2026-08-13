import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { chunk, rpcWithRetry } from "@/lib/rpcRetry";

// Accepts either:
//   { items: [{name, setCode?, collectorNumber?}] }  — structured (preferred)
//   { names: string[] }                               — legacy name-only
//
// Items with both setCode+collectorNumber are looked up via set/collector RPC
// (precise, single-printing match). Name-only items fall back to lookup_cards_by_names.
//
// Response shape:
//   default            → Card[]                    (legacy; collection import relies on this)
//   { fuzzy: true }    → { cards: Card[], fuzzy: FuzzyMatch[] }
//
// On an unrecoverable database error this returns 503 rather than an empty list.
// Returning [] made a failed lookup indistinguishable from "none of these cards
// exist", which is how a query timeout surfaced to users as "88 cards not found".

interface LookupItem {
  name: string;
  setCode?: string | null;
  collectorNumber?: string | null;
}

// Bounds the size of any single RPC so one oversized import can't produce a
// query slow enough to hit Supabase's statement_timeout (anon 3s, authed 8s).
const NAME_BATCH_SIZE = 60;

// Fuzzy matching is much more expensive per name than equality, and only ever
// runs on names exact matching already missed. Cap it so a list of garbage
// names can't turn into a huge fuzzy sweep.
const FUZZY_BATCH_SIZE = 25;
const FUZZY_MAX_NAMES = 100;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const wantFuzzy = body.fuzzy === true;

  // Normalise to LookupItem[]
  let items: LookupItem[];
  if (Array.isArray(body.items)) {
    items = (body.items as LookupItem[]).filter(
      (i) => i && typeof i.name === "string" && i.name.trim(),
    );
  } else if (Array.isArray(body.names)) {
    items = (body.names as string[])
      .map((n) => String(n).trim())
      .filter(Boolean)
      .map((n) => ({ name: n }));
  } else {
    return NextResponse.json(wantFuzzy ? { cards: [], fuzzy: [] } : []);
  }

  if (items.length === 0) {
    return NextResponse.json(wantFuzzy ? { cards: [], fuzzy: [] } : []);
  }

  const supabase = await createSupabaseServerClient();

  // Split: items with a set+collector go to the precise RPC; the rest use name lookup.
  const bySetCollector: LookupItem[] = [];
  const byName: LookupItem[] = [];
  for (const item of items) {
    if (item.setCode?.trim() && item.collectorNumber?.trim()) {
      bySetCollector.push(item);
    } else {
      byName.push(item);
    }
  }

  // Key used to join results back to the original items.
  const setCollectorKey = (setCode: string, collectorNumber: string) =>
    `${setCode.toLowerCase()}:${collectorNumber.toLowerCase()}`;

  const results: Record<string, unknown>[] = [];

  try {
    if (bySetCollector.length > 0) {
      const found: { set_code: string; collector_number: string }[] = [];

      for (const batch of chunk(bySetCollector, NAME_BATCH_SIZE)) {
        const data = await rpcWithRetry<
          (Record<string, unknown> & {
            set_code: string;
            collector_number: string;
          })[]
        >("lookup_cards_by_set_collector", () =>
          supabase.rpc("lookup_cards_by_set_collector", {
            p_set_codes: batch.map((i) => i.setCode!.trim()),
            p_collector_numbers: batch.map((i) => i.collectorNumber!.trim()),
          }),
        );
        results.push(...data);
        found.push(...data);
      }

      // Any items not matched by set+collector fall back to name lookup.
      const foundKeys = new Set(
        found.map((r) => setCollectorKey(r.set_code, r.collector_number)),
      );
      byName.push(
        ...bySetCollector.filter(
          (i) =>
            !foundKeys.has(setCollectorKey(i.setCode!, i.collectorNumber!)),
        ),
      );
    }

    const uniqueNames = [...new Set(byName.map((i) => i.name.trim()))];

    for (const batch of chunk(uniqueNames, NAME_BATCH_SIZE)) {
      const data = await rpcWithRetry<Record<string, unknown>[]>(
        "lookup_cards_by_names",
        () => supabase.rpc("lookup_cards_by_names", { p_names: batch }),
      );
      results.push(...data);
    }

    if (!wantFuzzy) return NextResponse.json(results);

    // Fuzzy pass — only for names exact matching missed.
    const matched = new Set<string>();
    for (const r of results) {
      const name = String(r.name ?? "").toLowerCase();
      matched.add(name);
      if (name.includes(" // ")) matched.add(name.split(" // ")[0]);
    }

    const unmatched = uniqueNames
      .filter((n) => !matched.has(n.toLowerCase()))
      .slice(0, FUZZY_MAX_NAMES);

    const fuzzy: Record<string, unknown>[] = [];
    for (const batch of chunk(unmatched, FUZZY_BATCH_SIZE)) {
      const data = await rpcWithRetry<Record<string, unknown>[]>(
        "lookup_cards_fuzzy",
        () => supabase.rpc("lookup_cards_fuzzy", { p_names: batch }),
      );
      fuzzy.push(...data);
    }

    return NextResponse.json({ cards: results, fuzzy });
  } catch (err) {
    // Every retry was exhausted — report it instead of returning an empty list
    // that the UI would render as "card not found".
    console.error("cards/lookup failed:", err);
    return NextResponse.json(
      { error: "Card lookup failed. Please try again." },
      { status: 503 },
    );
  }
}
