-- Returns exactly one card row per oracle_id — picks the row with an image,
-- breaking ties by id. Replaces the direct .in("oracle_id", ...) query in
-- the deck page, which hits PostgREST's 1000-row default limit when cards
-- have many printings (basic lands have 200+ rows each).

CREATE OR REPLACE FUNCTION get_cards_by_oracle_ids(p_oracle_ids text[])
RETURNS TABLE (
  oracle_id text,
  name      text,
  mana_cost text,
  cmc       numeric,
  type_line text,
  colors    text[],
  image_uri_normal text,
  rarity    text
) AS $$
  SELECT DISTINCT ON (c.oracle_id)
    c.oracle_id, c.name, c.mana_cost, c.cmc, c.type_line, c.colors, c.image_uri_normal, c.rarity
  FROM cards c
  WHERE c.oracle_id = ANY(p_oracle_ids)
  ORDER BY c.oracle_id, (c.image_uri_normal IS NOT NULL) DESC, c.id;
$$ LANGUAGE sql STABLE;

GRANT EXECUTE ON FUNCTION get_cards_by_oracle_ids(text[]) TO anon, authenticated;
