import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("decks")
    .select(
      `id, name, format, description, is_public, cover_card_id, created_at, updated_at,
       deck_cards(count)`,
    )
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { name, format, description } = body;
  if (!name || !format) {
    return NextResponse.json(
      { error: "name and format are required" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("decks")
    .insert({
      user_id: user.id,
      name,
      format,
      description: description ?? null,
    })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
