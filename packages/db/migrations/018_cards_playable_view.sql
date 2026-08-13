-- Migration 018: materialized view of the playable card pool, and a search_cards
-- that reads from it instead of de-duplicating the whole catalogue per query.
--
-- Why
-- ---
-- search_cards did `DISTINCT ON (c.oracle_id)` across all ~116k printings, sorted
-- every distinct card by (cmc, name), and only then applied LIMIT/OFFSET. An
-- unfiltered browse touched ~116k shared buffers against a 226MB table: ~215ms
-- warm, 11.3s cold, and cold runs were cancelled by the statement timeout and
-- surfaced in the UI as "No cards found".
--
-- No index can fix that shape — the dedup-then-sort has to materialise the whole
-- catalogue before it can page. So the dedup moves off the query path and into a
-- view refreshed by the sync.
--
-- The view also carries the "playable pool" definition, so there is exactly one
-- place that decides what a player can browse:
--
--   * one row per oracle_id, preferring a printing that has an image, then a
--     real expansion/core set, then Arena availability, then the newest set
--   * excludes set types that are not playable cards at all — tokens,
--     memorabilia (World Championship ad cards), minigames, vanguards,
--     archenemy schemes, planechase planes, funny/Un-sets, treasure chests
--   * excludes non-deck card types by type_line — schemes, planes, phenomena,
--     vanguards, emblems, tokens, and the "Card"/"Card // Card" placeholders
--
-- Deliberately KEPT: Alchemy rebalances (A- cards) and unreleased previews.
-- Filtering by format legality was considered and rejected — unreleased cards
-- carry legality rows that are all `not_legal`, so a legality filter deletes
-- exactly the upcoming sets players most want to see.
--
-- Measured before: 37,598 distinct cards, first page was a blank placeholder
-- land and nine World Championship advertisements. After: 33,084 cards, every
-- one with an image, first page is real cards from the newest set.

DROP MATERIALIZED VIEW IF EXISTS cards_playable CASCADE;

-- Set filtering needs care once the view keeps one printing per card. Filtering
-- on the chosen printing's set_code silently drops reprints whose preferred
-- printing lives elsewhere — measured 24% of Lord of the Rings and 17% of M21
-- missing, and every basic land vanishing from a new set because a newer set
-- outranked it. So the view also carries every eligible set a card appears in,
-- and search_cards filters with array overlap against that.
CREATE MATERIALIZED VIEW cards_playable AS
WITH eligible AS (
  SELECT c.*, s.released_at, s.set_type
  FROM cards c
  JOIN sets s ON s.code = c.set_code
  WHERE c.oracle_id IS NOT NULL
    AND s.set_type NOT IN (
      'token', 'memorabilia', 'minigame', 'vanguard',
      'archenemy', 'planechase', 'funny', 'treasure_chest'
    )
    AND c.type_line NOT ILIKE '%scheme%'
    AND c.type_line NOT ILIKE 'plane %'      -- "Plane — Alara"; "Planeswalker" has no space
    AND c.type_line NOT ILIKE '%phenomenon%'
    AND c.type_line NOT ILIKE '%vanguard%'
    AND c.type_line NOT ILIKE '%emblem%'
    AND c.type_line NOT ILIKE '%token%'
    AND c.type_line <> 'Card'                -- World Championship ad cards
    AND c.type_line NOT ILIKE 'card // card'
),
sets_per_card AS (
  SELECT oracle_id, array_agg(DISTINCT set_code) AS set_codes
  FROM eligible
  GROUP BY oracle_id
),
ranked AS (
  SELECT
    c.id,
    c.oracle_id,
    c.name,
    c.mana_cost,
    c.cmc,
    c.type_line,
    c.oracle_text,
    c.colors,
    c.color_identity,
    c.rarity,
    c.image_uri_normal,
    c.image_uri_art_crop,
    c.available_on_arena,
    c.is_alchemy,
    c.set_code,
    c.set_name,
    c.collector_number,
    c.released_at,
    c.set_type,
    ROW_NUMBER() OVER (
      PARTITION BY c.oracle_id
      ORDER BY
        (c.image_uri_normal IS NOT NULL) DESC,
        (c.set_type IN ('expansion', 'core')) DESC,
        c.available_on_arena DESC,
        c.released_at DESC NULLS LAST,
        c.collector_number
    ) AS rn
  FROM eligible c
)
SELECT
  r.id, r.oracle_id, r.name, r.mana_cost, r.cmc, r.type_line, r.oracle_text,
  r.colors, r.color_identity, r.rarity, r.image_uri_normal, r.image_uri_art_crop,
  r.available_on_arena, r.is_alchemy, r.set_code, r.set_name, r.collector_number,
  r.released_at,
  sp.set_codes
FROM ranked r
JOIN sets_per_card sp ON sp.oracle_id = r.oracle_id
WHERE r.rn = 1;

-- Unique index is REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY, which is
-- what keeps the browser readable while the sync refreshes.
CREATE UNIQUE INDEX cards_playable_oracle_id_idx ON cards_playable (oracle_id);

-- Default browse order: newest sets first. Matches the ORDER BY in search_cards
-- exactly so the planner can walk the index and stop at LIMIT.
CREATE INDEX cards_playable_released_idx
  ON cards_playable (released_at DESC NULLS LAST, name ASC);

