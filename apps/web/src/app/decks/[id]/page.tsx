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

  // Hydrate card details for each oracle_id
  const oracleIds = [...new Set(deck.deck_cards.map((dc) => dc.oracle_id))];
  const cardMap: Record<string, unknown> = {};
  if (oracleIds.length > 0) {
    const { data: cards } = await supabase
      .from("cards")
      .select(
        "oracle_id, name, mana_cost, cmc, type_line, colors, image_uri_normal, rarity",
      )
      .in("oracle_id", oracleIds);
    for (const card of cards ?? []) {
      if (!cardMap[card.oracle_id]) cardMap[card.oracle_id] = card;
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
