-- 007_set_type_filter.sql
-- Add set_type to cards (denormalised from sets) so we can filter without a join.
-- Exclude 'token' and 'memorabilia' set types from all card searches and lookups.

alter table cards add column if not exists set_type text;

-- Backfill from sets table
update cards c
set set_type = s.set_type
from sets s
where s.code = c.set_code;

-- Index for the filter
create index if not exists cards_set_type_idx on cards(set_type);

-- ── search_cards ────────────────────────────────────────────────────────────
-- Adds set_type filter; also picks up the oracle_text search param from 005.

drop function if exists search_cards(text,text,boolean,integer,text[],integer[],text[],text[],text[],text);

create or replace function search_cards(
  p_query       text      default '',
  p_format      text      default '',
  p_arena_only  boolean   default false,
  p_limit       integer   default 48,
  p_colors      text[]    default null,
  p_cmc_values  integer[] default null,
  p_rarities    text[]    default null,
  p_types       text[]    default null,
  p_set_codes   text[]    default null,
  p_text_query  text      default ''
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
  select * from (
    select distinct on (c.oracle_id)
      c.id, c.oracle_id, c.name, c.mana_cost, c.type_line, c.rarity,
      c.image_uri_normal, c.image_uri_art_crop, c.available_on_arena,
      c.is_alchemy, c.set_code, c.set_name
    from cards c
    where
      -- Exclude non-playable set types (tokens, art series, instructional cards)
      c.set_type not in ('token', 'memorabilia')

      -- Text search on name
      and (p_query = '' or c.name ilike '%' || p_query || '%')

      -- Oracle text search
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

      -- CMC: 0-6 exact, 7 means 7+
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

      -- Expansion: set code multi-select
      and (
        p_set_codes is null
        or c.set_code = any(p_set_codes)
      )

    order by c.oracle_id, c.name
  ) sub
  order by sub.cmc asc, sub.name asc
  limit p_limit;
$$;

grant execute on function search_cards to anon, authenticated;

-- ── lookup_cards_by_names ────────────────────────────────────────────────────

create or replace function lookup_cards_by_names(p_names text[])
returns table (
  oracle_id          text,
  name               text,
  mana_cost          text,
  cmc                numeric,
  type_line          text,
  rarity             text,
  image_uri_normal   text,
  colors             text[],
  available_on_arena boolean,
  id                 text
)
language sql stable as $$
  select distinct on (lower(c.name))
    c.oracle_id,
    c.name,
    c.mana_cost,
    c.cmc,
    c.type_line,
    c.rarity::text,
    c.image_uri_normal,
    c.colors,
    c.available_on_arena,
    c.id::text
  from cards c
  where lower(c.name) = any(select lower(n) from unnest(p_names) as n)
    and c.set_type not in ('token', 'memorabilia')
  order by lower(c.name), (c.image_uri_normal is not null) desc;
$$;

grant execute on function lookup_cards_by_names(text[]) to anon, authenticated;

-- ── lookup_cards_by_set_collector ────────────────────────────────────────────

create or replace function lookup_cards_by_set_collector(
  p_set_codes         text[],
  p_collector_numbers text[]
)
returns table (
  oracle_id          text,
  name               text,
  mana_cost          text,
  cmc                numeric,
  type_line          text,
  rarity             text,
  image_uri_normal   text,
  colors             text[],
  available_on_arena boolean,
  id                 text,
  set_code           text,
  collector_number   text
)
language sql stable as $$
  select
    c.oracle_id,
    c.name,
    c.mana_cost,
    c.cmc,
    c.rarity::text,
    c.type_line,
    c.image_uri_normal,
    c.colors,
    c.available_on_arena,
    c.id::text,
    c.set_code,
    c.collector_number
  from cards c
  where (lower(c.set_code), lower(c.collector_number)) in (
    select lower(s), lower(n)
    from unnest(p_set_codes, p_collector_numbers) as t(s, n)
  )
    and c.set_type not in ('token', 'memorabilia')
  order by (c.image_uri_normal is not null) desc;
$$;

grant execute on function lookup_cards_by_set_collector(text[], text[]) to anon, authenticated;
