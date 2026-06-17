-- Migration 015: add p_offset to search_cards for cursor-free pagination
--
-- Drops the current 12-param overload and recreates with p_offset added.
-- The outer ORDER BY / LIMIT pattern is unchanged; OFFSET is appended.

DROP FUNCTION IF EXISTS search_cards(text, text, boolean, integer, text[], integer[], text[], text[], text[], text, boolean, uuid);

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
  p_offset       integer   DEFAULT 0
)
RETURNS TABLE (
  id uuid, oracle_id text, name text, mana_cost text, cmc numeric,
  type_line text, colors text[], rarity card_rarity, image_uri_normal text,
  image_uri_art_crop text, available_on_arena boolean, is_alchemy boolean,
  set_code text, set_name text
)
LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT
    id, oracle_id, name, mana_cost, cmc, type_line, colors, rarity,
    image_uri_normal, image_uri_art_crop, available_on_arena,
    is_alchemy, set_code, set_name
  FROM (
    SELECT DISTINCT ON (c.oracle_id)
      c.id, c.oracle_id, c.name, c.mana_cost, c.cmc, c.type_line, c.colors, c.rarity,
      c.image_uri_normal, c.image_uri_art_crop, c.available_on_arena,
      c.is_alchemy, c.set_code, c.set_name
    FROM cards c
    WHERE
      (p_query = '' OR c.name ILIKE '%' || p_query || '%')
      AND (p_text_query = '' OR c.oracle_text ILIKE '%' || p_text_query || '%')
      AND (NOT p_arena_only OR c.available_on_arena = true)
      AND (
        p_format = '' OR EXISTS (
          SELECT 1 FROM card_legalities cl
          WHERE cl.oracle_id = c.oracle_id
            AND cl.format = p_format::mtg_format
            AND cl.status = 'legal'
        )
      )
      AND (
        p_colors IS NULL
        OR (c.colors = '{}' AND 'C' = ANY(p_colors))
        OR (c.colors != '{}' AND c.colors <@ array_remove(p_colors, 'C'))
      )
      AND (
        p_cmc_values IS NULL
        OR floor(c.cmc)::integer = ANY(array_remove(p_cmc_values, 7))
        OR (7 = ANY(p_cmc_values) AND c.cmc >= 7)
      )
      AND (
        p_rarities IS NULL
        OR c.rarity::text = ANY(p_rarities)
      )
      AND (
        p_types IS NULL
        OR EXISTS (
          SELECT 1 FROM unnest(p_types) AS t(type_name)
          WHERE c.type_line ILIKE '%' || t.type_name || '%'
        )
      )
      AND (
        p_set_codes IS NULL
        OR c.set_code = ANY(p_set_codes)
      )
      AND (
        NOT p_owned_only
        OR p_user_id IS NULL
        OR EXISTS (
          SELECT 1 FROM user_collections uc
          WHERE uc.user_id = p_user_id
            AND uc.oracle_id = c.oracle_id
            AND (uc.quantity_regular + uc.quantity_foil) > 0
        )
      )
      AND c.set_code NOT IN (
        SELECT code FROM sets WHERE set_type IN ('token', 'memorabilia')
      )
    ORDER BY c.oracle_id
  ) deduped
  ORDER BY cmc ASC, name ASC
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION search_cards(text, text, boolean, integer, text[], integer[], text[], text[], text[], text, boolean, uuid, integer) TO anon, authenticated;