-- Alternate order, kept fast so alphabetical/cost sorting stays index-backed.
CREATE INDEX cards_playable_cmc_name_idx ON cards_playable (cmc ASC, name ASC);

-- Search indexes, mirroring the ones on `cards`.
CREATE INDEX cards_playable_name_trgm_idx
  ON cards_playable USING gin (name gin_trgm_ops);
CREATE INDEX cards_playable_oracle_text_trgm_idx
  ON cards_playable USING gin (oracle_text gin_trgm_ops);
-- GIN so the `set_codes && $9` overlap filter is index-backed.
CREATE INDEX cards_playable_set_codes_idx ON cards_playable USING gin (set_codes);
CREATE INDEX cards_playable_arena_idx
  ON cards_playable (available_on_arena) WHERE available_on_arena = true;

ANALYZE cards_playable;

-- search_cards now reads the view. Signature gains p_sort; result columns are
-- unchanged so existing callers keep working.
DROP FUNCTION IF EXISTS search_cards(text, text, boolean, integer, text[], integer[], text[], text[], text[], text, boolean, uuid, integer);

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
  type_line text, colors text[], rarity card_rarity, image_uri_normal text,
  image_uri_art_crop text, available_on_arena boolean, is_alchemy boolean,
  set_code text, set_name text
)
-- plpgsql with a dynamic ORDER BY rather than plain SQL with CASE expressions.
-- `ORDER BY CASE WHEN p_sort = ... THEN col END` is not indexable: the planner
-- cannot match it to cards_playable_released_idx, so it seq-scans and sorts all
-- 33k rows. Measured 45ms that way versus 3.5ms walking the index.
--
-- The ORDER BY fragment is chosen from a fixed whitelist, never interpolated
-- from caller input, so format() here is not an injection surface. Every actual
-- value is still bound through USING.
LANGUAGE plpgsql STABLE SECURITY DEFINER AS $fn$
DECLARE
  order_sql text;
BEGIN
  order_sql := CASE p_sort
    WHEN 'cmc'  THEN 'c.cmc ASC, c.name ASC'
    WHEN 'name' THEN 'c.name ASC'
    ELSE             'c.released_at DESC NULLS LAST, c.name ASC'
  END;

  RETURN QUERY EXECUTE format($q$
    SELECT
      c.id, c.oracle_id, c.name, c.mana_cost, c.cmc, c.type_line, c.colors,
      c.rarity, c.image_uri_normal, c.image_uri_art_crop, c.available_on_arena,
      c.is_alchemy, c.set_code, c.set_name
    FROM cards_playable c
    WHERE
      ($1 = '' OR c.name ILIKE '%%' || $1 || '%%')
      AND ($2 = '' OR c.oracle_text ILIKE '%%' || $2 || '%%')
      AND (NOT $3 OR c.available_on_arena = true)
      AND (
        $4 = '' OR EXISTS (
          SELECT 1 FROM card_legalities cl
          WHERE cl.oracle_id = c.oracle_id
            AND cl.format = $4::mtg_format
            AND cl.status = 'legal'
        )
        -- Unreleased sets are not legal anywhere yet; keep previews visible so
        -- a format filter does not hide the sets players are brewing toward.
        OR c.released_at > CURRENT_DATE
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
      -- Overlap, not equality on the chosen printing: a card belongs to a set
      -- filter if ANY of its eligible printings is in that set.
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

-- Called at the end of each Scryfall sync. SECURITY DEFINER so the sync's
-- service-role client can refresh a view it does not own.
CREATE OR REPLACE FUNCTION refresh_cards_playable()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY cards_playable;
END;
$$;

ALTER FUNCTION refresh_cards_playable()
  SET search_path = public, extensions, pg_temp;

-- Rebuilding 33k rows across seven indexes measures ~16s, well past the default
-- statement_timeout the service role inherits, so calling this over PostgREST
-- fails with "canceling statement due to statement timeout" and the browser
-- silently keeps serving the previous sync's catalogue.
--
-- `ALTER FUNCTION ... SET statement_timeout` does NOT fix this — verified: the
-- setting attaches (visible in pg_proc.proconfig) but Postgres arms the timeout
-- when the statement starts, and changing it on function entry does not re-arm
-- the timer. The ceiling has to be raised before the call.
--
-- So it is raised on the role. The tradeoff: service_role is also what
-- /api/cards/search uses, and a 5-minute ceiling means a pathological query
-- would hang rather than fail fast. That protection is restored precisely where
-- it matters by an 8s AbortSignal on the search RPC itself (see the route), so
-- user-facing requests still fail fast while the sync's refresh can run long.
ALTER ROLE service_role SET statement_timeout = '5min';

-- Postgres grants EXECUTE to PUBLIC by default, and anon/authenticated inherit
-- it — revoking from those roles alone would leave the function callable by any
-- anonymous visitor, who could trigger repeated full view rebuilds. Revoke the
-- PUBLIC grant and hand it back only to the sync's service role.
REVOKE EXECUTE ON FUNCTION refresh_cards_playable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION refresh_cards_playable() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION refresh_cards_playable() TO service_role;
