import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

async function authedDeckUser(deckId: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null };

  // Confirm ownership
  const { data } = await supabase
    .from("decks")
    .select("id")
    .eq("id", deckId)
    .eq("user_id", user.id)
    .single();

  return { supabase, user: data ? user : null };
}

// POST — add or upsert a card (increment quantity if already present)
export async function POST(request: NextRequest, { params }: Params) {
  const { id: deckId } = await params;
  const { supabase, user } = await authedDeckUser(deckId);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const {
    oracle_id,
    quantity = 1,
    is_sideboard = false,
  } = await request.json();
  if (!oracle_id)
    return NextResponse.json({ error: "oracle_id required" }, { status: 400 });

  // Try to increment existing row first
  const { data: existing } = await supabase
    .from("deck_cards")
    .select("quantity")
    .eq("deck_id", deckId)
    .eq("oracle_id", oracle_id)
    .eq("is_sideboard", is_sideboard)
    .single();

  const newQty = (existing?.quantity ?? 0) + quantity;

  const { data, error } = await supabase
    .from("deck_cards")
    .upsert(
      {
        deck_id: deckId,
        oracle_id,
        quantity: newQty,
        is_sideboard,
        is_companion: false,
      },
      { onConflict: "deck_id,oracle_id,is_sideboard" },
    )
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  // Bump deck updated_at
  await supabase
    .from("decks")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", deckId);

  return NextResponse.json(data, { status: 201 });
}

// DELETE — remove all cards from the deck
export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id: deckId } = await params;
  const { supabase, user } = await authedDeckUser(deckId);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await supabase.from("deck_cards").delete().eq("deck_id", deckId);

  await supabase
    .from("decks")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", deckId);

  return new NextResponse(null, { status: 204 });
}

// PUT — set exact quantity (or remove if quantity <= 0)
export async function PUT(request: NextRequest, { params }: Params) {
  const { id: deckId } = await params;
  const { supabase, user } = await authedDeckUser(deckId);
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { oracle_id, quantity, is_sideboard = false } = await request.json();
  if (!oracle_id || quantity === undefined)
    return NextResponse.json(
      { error: "oracle_id and quantity required" },
      { status: 400 },
    );

  if (quantity <= 0) {
    await supabase
      .from("deck_cards")
      .delete()
      .eq("deck_id", deckId)
      .eq("oracle_id", oracle_id)
      .eq("is_sideboard", is_sideboard);

    await supabase
      .from("decks")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", deckId);

    return new NextResponse(null, { status: 204 });
  }

  const { data, error } = await supabase
    .from("deck_cards")
    .upsert(
      {
        deck_id: deckId,
        oracle_id,
        quantity,
        is_sideboard,
        is_companion: false,
      },
      { onConflict: "deck_id,oracle_id,is_sideboard" },
    )
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase
    .from("decks")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", deckId);

  return NextResponse.json(data);
}
