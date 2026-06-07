import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

interface ImportCard {
  oracle_id: string;
  quantity_regular: number;
  quantity_foil: number;
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const cards: ImportCard[] = Array.isArray(body.cards) ? body.cards : [];

  if (cards.length === 0)
    return NextResponse.json({ error: "No cards provided" }, { status: 400 });

  const { data, error } = await supabase.rpc("upsert_collection_cards", {
    p_user_id: user.id,
    p_oracle_ids: cards.map((c) => c.oracle_id),
    p_quantities_regular: cards.map((c) => c.quantity_regular),
    p_quantities_foil: cards.map((c) => c.quantity_foil),
    p_source: "untapped",
  });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ imported: data });
}
