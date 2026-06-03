import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@mtga/db";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: card, error } = await supabase
    .from("cards")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !card) {
    return NextResponse.json({ error: "Card not found" }, { status: 404 });
  }

  const { data: legalities } = await supabase
    .from("card_legalities")
    .select("format, status")
    .eq("oracle_id", card.oracle_id);

  return NextResponse.json({ card, legalities: legalities ?? [] });
}
