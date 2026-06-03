import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
// Sync can take minutes — set max duration for Vercel Pro/Enterprise
export const maxDuration = 300;

// Simple bearer-token guard so this endpoint isn't publicly triggerable
function isAuthorized(req: NextRequest): boolean {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return token === process.env.SYNC_SECRET;
}

export async function POST(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Run sync in background — respond immediately so Vercel doesn't timeout the HTTP connection
  // The actual sync runs via the script; here we just trigger a Supabase Edge Function or a
  // background job. For now, return an acknowledgement and rely on the cron job / manual script.
  return NextResponse.json({
    status: "sync_triggered",
    message: "Run: pnpm tsx scripts/sync-scryfall.ts",
  });
}

// Called by Vercel cron (vercel.json) — no auth needed since Vercel signs cron requests
export async function GET() {
  return NextResponse.json({
    status: "ok",
    message: "Use POST with Authorization header to trigger sync",
  });
}
