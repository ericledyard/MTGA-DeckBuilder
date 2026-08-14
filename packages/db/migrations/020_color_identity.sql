-- Migration 020: expose color_identity and oracle_text on every RPC that puts a
-- card into a deck, and fix two long-standing bugs in
-- lookup_cards_by_set_collector.
--
-- Why
-- ---
-- Commander and Brawl decks are bounded by the commander's *color identity*,
-- which is not the same thing as its colors: a card costing {2} with a "{B}:"
-- ability has colors = {} and color_identity = {B}. Every RPC returned `colors`
-- and none returned `color_identity`, so the rule could not be enforced at all.
--
-- oracle_text comes along for the same reason. A legal commander is a legendary
-- creature, a planeswalker that says so, or a card whose text reads "can be your
-- commander" (Backgrounds, Grist-style oddities). Without the text, that last
-- group gets wrongly rejected.
--
-- Both columns already exist on `cards` and on the cards_playable view; they
-- were simply never projected.
--
-- Bugs fixed here
-- ---------------
-- lookup_cards_by_set_collector declared RETURNS TABLE (... type_line, rarity
-- ...) but selected (... rarity, type_line ...). Postgres matches those
-- positionally, so every caller got them swapped. Verified against production
-- before this migration: (hob, 1) returned
--   rarity    = 'Creature — Dog'
--   type_line = 'common'
-- Any decklist imported with "(SET) collector" lines therefore had a garbage
-- type line, which silently broke type grouping in the deck list, the mana
-- curve's land exclusion, and — had it shipped first — commander detection.
--
-- The same function also filtered on `c.set_type`, a column that does not exist
-- on `cards` (migration 007 was never applied to production; information_schema
-- confirms 0 such columns). It now joins `sets`, matching migration 014.

-- ── search_cards ─────────────────────────────────────────────────────────────
-- Identical to migration 019 apart from the two added output columns.

DROP FUNCTION IF EXISTS search_cards(text, text, boolean, integer, text[], integer[], text[], text[], text[], text, boolean, uuid, integer, text);

