import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ oracle_id: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { oracle_id } = await params;
  const body = await request.json().catch(() => ({}));
  const quantity_regular: number = body.quantity_regular ?? 0;
  const quantity_foil: number = body.quantity_foil ?? 0;

  const { error } = await supabase.rpc("update_collection_card", {
    p_user_id: user.id,
    p_oracle_id: oracle_id,
    p_qty_regular: quantity_regular,
    p_qty_foil: quantity_foil,
  });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ oracle_id: string }> },
) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { oracle_id } = await params;

  const { error } = await supabase.rpc("remove_collection_card", {
    p_user_id: user.id,
    p_oracle_id: oracle_id,
  });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return new NextResponse(null, { status: 204 });
}
