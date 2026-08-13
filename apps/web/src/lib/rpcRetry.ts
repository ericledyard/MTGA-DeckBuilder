/**
 * Retry helper for Supabase RPC calls.
 *
 * Supabase pauses idle projects and pins a statement_timeout per role, so the
 * first query after a quiet period can be cancelled ("canceling statement due to
 * statement timeout") even when the query is fast once its pages are cached.
 * Those failures succeed on a retry, so a cold start should not reach the user.
 *
 * Callers must surface an unrecoverable failure as a non-2xx response. Returning
 * an empty array instead makes a failed query indistinguishable from "no rows
 * matched", which is how a timeout once surfaced in the UI as "88 cards not
 * found" and as "No cards found" in the card grid.
 */

export const RETRY_DELAYS_MS = [250, 750, 1500];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function rpcWithRetry<T>(
  label: string,
  // Supabase's rpc() returns a thenable query builder, not a real Promise.
  run: () => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  delays: number[] = RETRY_DELAYS_MS,
): Promise<T> {
  let lastError = "unknown error";

  for (let attempt = 0; attempt <= delays.length; attempt++) {
    if (attempt > 0) await sleep(delays[attempt - 1]);

    const { data, error } = await run();
    if (!error) return (data ?? []) as T;

    lastError = error.message;
    console.error(
      `${label} failed (attempt ${attempt + 1}/${delays.length + 1}):`,
      error.message,
    );
  }

  throw new Error(`${label}: ${lastError}`);
}

/** Splits a list into fixed-size batches to bound the cost of any single query. */
export function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
