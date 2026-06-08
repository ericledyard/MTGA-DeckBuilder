-- Migration 013: match DFC front-face names in lookup_cards_by_names
--
-- Cards like "Scavenger Regent // Exude Toxin" are stored with their full combined
-- name. Decklists (MTGA export, Moonveil, etc.) use only the front-face name.
-- Add a second OR condition to also match lower(split_part(name, ' // ', 1)).

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
  image_uri_normal text,
  rarity card_rarity,
  available_on_arena boolean,
  set_code text,
  collector_number text
)
LANGUAGE sql STABLE AS $$
  SELECT DISTINCT ON (lower(c.name))
    c.id, c.oracle_id, c.name, c.mana_cost, c.cmc, c.type_line,
    c.colors, c.image_uri_normal, c.rarity, c.available_on_arena,
    c.set_code, c.collector_number
  FROM cards c
  WHERE (
    lower(c.name) = ANY(SELECT lower(unnest(p_names)))
    OR (
      c.name LIKE '% // %'
      AND lower(split_part(c.name, ' // ', 1)) = ANY(SELECT lower(unnest(p_names)))
    )
  )
  AND c.oracle_id IS NOT NULL
  ORDER BY
    lower(c.name),
    c.available_on_arena DESC,
    (c.image_uri_normal IS NOT NULL) DESC;
$$;

GRANT EXECUTE ON FUNCTION lookup_cards_by_names(text[]) TO anon, authenticated;
