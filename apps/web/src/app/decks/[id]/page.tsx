import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DeckEditor } from "@/components/decks/DeckEditor";

type Props = { params: Promise<{ id: string }> };

export default async function DeckPage({ params }: Props) {
  const { id } = await params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: deck, error } = await supabase
    .from("decks")
    .select(
      "*, deck_cards(oracle_id, quantity, is_sideboard, is_companion, is_commander)",
    )
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error || !deck) notFound();

  // Hydrate card details for each oracle_id.
  // Uses an RPC with DISTINCT ON to return exactly one row per oracle_id —
  // the direct .in() query returns all printings and hits PostgREST's
  // 1000-row default limit when cards have many reprints (basic lands, etc.).
  const oracleIds = [...new Set(deck.deck_cards.map((dc) => dc.oracle_id))];
  const cardMap: Record<string, unknown> = {};
  if (oracleIds.length > 0) {
    const { data: cards } = await supabase.rpc("get_cards_by_oracle_ids", {
      p_oracle_ids: oracleIds,
    });
    for (const card of cards ?? []) {
      cardMap[card.oracle_id] = card;
    }
  }

  const deckWithCards = {
    ...deck,
    deck_cards: deck.deck_cards.map((dc) => ({
      ...dc,
      card:
        (cardMap[dc.oracle_id] as {
          name: string;
          mana_cost: string | null;
          cmc: number;
          type_line: string;
          colors: string[];
          image_uri_normal: string | null;
          rarity: string;
        }) ?? null,
    })),
  };

  return <DeckEditor deck={deckWithCards} />;
}