CREATE OR REPLACE FUNCTION search_cards(
  p_query        text      DEFAULT '',
  p_format       text      DEFAULT '',
  p_arena_only   boolean   DEFAULT false,
  p_limit        integer   DEFAULT 48,
  p_colors       text[]    DEFAULT NULL,
  p_cmc_values   integer[] DEFAULT NULL,
  p_rarities     text[]    DEFAULT NULL,
  p_types        text[]    DEFAULT NULL,
  p_set_codes    text[]    DEFAULT NULL,
  p_text_query   text      DEFAULT '',
  p_owned_only   boolean   DEFAULT false,
  p_user_id      uuid      DEFAULT NULL,
  p_offset       integer   DEFAULT 0,
  p_sort         text      DEFAULT 'released'
)
RETURNS TABLE (
  id uuid, oracle_id text, name text, mana_cost text, cmc numeric,
  type_line text, colors text[], color_identity text[], oracle_text text,
  rarity card_rarity, image_uri_normal text,
  image_uri_art_crop text, available_on_arena boolean, is_alchemy boolean,
  set_code text, set_name text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $fn$
DECLARE
  order_sql text;
BEGIN
  order_sql := CASE p_sort
    WHEN 'cmc'  THEN 'c.cmc ASC, c.name ASC'
    WHEN 'name' THEN 'c.name ASC'
    ELSE             'c.is_unreleased ASC, c.released_at DESC NULLS LAST, c.name ASC'
  END;

  RETURN QUERY EXECUTE format($q$
    SELECT
      c.id, c.oracle_id, c.name, c.mana_cost, c.cmc, c.type_line, c.colors,
      c.color_identity, c.oracle_text,
      c.rarity, c.image_uri_normal, c.image_uri_art_crop, c.available_on_arena,
      c.is_alchemy, c.set_code, c.set_name
    FROM cards_playable c
    WHERE
      ($1 = '' OR c.name ILIKE '%%' || $1 || '%%')
      AND ($2 = '' OR c.oracle_text ILIKE '%%' || $2 || '%%')
      AND (NOT $3 OR c.available_on_arena = true)
      AND (
        $4 = ''
        OR EXISTS (
          SELECT 1 FROM card_legalities cl
          WHERE cl.oracle_id = c.oracle_id
            AND cl.format = $4::mtg_format
            AND cl.status = 'legal'
        )
        OR (
          c.is_unreleased
          AND presumed_format_legality(
                c.set_type, c.available_on_arena, c.rarity::text, $4
              )
        )
      )
      AND (
        $5 IS NULL
        OR (c.colors = '{}' AND 'C' = ANY($5))
        OR (c.colors != '{}' AND c.colors <@ array_remove($5, 'C'))
      )
      AND (
        $6 IS NULL
        OR floor(c.cmc)::integer = ANY(array_remove($6, 7))
        OR (7 = ANY($6) AND c.cmc >= 7)
      )
      AND ($7 IS NULL OR c.rarity::text = ANY($7))
      AND (
        $8 IS NULL
        OR EXISTS (
          SELECT 1 FROM unnest($8) AS t(type_name)
          WHERE c.type_line ILIKE '%%' || t.type_name || '%%'
        )
      )
      AND ($9 IS NULL OR c.set_codes && $9)
      AND (
        NOT $10
        OR $11 IS NULL
        OR EXISTS (
          SELECT 1 FROM user_collections uc
          WHERE uc.user_id = $11
            AND uc.oracle_id = c.oracle_id
            AND (uc.quantity_regular + uc.quantity_foil) > 0
        )
      )
    ORDER BY %s
    LIMIT $12 OFFSET $13
  $q$, order_sql)
  USING p_query, p_text_query, p_arena_only, p_format, p_colors, p_cmc_values,
        p_rarities, p_types, p_set_codes, p_owned_only, p_user_id,
        p_limit, p_offset;
END;
$fn$;

GRANT EXECUTE ON FUNCTION search_cards(text, text, boolean, integer, text[], integer[], text[], text[], text[], text, boolean, uuid, integer, text) TO anon, authenticated;

ALTER FUNCTION search_cards(text, text, boolean, integer, text[], integer[], text[], text[], text[], text, boolean, uuid, integer, text)
  SET search_path = public, extensions, pg_temp;

-- ── lookup_cards_by_names ────────────────────────────────────────────────────
-- Body unchanged from migration 017 (which owns the index-friendly CTE shape);
-- only the projection grows.

DROP FUNCTION IF EXISTS lookup_cards_by_names(text[]);

CREATE OR REPLACE FUNCTION lookup_cards_by_names(p_names text[])
RETURNS TABLE (
  id uuid,
  oracle_id text,
  name text,
  mana_cost text,
  cmc numeric,
  type_line text,
  colors text[],
  color_identity text[],
  oracle_text text,
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
    m.colors, m.color_identity, m.oracle_text,
    m.image_uri_normal, m.rarity, m.available_on_arena,
    m.set_code, m.collector_number
  FROM matched m
  WHERE m.oracle_id IS NOT NULL
  ORDER BY
    lower(m.name),
    m.available_on_arena DESC,
    (m.image_uri_normal IS NOT NULL) DESC;
$$;

GRANT EXECUTE ON FUNCTION lookup_cards_by_names(text[]) TO anon, authenticated;

ALTER FUNCTION lookup_cards_by_names(text[])
  SET search_path = public, extensions, pg_temp;

-- ── lookup_cards_fuzzy ───────────────────────────────────────────────────────
-- Body unchanged from migration 017, including the set_limit save/restore that
-- keeps a pooled connection from inheriting a retuned similarity threshold.

DROP FUNCTION IF EXISTS lookup_cards_fuzzy(text[], real);

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
  color_identity text[],
  oracle_text text,
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
    c.colors, c.color_identity, c.oracle_text,
    c.image_uri_normal, c.rarity, c.available_on_arena,
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

ALTER FUNCTION lookup_cards_fuzzy(text[], real)
  SET search_path = public, extensions, pg_temp;

-- ── lookup_cards_by_set_collector ────────────────────────────────────────────
-- Rewritten. See the header: the old version returned type_line and rarity
-- swapped, and filtered on a column that does not exist.

DROP FUNCTION IF EXISTS lookup_cards_by_set_collector(text[], text[]);

CREATE OR REPLACE FUNCTION lookup_cards_by_set_collector(
  p_set_codes         text[],
  p_collector_numbers text[]
)
RETURNS TABLE (
  id uuid,
  oracle_id text,
  name text,
  mana_cost text,
  cmc numeric,
  type_line text,
  colors text[],
  color_identity text[],
  oracle_text text,
  image_uri_normal text,
  rarity card_rarity,
  available_on_arena boolean,
  set_code text,
  collector_number text
)
LANGUAGE sql STABLE AS $$
  SELECT DISTINCT ON (lower(c.set_code), lower(c.collector_number))
    c.id, c.oracle_id, c.name, c.mana_cost, c.cmc, c.type_line,
    c.colors, c.color_identity, c.oracle_text,
    c.image_uri_normal, c.rarity, c.available_on_arena,
    c.set_code, c.collector_number
  FROM cards c
  JOIN sets s ON s.code = c.set_code
  WHERE (lower(c.set_code), lower(c.collector_number)) IN (
    SELECT lower(t.s), lower(t.n)
    FROM unnest(p_set_codes, p_collector_numbers) AS t(s, n)
  )
    AND c.oracle_id IS NOT NULL
    AND s.set_type NOT IN ('token', 'memorabilia')
  ORDER BY
    lower(c.set_code),
    lower(c.collector_number),
    (c.image_uri_normal IS NOT NULL) DESC;
$$;

GRANT EXECUTE ON FUNCTION lookup_cards_by_set_collector(text[], text[]) TO anon, authenticated;

ALTER FUNCTION lookup_cards_by_set_collector(text[], text[])
  SET search_path = public, extensions, pg_temp;

-- ── get_cards_by_oracle_ids ──────────────────────────────────────────────────
-- Hydrates a saved deck on page load. Without color_identity here, a logged-in
-- Commander deck would lose its colour rules on every reload.

DROP FUNCTION IF EXISTS get_cards_by_oracle_ids(text[]);

CREATE OR REPLACE FUNCTION get_cards_by_oracle_ids(p_oracle_ids text[])
RETURNS TABLE (
  oracle_id        text,
  name             text,
  mana_cost        text,
  cmc              numeric,
  type_line        text,
  rarity           text,
  image_uri_normal text,
  colors           text[],
  color_identity   text[],
  oracle_text      text,
  set_code         text,
  collector_number text
)
LANGUAGE sql STABLE AS $$
  SELECT
    sub.oracle_id, sub.name, sub.mana_cost, sub.cmc, sub.type_line, sub.rarity,
    sub.image_uri_normal, sub.colors, sub.color_identity, sub.oracle_text,
    sub.set_code, sub.collector_number
  FROM (
    SELECT DISTINCT ON (c.oracle_id)
      c.oracle_id, c.name, c.mana_cost, c.cmc, c.type_line, c.rarity::text,
      c.image_uri_normal, c.colors, c.color_identity, c.oracle_text,
      c.set_code, c.collector_number
    FROM cards c
    WHERE c.oracle_id = ANY(p_oracle_ids)
    ORDER BY c.oracle_id, (c.image_uri_normal IS NOT NULL) DESC
  ) sub;
$$;

GRANT EXECUTE ON FUNCTION get_cards_by_oracle_ids(text[]) TO anon, authenticated;

ALTER FUNCTION get_cards_by_oracle_ids(text[])
  SET search_path = public, extensions, pg_temp;
