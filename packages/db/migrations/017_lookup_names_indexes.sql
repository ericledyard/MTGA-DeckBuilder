-- Migration 017: make card-name lookup index-driven, and add a fuzzy fallback
--
-- Problem
-- -------
-- `lookup_cards_by_names` seq-scanned all ~114k rows of `cards` on every call,
-- evaluating lower(name) and split_part(name, ' // ', 1) per row. Warm that is
-- ~470ms; cold it measured 5,449ms on an 88-name deck import.
--
-- Supabase pins statement_timeout per role — anon 3s, authenticated 8s — so the
-- import RPC was being cancelled mid-query. PostgREST returned an error, the API
-- route swallowed it and returned [], and the import modal reported every card
-- as "not found". Small lists stayed under the limit, which is why this looked
-- intermittent rather than broken.
--
-- Two causes, both fixed here:
--   1. There was no index on lower(name) at all. cards_name_trgm_idx is a GIN
--      trigram index — it serves fuzzy `%` matching, not equality.
--   2. The predicate `lower(c.name) = ANY(SELECT lower(unnest(p_names)))` plans
--      as a hashed SubPlan filter over a seq scan. Even with an index present,
--      that form can never drive an index scan.

-- 1. Equality index for the normal name match.
CREATE INDEX IF NOT EXISTS cards_lower_name_idx
  ON cards (lower(name));

-- 2. Partial index for the DFC front-face match added in migration 013.
--    Partial because only ~1% of rows are split names; the planner picks it up
--    as long as the query repeats the `name LIKE '% // %'` predicate.
CREATE INDEX IF NOT EXISTS cards_lower_front_face_idx
  ON cards (lower(split_part(name, ' // ', 1)))
  WHERE name LIKE '% // %';

ANALYZE cards;

-- 3. Rewrite the lookup so each branch is an index-driven join.
--
-- The name list becomes a CTE that drives a nested loop into `cards`, and the
-- two match branches are UNION ALL'd rather than OR'd — an OR across two
-- different expressions forces a single scan that can only use one index (in
-- practice, neither). Signature and result columns are unchanged.
CREATE OR REPLACE FUNCTION lookup_cards_by_names(p_names text[])
RETURNS TABLE (
  id uuid,
  oracle_id text,
  name text,
  mana_cost text,
  cmc numeric,
  type_line text,
  colors text[],
  image_uri_normal text,
  rarity card_rarity,
  available_on_arena boolean,
  set_code text,
  collector_number text
)
LANGUAGE sql STABLE AS $$
  WITH wanted AS (
    SELECT DISTINCT lower(trim(n)) AS n
    FROM unnest(p_names) AS n
    WHERE trim(coalesce(n, '')) <> ''
  ),
  matched AS (
    -- Exact name match.
    SELECT c.*
    FROM wanted w
    JOIN cards c ON lower(c.name) = w.n

    UNION ALL

    -- DFC / split card: the decklist carries the front face only.
    SELECT c.*
    FROM wanted w
    JOIN cards c
      ON c.name LIKE '% // %'
     AND lower(split_part(c.name, ' // ', 1)) = w.n
  )
  SELECT DISTINCT ON (lower(m.name))
    m.id, m.oracle_id, m.name, m.mana_cost, m.cmc, m.type_line,
    m.colors, m.image_uri_normal, m.rarity, m.available_on_arena,
    m.set_code, m.collector_number
  FROM matched m
  WHERE m.oracle_id IS NOT NULL
  ORDER BY
    lower(m.name),
    m.available_on_arena DESC,
    (m.image_uri_normal IS NOT NULL) DESC;
$$;

GRANT EXECUTE ON FUNCTION lookup_cards_by_names(text[]) TO anon, authenticated;

-- 4. Fuzzy fallback, for names exact matching genuinely misses (typos,
--    punctuation drift, truncated names).
--
-- Runs only on the leftovers, never on the whole list — fuzzy matching is far
-- more expensive than equality, so putting it in the main path would recreate
-- the timeout this migration exists to remove.
--
-- `c.name % w.n` is the pg_trgm similarity operator and is served by the
-- existing cards_name_trgm_idx. p_threshold then filters the candidates: 0.45
-- is loose enough for real typos and tight enough to avoid matching a different
-- card. Returns query_name so the caller can map results back to input rows.
--
-- pg_trgm.similarity_threshold controls how many candidate rows the `%` operator
-- pulls out of the GIN index, and at its 0.3 default a 6-name probe measured
-- 2,688ms cold. Raising it to p_threshold cuts that by an order of magnitude.
--
-- It has to be set via pg_trgm's own set_limit() rather than an `ALTER FUNCTION
-- ... SET` clause: Supabase does not grant permission to set that parameter on a
-- function. set_limit() is session state and PostgREST pools connections, so the
-- previous value is captured and restored before returning — otherwise this
-- would silently retune every later `%` query on the same pooled connection.
-- That makes the function VOLATILE rather than STABLE.
CREATE OR REPLACE FUNCTION lookup_cards_fuzzy(
  p_names text[],
  p_threshold real DEFAULT 0.45
)
RETURNS TABLE (
  query_name text,
  score real,
  id uuid,
  oracle_id text,
  name text,
  mana_cost text,
  cmc numeric,
  type_line text,
  colors text[],
  image_uri_normal text,
  rarity card_rarity,
  available_on_arena boolean,
  set_code text,
  collector_number text
)
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  prev_limit real;
BEGIN
  prev_limit := show_limit();
  PERFORM set_limit(p_threshold);

  RETURN QUERY
  WITH wanted AS (
    SELECT DISTINCT trim(n) AS n
    FROM unnest(p_names) AS n
    WHERE trim(coalesce(n, '')) <> ''
  )
  SELECT DISTINCT ON (w.n)
    w.n AS query_name,
    similarity(c.name, w.n) AS score,
    c.id, c.oracle_id, c.name, c.mana_cost, c.cmc, c.type_line,
    c.colors, c.image_uri_normal, c.rarity, c.available_on_arena,
    c.set_code, c.collector_number
  FROM wanted w
  CROSS JOIN LATERAL (
    SELECT c2.*
    FROM cards c2
    WHERE c2.oracle_id IS NOT NULL
      AND c2.name % w.n
    ORDER BY
      similarity(c2.name, w.n) DESC,
      c2.available_on_arena DESC,
      (c2.image_uri_normal IS NOT NULL) DESC
    LIMIT 5
  ) c
  ORDER BY
    w.n,
    similarity(c.name, w.n) DESC,
    c.available_on_arena DESC,
    (c.image_uri_normal IS NOT NULL) DESC;

  PERFORM set_limit(prev_limit);
EXCEPTION WHEN OTHERS THEN
  PERFORM set_limit(prev_limit);
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION lookup_cards_fuzzy(text[], real) TO anon, authenticated;

-- Pin search_path, matching the policy established in migration 016.
-- pg_trgm lives in `public` on this project (see gin_trgm_ops above), but
-- `extensions` is included so a from-scratch replay onto a stock Supabase
-- project — where Supabase installs it into `extensions` — still resolves.
ALTER FUNCTION lookup_cards_by_names(text[])
  SET search_path = public, extensions, pg_temp;
ALTER FUNCTION lookup_cards_fuzzy(text[], real)
  SET search_path = public, extensions, pg_temp;
