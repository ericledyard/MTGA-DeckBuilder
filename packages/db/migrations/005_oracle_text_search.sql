-- 005_oracle_text_search.sql
-- Adds oracle text keyword search to search_cards.
-- Uses ILIKE (pg_trgm) for exact substring matching — handles MTG special chars
-- like "+1/+1" and "{T}" that FTS tokenizers would strip.

-- Index for fast substring search on oracle_text
create index if not exists cards_oracle_text_trgm_idx
  on cards using gin(oracle_text gin_trgm_ops);

-- Drop previous signature before recreating with new param
drop function if exists search_cards(text, text, boolean, integer, text[], integer[], text[], text[], text[]);

create or replace function search_cards(
  p_query        text      default '',
  p_format       text      default '',
  p_arena_only   boolean   default false,
  p_limit        integer   default 48,
  p_colors       text[]    default null,
  p_cmc_values   integer[] default null,
  p_rarities     text[]    default null,
  p_types        text[]    default null,
  p_set_codes    text[]    default null,
  p_text_query   text      default ''
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
  select
    id, oracle_id, name, mana_cost, type_line, rarity,
    image_uri_normal, image_uri_art_crop, available_on_arena,
    is_alchemy, set_code, set_name
  from (
    select distinct on (c.oracle_id)
      c.id, c.oracle_id, c.name, c.mana_cost, c.type_line, c.rarity,
      c.image_uri_normal, c.image_uri_art_crop, c.available_on_arena,
      c.is_alchemy, c.set_code, c.set_name, c.cmc
    from cards c
    where
      -- Name search
      (p_query = '' or c.name ilike '%' || p_query || '%')

      -- Oracle text keyword search (exact substring, case-insensitive)
      and (p_text_query = '' or c.oracle_text ilike '%' || p_text_query || '%')

      -- Arena only
      and (not p_arena_only or c.available_on_arena = true)

      -- Format legality
      and (
        p_format = '' or exists (
          select 1 from card_legalities cl
          where cl.oracle_id = c.oracle_id
            and cl.format = p_format::mtg_format
            and cl.status = 'legal'
        )
      )

      -- Color: subset/AND logic
      and (
        p_colors is null
        or (c.colors = '{}' and 'C' = any(p_colors))
        or (c.colors != '{}' and c.colors <@ array_remove(p_colors, 'C'))
      )

      -- CMC: 7 means 7+
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

      -- Type: OR logic
      and (
        p_types is null
        or exists (
          select 1 from unnest(p_types) as t(type_name)
          where c.type_line ilike '%' || t.type_name || '%'
        )
      )

      -- Expansion set
      and (
        p_set_codes is null
        or c.set_code = any(p_set_codes)
      )

    order by c.oracle_id
  ) deduped
  order by cmc asc, name asc
  limit p_limit;
$$;

grant execute on function search_cards to anon, authenticated;
