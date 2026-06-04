-- 003_advanced_search.sql
-- Extends search_cards with multi-select filters.
-- Drop the old 4-param overload first so CREATE OR REPLACE targets the right signature.
drop function if exists search_cards(text, text, boolean, integer);

-- Color uses subset (<@) logic: the card's colors must be within the selected set.
-- 'C' in p_colors matches colorless cards (colors = '{}').
-- CMC: 7 means "7 or more".
-- Types: OR logic (show Creatures OR Instants).

create or replace function search_cards(
  p_query       text      default '',
  p_format      text      default '',
  p_arena_only  boolean   default false,
  p_limit       integer   default 48,
  p_colors      text[]    default null,
  p_cmc_values  integer[] default null,
  p_rarities    text[]    default null,
  p_types       text[]    default null,
  p_set_codes   text[]    default null
)
returns table (
  id                  uuid,
  oracle_id           text,
  name                text,
  mana_cost           text,
  type_line           text,
  rarity              card_rarity,
  image_uri_normal    text,
  image_uri_art_crop  text,
  available_on_arena  boolean,
  is_alchemy          boolean,
  set_code            text,
  set_name            text
)
language sql
stable
security definer
as $$
  select distinct on (c.oracle_id)
    c.id, c.oracle_id, c.name, c.mana_cost, c.type_line, c.rarity,
    c.image_uri_normal, c.image_uri_art_crop, c.available_on_arena,
    c.is_alchemy, c.set_code, c.set_name
  from cards c
  where
    -- Text search
    (p_query = '' or c.name ilike '%' || p_query || '%')

    -- Arena only
    and (not p_arena_only or c.available_on_arena = true)

    -- Format legality (EXISTS join avoids PostgREST row-limit issue)
    and (
      p_format = '' or exists (
        select 1 from card_legalities cl
        where cl.oracle_id = c.oracle_id
          and cl.format = p_format::mtg_format
          and cl.status = 'legal'
      )
    )

    -- Color: subset/AND logic — card colors must fit within the selected palette.
    -- 'C' is the sentinel for colorless (colors = '{}').
    -- Empty array = no filter.
    and (
      p_colors is null
      or (c.colors = '{}' and 'C' = any(p_colors))
      or (c.colors != '{}' and c.colors <@ array_remove(p_colors, 'C'))
    )

    -- CMC: 0-6 are exact matches; 7 means cmc >= 7.
    and (
      p_cmc_values is null
      or floor(c.cmc)::integer = any(array_remove(p_cmc_values, 7))
      or (7 = any(p_cmc_values) and c.cmc >= 7)
    )

    -- Rarity
    and (
      p_rarities is null
      or c.rarity::text = any(p_rarities)
    )

    -- Type: OR logic — card type_line must contain at least one selected type.
    and (
      p_types is null
      or exists (
        select 1 from unnest(p_types) as t(type_name)
        where c.type_line ilike '%' || t.type_name || '%'
      )
    )

    -- Expansion: set code multi-select
    and (
      p_set_codes is null
      or c.set_code = any(p_set_codes)
    )

  order by c.oracle_id, c.name
  limit p_limit;
$$;

grant execute on function search_cards to anon, authenticated;
