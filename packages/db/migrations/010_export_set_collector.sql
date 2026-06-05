-- 010_export_set_collector.sql
-- Add set_code + collector_number to lookup_cards_by_names and get_cards_by_oracle_ids
-- so the export flow has the same data as the import flow.

-- ── lookup_cards_by_names ────────────────────────────────────────────────────

drop function if exists lookup_cards_by_names(text[]);

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
  id                 text,
  set_code           text,
  collector_number   text
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
    c.id::text,
    c.set_code,
    c.collector_number
  from cards c
  where lower(c.name) = any(select lower(n) from unnest(p_names) as n)
    and c.set_type not in ('token', 'memorabilia')
  order by lower(c.name), (c.image_uri_normal is not null) desc;
$$;

grant execute on function lookup_cards_by_names(text[]) to anon, authenticated;

-- ── get_cards_by_oracle_ids ──────────────────────────────────────────────────

drop function if exists get_cards_by_oracle_ids(text[]);

create or replace function get_cards_by_oracle_ids(p_oracle_ids text[])
returns table (
  oracle_id        text,
  name             text,
  mana_cost        text,
  cmc              numeric,
  type_line        text,
  rarity           text,
  image_uri_normal text,
  colors           text[],
  set_code         text,
  collector_number text
)
language sql stable as $$
  select
    oracle_id, name, mana_cost, cmc, type_line, rarity,
    image_uri_normal, colors, set_code, collector_number
  from (
    select distinct on (c.oracle_id)
      c.oracle_id, c.name, c.mana_cost, c.cmc, c.type_line, c.rarity::text,
      c.image_uri_normal, c.colors, c.set_code, c.collector_number
    from cards c
    where c.oracle_id = any(p_oracle_ids)
    order by c.oracle_id, (c.image_uri_normal is not null) desc
  ) sub;
$$;

grant execute on function get_cards_by_oracle_ids(text[]) to anon, authenticated;
