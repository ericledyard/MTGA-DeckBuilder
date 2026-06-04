import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ id: string }> };

async function getAuthedDeck(id: string) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, deck: null, error: "Unauthorized" };

  const { data: deck, error } = await supabase
    .from("decks")
    .select(`*, deck_cards(oracle_id, quantity, is_sideboard, is_companion)`)
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !deck)
    return { supabase, user, deck: null, error: error?.message ?? null };

  // Hydrate card details — deck_cards has no FK to cards, so two-query approach
  const oracleIds = [
    ...new Set((deck.deck_cards ?? []).map((dc) => dc.oracle_id)),
  ];
  let cardMap: Record<string, unknown> = {};
  if (oracleIds.length > 0) {
    const { data: cards } = await supabase
      .from("cards")
      .select(
        "oracle_id, name, mana_cost, cmc, type_line, colors, image_uri_normal, rarity",
      )
      .in("oracle_id", oracleIds);
    // One card per oracle_id — take first printing found
    for (const card of cards ?? []) {
      if (!cardMap[card.oracle_id]) cardMap[card.oracle_id] = card;
    }
  }

  const deckWithCards = {
    ...deck,
    deck_cards: (deck.deck_cards ?? []).map((dc) => ({
      ...dc,
      card: cardMap[dc.oracle_id] ?? null,
    })),
  };

  return { supabase, user, deck: deckWithCards, error: null };
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { deck, error } = await getAuthedDeck(id);
  if (error === "Unauthorized")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (error || !deck)
    return NextResponse.json({ error: error ?? "Not found" }, { status: 404 });
  return NextResponse.json(deck);
}

export async function PUT(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user, error: authError } = await getAuthedDeck(id);
  if (authError === "Unauthorized" || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, format, description, is_public } = body;

  const { data, error } = await supabase
    .from("decks")
    .update({
      ...(name !== undefined && { name }),
      ...(format !== undefined && { format }),
      ...(description !== undefined && { description }),
      ...(is_public !== undefined && { is_public }),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user, error: authError } = await getAuthedDeck(id);
  if (authError === "Unauthorized" || !user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { error } = await supabase
    .from("decks")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
