import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Accepts either:
//   { items: [{name, setCode?, collectorNumber?}] }  — structured (preferred)
//   { names: string[] }                               — legacy name-only
//
// Items with both setCode+collectorNumber are looked up via set/collector RPC
// (precise, single-printing match). Name-only items fall back to lookup_cards_by_names.

interface LookupItem {
  name: string;
  setCode?: string | null;
  collectorNumber?: string | null;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));

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
    return NextResponse.json([]);
  }

  if (items.length === 0) return NextResponse.json([]);

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

  if (bySetCollector.length > 0) {
    const setCodes = bySetCollector.map((i) => i.setCode!.trim());
    const collectorNumbers = bySetCollector.map((i) =>
      i.collectorNumber!.trim(),
    );

    const { data, error } = await supabase.rpc(
      "lookup_cards_by_set_collector",
      {
        p_set_codes: setCodes,
        p_collector_numbers: collectorNumbers,
      },
    );

    if (error) {
      console.error("lookup_cards_by_set_collector error:", error);
    } else if (data) {
      results.push(...data);
    }

    // Any items not matched by set+collector fall back to name lookup.
    const foundKeys = new Set(
      (data ?? []).map((r: { set_code: string; collector_number: string }) =>
        setCollectorKey(r.set_code, r.collector_number),
      ),
    );
    const missed = bySetCollector.filter(
      (i) => !foundKeys.has(setCollectorKey(i.setCode!, i.collectorNumber!)),
    );
    byName.push(...missed);
  }

  if (byName.length > 0) {
    const uniqueNames = [...new Set(byName.map((i) => i.name.trim()))];
    const { data, error } = await supabase.rpc("lookup_cards_by_names", {
      p_names: uniqueNames,
    });

    if (error) {
      console.error("lookup_cards_by_names error:", error);
    } else if (data) {
      results.push(...data);
    }
  }

  return NextResponse.json(results);
}
