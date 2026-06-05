-- Lookup cards by (set_code, collector_number) pairs.
-- p_set_codes[i] pairs with p_collector_numbers[i].
-- Returns set_code + collector_number so the caller can match results back.
create or replace function lookup_cards_by_set_collector(
  p_set_codes        text[],
  p_collector_numbers text[]
)
returns table (
  oracle_id        text,
  name             text,
  mana_cost        text,
  cmc              numeric,
  type_line        text,
  rarity           text,
  image_uri_normal text,
  colors           text[],
  available_on_arena boolean,
  id               text,
  set_code         text,
  collector_number text
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
    c.id,
    c.set_code,
    c.collector_number
  from cards c
  where (lower(c.set_code), lower(c.collector_number)) in (
    select lower(s), lower(n)
    from unnest(p_set_codes, p_collector_numbers) as t(s, n)
  )
  order by (c.image_uri_normal is not null) desc
$$;

grant execute on function lookup_cards_by_set_collector(text[], text[]) to anon, authenticated;
