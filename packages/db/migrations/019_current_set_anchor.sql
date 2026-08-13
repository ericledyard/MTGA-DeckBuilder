-- Migration 019: anchor the default browse order on the *current* set, and
-- presume format legality for sets that have been spoiled but not released.
--
-- Why
-- ---
-- Migration 018 made the default sort `released_at DESC`, which sorts by the
-- newest set Scryfall knows about — not the newest set a player can actually
-- play. On 2026-08-13 that put Star Trek (2026-11-13) and Reality Fracture
-- (2026-10-02) ahead of The Hobbit, which released on Arena on the 11th and in
-- paper on the 14th. Page one was three months of cards nobody owns.
--
-- Two changes, both re-evaluated on every sync so they never need editing:
--
--   1. A "current set" anchor — the newest expansion/core set that is released
--      or about to be. Cards at or before that date sort first, newest first;
--      cards from later sets sort to the very bottom, still browsable.
--
--   2. Presumed legality for those later sets. Scryfall marks every format
--      `not_legal` until a set actually releases (verified: Star Trek and
--      Reality Fracture are `not_legal` across all eleven formats, while The
--      Hobbit already carries real data a day before release). Migration 018
--      worked around that by letting ANY unreleased card pass ANY format
--      filter, which put Star Trek Commander precon cards in a Standard search.
--      The presumption is now derived from the set's product type instead.
--
-- Real legality data always wins. The presumption only applies where Scryfall
-- has not published one yet, and it disappears on its own once the set lands.

-- ---------------------------------------------------------------------------
-- The current-set anchor
-- ---------------------------------------------------------------------------
-- Paper release date is the only release date Scryfall publishes — there is no
-- Arena date in the bulk data. In practice a set is playable before that date:
-- prerelease weekend runs 8-9 days early and Arena's drop lands 2-3 days early.
-- So the anchor accepts a set that releases within the next two weeks, which is
-- what makes The Hobbit (2026-08-14) current on 2026-08-13 rather than Marvel
-- Universe (2026-06-26).
--
-- Restricted to expansion/core so a Commander precon or a promo drop cannot
-- pull the anchor forward past the main set it ships alongside.
CREATE OR REPLACE FUNCTION current_set_release_date()
RETURNS date
LANGUAGE sql STABLE AS $$
  SELECT max(s.released_at)
  FROM sets s
  WHERE s.set_type IN ('expansion', 'core')
    AND s.released_at IS NOT NULL
    AND s.released_at <= CURRENT_DATE + 14;
$$;

ALTER FUNCTION current_set_release_date()
  SET search_path = public, extensions, pg_temp;

-- ---------------------------------------------------------------------------
-- Presumed legality for spoiled-but-unreleased sets
-- ---------------------------------------------------------------------------
-- Tiers follow the product type, because that is what actually decides where a
-- card is playable:
--
--   expansion / core        — the Standard-legal sets. Legal essentially
--                             everywhere, and on Arena once flagged.
--   alchemy                 — Arena-only rebalances. Digital formats only;
--                             they do not exist in paper Legacy or Commander.
--   supplemental            — Commander precons, eternal sets, masters,
--                             draft innovations, promos. Eternal formats and
--                             Commander, never Standard or Pioneer.
--
-- Arena-only formats additionally require the card to be flagged for Arena —
-- a paper-only Commander precon is not suddenly Brawl-legal.
--
-- Pauper keys off rarity rather than set type: a common is pauper-legal, and
-- rarity is published for spoiled cards.
CREATE OR REPLACE FUNCTION presumed_format_legality(
  p_set_type text,
  p_on_arena boolean,
  p_rarity   text,
  p_format   text
)
RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE
    -- Arena-only formats.
    WHEN p_format IN ('alchemy', 'historic', 'brawl', 'timeless') THEN
      COALESCE(p_on_arena, false)
      AND (
        p_set_type IN ('expansion', 'core', 'alchemy')
        OR (p_format <> 'alchemy' AND p_set_type IN (
          'commander', 'eternal', 'masterpiece', 'draft_innovation', 'masters',
          'starter', 'box', 'arsenal', 'spellbook', 'duel_deck',
          'from_the_vault', 'premium_deck', 'promo'
        ))
      )

    -- Rotating and non-rotating paper constructed.
    WHEN p_format IN ('standard', 'pioneer') THEN
      p_set_type IN ('expansion', 'core')

    WHEN p_format = 'modern' THEN
      p_set_type IN ('expansion', 'core', 'masters', 'draft_innovation')

    -- Eternal paper formats accept nearly any paper product, but not the
    -- Arena-only digital sets.
    WHEN p_format IN ('legacy', 'vintage', 'commander') THEN
      p_set_type IN (
        'expansion', 'core', 'commander', 'eternal', 'masterpiece',
        'draft_innovation', 'masters', 'starter', 'box', 'arsenal',
        'spellbook', 'duel_deck', 'from_the_vault', 'premium_deck', 'promo'
      )

    WHEN p_format = 'pauper' THEN
      p_rarity = 'common'
      AND p_set_type NOT IN ('alchemy')

    ELSE false
  END;
$$;

ALTER FUNCTION presumed_format_legality(text, boolean, text, text)
  SET search_path = public, extensions, pg_temp;

