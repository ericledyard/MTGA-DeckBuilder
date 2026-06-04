-- search_cards RPC: replaces the two-query approach (fetch oracle_ids + filter cards)
-- that was limited by PostgREST's 1000-row default. Uses EXISTS to do the join
-- entirely in SQL with no row-limit issue.
create or replace function search_cards(
  p_query      text    default '',
  p_format     text    default '',
  p_arena_only boolean default false,
  p_limit      integer default 48
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
    (p_query = '' or c.name ilike '%' || p_query || '%')
    and (not p_arena_only or c.available_on_arena = true)
    and (
      p_format = '' or exists (
        select 1 from card_legalities cl
        where cl.oracle_id = c.oracle_id
          and cl.format = p_format::mtg_format
          and cl.status = 'legal'
      )
    )
  order by c.oracle_id, c.name
  limit p_limit;
$$;

-- Allow anon/authenticated roles to call this function
grant execute on function search_cards to anon, authenticated;
