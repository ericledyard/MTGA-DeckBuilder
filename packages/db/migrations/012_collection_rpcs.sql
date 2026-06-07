-- 012_collection_rpcs.sql
-- Collection management: owned-only search filter, bulk upsert, browse, and manual qty control

-- 1. search_cards: add p_owned_only + p_user_id params for "build from collection" filter
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
  p_text_query  text      default '',
  p_owned_only  boolean   default false,
  p_user_id     uuid      default null
)
returns table (
  id                  uuid,
  oracle_id           text,
  name                text,
  mana_cost           text,
  cmc                 numeric,
  type_line           text,
  colors              text[],
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
    id, oracle_id, name, mana_cost, cmc, type_line, colors, rarity,
    image_uri_normal, image_uri_art_crop, available_on_arena,
    is_alchemy, set_code, set_name
  from (
    select distinct on (c.oracle_id)
      c.id, c.oracle_id, c.name, c.mana_cost, c.cmc, c.type_line, c.colors, c.rarity,
      c.image_uri_normal, c.image_uri_art_crop, c.available_on_arena,
      c.is_alchemy, c.set_code, c.set_name
    from cards c
    where
      (p_query = '' or c.name ilike '%' || p_query || '%')
      and (p_text_query = '' or c.oracle_text ilike '%' || p_text_query || '%')
      and (not p_arena_only or c.available_on_arena = true)
      and (
        p_format = '' or exists (
          select 1 from card_legalities cl
          where cl.oracle_id = c.oracle_id
            and cl.format = p_format::mtg_format
            and cl.status = 'legal'
        )
      )
      and (
        p_colors is null
        or (c.colors = '{}' and 'C' = any(p_colors))
        or (c.colors != '{}' and c.colors <@ array_remove(p_colors, 'C'))
      )
      and (
        p_cmc_values is null
        or floor(c.cmc)::integer = any(array_remove(p_cmc_values, 7))
        or (7 = any(p_cmc_values) and c.cmc >= 7)
      )
      and (
        p_rarities is null
        or c.rarity::text = any(p_rarities)
      )
      and (
        p_types is null
        or exists (
          select 1 from unnest(p_types) as t(type_name)
          where c.type_line ilike '%' || t.type_name || '%'
        )
      )
      and (
        p_set_codes is null
        or c.set_code = any(p_set_codes)
      )
      and (
        not p_owned_only
        or p_user_id is null
        or exists (
          select 1 from user_collections uc
          where uc.user_id = p_user_id
            and uc.oracle_id = c.oracle_id
            and (uc.quantity_regular + uc.quantity_foil) > 0
        )
      )
    order by c.oracle_id
  ) deduped
  order by cmc asc, name asc
  limit p_limit;
$$;

grant execute on function search_cards to anon, authenticated;

-- 2. Bulk upsert into user_collections (used by /api/collection/import)
create or replace function upsert_collection_cards(
  p_user_id            uuid,
  p_oracle_ids         text[],
  p_quantities_regular integer[],
  p_quantities_foil    integer[],
  p_source             import_source default 'untapped'
)
returns integer
language plpgsql
security definer
as $$
declare
  v_count integer;
begin
  insert into user_collections (user_id, oracle_id, quantity_regular, quantity_foil, imported_from, imported_at)
  select
    p_user_id,
    t.oid,
    t.qty_regular,
    t.qty_foil,
    p_source,
    now()
  from unnest(p_oracle_ids, p_quantities_regular, p_quantities_foil) as t(oid, qty_regular, qty_foil)
  on conflict (user_id, oracle_id)
  do update set
    quantity_regular = excluded.quantity_regular,
    quantity_foil    = excluded.quantity_foil,
    imported_from    = excluded.imported_from,
    imported_at      = excluded.imported_at;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function upsert_collection_cards to authenticated;

-- 3. Read full collection with card details (one card row per oracle_id)
create or replace function get_user_collection(p_user_id uuid)
returns table (
  oracle_id         text,
  quantity_regular  integer,
  quantity_foil     integer,
  imported_from     import_source,
  name              text,
  mana_cost         text,
  cmc               numeric,
  type_line         text,
  colors            text[],
  rarity            card_rarity,
  image_uri_normal  text,
  set_code          text,
  set_name          text,
  available_on_arena boolean,
  is_alchemy        boolean
)
language sql
stable
security definer
as $$
  select
    uc.oracle_id,
    uc.quantity_regular,
    uc.quantity_foil,
    uc.imported_from,
    c.name,
    c.mana_cost,
    c.cmc,
    c.type_line,
    c.colors,
    c.rarity,
    c.image_uri_normal,
    c.set_code,
    c.set_name,
    c.available_on_arena,
    c.is_alchemy
  from user_collections uc
  join (
    select distinct on (oracle_id)
      oracle_id, name, mana_cost, cmc, type_line, colors, rarity,
      image_uri_normal, set_code, set_name, available_on_arena, is_alchemy
    from cards
    order by oracle_id, available_on_arena desc nulls last
  ) c on c.oracle_id = uc.oracle_id
  where uc.user_id = p_user_id
  order by c.cmc asc, c.name asc;
$$;

grant execute on function get_user_collection to authenticated;

-- 4. Update a single card's quantity (used by manual +/- controls)
create or replace function update_collection_card(
  p_user_id     uuid,
  p_oracle_id   text,
  p_qty_regular integer,
  p_qty_foil    integer
)
returns void
language sql
security definer
as $$
  insert into user_collections (user_id, oracle_id, quantity_regular, quantity_foil, imported_from)
  values (p_user_id, p_oracle_id, p_qty_regular, p_qty_foil, 'manual')
  on conflict (user_id, oracle_id)
  do update set
    quantity_regular = p_qty_regular,
    quantity_foil    = p_qty_foil,
    imported_from    = 'manual'::import_source,
    imported_at      = now();
$$;

grant execute on function update_collection_card to authenticated;

-- 5. Remove a card from the collection
create or replace function remove_collection_card(p_user_id uuid, p_oracle_id text)
returns void
language sql
security definer
as $$
  delete from user_collections where user_id = p_user_id and oracle_id = p_oracle_id;
$$;

grant execute on function remove_collection_card to authenticated;