-- ---------------------------------------------------------------------------
-- cards_playable, rebuilt with the anchor baked in
-- ---------------------------------------------------------------------------
-- Unchanged from 018: the eligibility filters, one row per oracle_id, and
-- set_codes[] carrying every eligible set so set filtering uses overlap rather
-- than the chosen printing's set_code.
--
-- New: `is_unreleased` and `set_type` on the output, and a printing preference
-- that favours a released printing. Without that last part a card reprinted in
-- The Hobbit would have its Star Trek printing chosen (newest wins) and sink to
-- the bottom of the browse despite being buyable tomorrow.
DROP MATERIALIZED VIEW IF EXISTS cards_playable CASCADE;

CREATE MATERIALIZED VIEW cards_playable AS
WITH anchor AS MATERIALIZED (
  SELECT current_set_release_date() AS current_release
),
eligible AS (
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
    -- A set with no release date is an old promo sheet, not a spoiler.
    COALESCE(c.released_at > a.current_release, false) AS is_unreleased,
    ROW_NUMBER() OVER (
      PARTITION BY c.oracle_id
      ORDER BY
        (c.image_uri_normal IS NOT NULL) DESC,
        COALESCE(c.released_at <= a.current_release, true) DESC,
        (c.set_type IN ('expansion', 'core')) DESC,
        c.available_on_arena DESC,
        c.released_at DESC NULLS LAST,
        c.collector_number
    ) AS rn
  FROM eligible c
  CROSS JOIN anchor a
)
SELECT
  r.id, r.oracle_id, r.name, r.mana_cost, r.cmc, r.type_line, r.oracle_text,
  r.colors, r.color_identity, r.rarity, r.image_uri_normal, r.image_uri_art_crop,
  r.available_on_arena, r.is_alchemy, r.set_code, r.set_name, r.collector_number,
  r.released_at, r.set_type, r.is_unreleased,
  sp.set_codes
FROM ranked r
JOIN sets_per_card sp ON sp.oracle_id = r.oracle_id
WHERE r.rn = 1;

-- Unique index is REQUIRED for REFRESH MATERIALIZED VIEW CONCURRENTLY, which is
-- what keeps the browser readable while the sync refreshes.
CREATE UNIQUE INDEX cards_playable_oracle_id_idx ON cards_playable (oracle_id);

-- Default browse order: current set first, then older sets newest-first, then
-- the spoiled sets at the bottom. Column order and direction match the ORDER BY
-- in search_cards exactly so the planner can walk the index and stop at LIMIT.
CREATE INDEX cards_playable_browse_idx
  ON cards_playable (is_unreleased ASC, released_at DESC NULLS LAST, name ASC);

-- Alternate orders, kept fast so alphabetical/cost sorting stays index-backed.
CREATE INDEX cards_playable_cmc_name_idx ON cards_playable (cmc ASC, name ASC);
CREATE INDEX cards_playable_name_idx ON cards_playable (name ASC);

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

-- ---------------------------------------------------------------------------
-- search_cards
-- ---------------------------------------------------------------------------
-- Signature and result columns are unchanged from 018 — no application change
-- is needed. What changes is the default ORDER BY and the format filter's
-- treatment of unreleased cards.
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
  type_line text, colors text[], rarity card_rarity, image_uri_normal text,
  image_uri_art_crop text, available_on_arena boolean, is_alchemy boolean,
  set_code text, set_name text
)
-- plpgsql with a dynamic ORDER BY rather than plain SQL with CASE expressions.
-- `ORDER BY CASE WHEN p_sort = ... THEN col END` is not indexable: the planner
-- cannot match it to the browse index, so it seq-scans and sorts all 33k rows.
-- Measured 45ms that way versus 3.5ms walking the index.
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
    ELSE             'c.is_unreleased ASC, c.released_at DESC NULLS LAST, c.name ASC'
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
        $4 = ''
        OR EXISTS (
          SELECT 1 FROM card_legalities cl
          WHERE cl.oracle_id = c.oracle_id
            AND cl.format = $4::mtg_format
            AND cl.status = 'legal'
        )
        -- Scryfall publishes `not_legal` for every format until a set actually
        -- releases, so a format filter would delete exactly the sets players
        -- are brewing toward. Presume legality from the product type instead.
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

-- ---------------------------------------------------------------------------
-- refresh_cards_playable — unchanged from 018, recreated because the CASCADE
-- above drops nothing it depends on but the grants are cheap to restate.
-- ---------------------------------------------------------------------------
-- The anchor is a CURRENT_DATE comparison evaluated when the view is built, so
-- rebuilding on every sync is what keeps "current set" current. The daily sync
-- rolls it forward on its own; no code change is needed when a set releases.
CREATE OR REPLACE FUNCTION refresh_cards_playable()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY cards_playable;
END;
$$;

ALTER FUNCTION refresh_cards_playable()
  SET search_path = public, extensions, pg_temp;

REVOKE EXECUTE ON FUNCTION refresh_cards_playable() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION refresh_cards_playable() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION refresh_cards_playable() TO service_role;

-- Deliberately no GRANT SELECT on cards_playable. Migration 018 did not grant
-- one either: search_cards is SECURITY DEFINER and reads the view as its owner,
-- so the pool stays reachable only through the function that filters it.
