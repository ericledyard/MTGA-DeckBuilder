import { NextResponse } from "next/server";
import { createServiceClient } from "@mtga/db";

export const runtime = "nodejs";

export async function GET() {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("sets")
    .select("code, name, icon_svg_uri, released_at, available_on_arena")
    .order("released_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data ?? []);
}
