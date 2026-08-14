-- Migration 021: filter the card browser by colour identity.
--
-- Why a new parameter rather than reusing p_colors
-- ------------------------------------------------
-- p_colors filters on `colors` with the subset operator, which is the right
-- rule for "show me cards I can cast". The Commander deckbuilding rule is a
-- different one: every card must sit inside the commander's *identity*, and the
-- two differ. Sol Ring is colours {} and identity {}; a card costing {2} with a
-- "{B}:" ability is colours {} and identity {B}. Filtering a Commander pool by
-- `colors` would offer that second card for a mono-white commander and MTGA
-- would reject the deck.
--
-- Colourless cards go in any deck, which the subset test gives for free:
-- '{}' <@ anything is true.
--
-- Everything else is unchanged from migration 020.

DROP FUNCTION IF EXISTS search_cards(text, text, boolean, integer, text[], integer[], text[], text[], text[], text, boolean, uuid, integer, text);

CREATE OR REPLACE FUNCTION search_cards(
  p_query          text      DEFAULT '',
  p_format         text      DEFAULT '',
  p_arena_only     boolean   DEFAULT false,
  p_limit          integer   DEFAULT 48,
  p_colors         text[]    DEFAULT NULL,
  p_cmc_values     integer[] DEFAULT NULL,
  p_rarities       text[]    DEFAULT NULL,
  p_types          text[]    DEFAULT NULL,
  p_set_codes      text[]    DEFAULT NULL,
  p_text_query     text      DEFAULT '',
  p_owned_only     boolean   DEFAULT false,
  p_user_id        uuid      DEFAULT NULL,
  p_offset         integer   DEFAULT 0,
  p_sort           text      DEFAULT 'released',
  p_color_identity text[]    DEFAULT NULL
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
      -- Commander colour identity. '{}' <@ anything, so colourless cards pass.
      AND ($14 IS NULL OR c.color_identity <@ $14)
    ORDER BY %s
    LIMIT $12 OFFSET $13
  $q$, order_sql)
  USING p_query, p_text_query, p_arena_only, p_format, p_colors, p_cmc_values,
        p_rarities, p_types, p_set_codes, p_owned_only, p_user_id,
        p_limit, p_offset, p_color_identity;
END;
$fn$;

GRANT EXECUTE ON FUNCTION search_cards(text, text, boolean, integer, text[], integer[], text[], text[], text[], text, boolean, uuid, integer, text, text[]) TO anon, authenticated;

ALTER FUNCTION search_cards(text, text, boolean, integer, text[], integer[], text[], text[], text[], text, boolean, uuid, integer, text, text[])
  SET search_path = public, extensions, pg_temp;

-- The identity filter is a subset test over an array; GIN makes it index-backed
-- the same way set_codes && $9 is.
CREATE INDEX IF NOT EXISTS cards_playable_color_identity_idx
  ON cards_playable USING gin (color_identity);
