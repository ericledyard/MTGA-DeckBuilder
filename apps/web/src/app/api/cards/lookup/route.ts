import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// Uses supabase.rpc() (POST body) instead of .in() (URL query string).
// The .in() approach fails for names containing commas because PostgREST
// serialises them unquoted in the URL and the Supabase JS client doesn't
// always escape them correctly.

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

  const { data, error } = await supabase.rpc("lookup_cards_by_names", {
    p_names: uniqueNames,
  });

  if (error) {
    console.error("lookup_cards_by_names error:", error);
    return NextResponse.json([], { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
