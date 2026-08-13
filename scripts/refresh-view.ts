/**
 * Refreshes the cards_playable materialized view.
 * Run with: pnpm refresh:view
 *
 * The Scryfall sync does this automatically at the end of a full run. This is
 * for refreshing after a manual data change without re-running a whole sync.
 *
 * Note: no top-level await — tsx transpiles these scripts to CJS, which does not
 * support it. Same main()/catch shape as sync-scryfall.ts.
 */
import { createServiceClient } from "../packages/db/src/client";

async function main() {
  const supabase = createServiceClient();
  const t0 = Date.now();
  const { error } = await supabase.rpc("refresh_cards_playable");
  if (error) throw new Error(error.message);
  console.log(`cards_playable refreshed in ${Date.now() - t0}ms`);
}

main().catch((err) => {
  console.error("Refresh failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
