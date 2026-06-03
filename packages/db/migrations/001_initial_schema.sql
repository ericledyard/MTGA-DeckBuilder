-- Enable UUID extension
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- for fuzzy card name search

-- Enums
create type mtg_format as enum (
  'standard','alchemy','historic','brawl','timeless',
  'pioneer','modern','legacy','vintage','commander','pauper'
);

create type legality_status as enum (
  'legal','not_legal','banned','restricted','suspended'
);

create type card_rarity as enum (
  'common','uncommon','rare','mythic','special','bonus'
);

create type import_source as enum ('untapped','manual','scan');

create type rules_doc_type as enum ('comprehensive','banned_list');

create type restriction_type as enum ('banned','restricted','suspended');

-- Sets
create table sets (
  code             text primary key,
  name             text not null,
  set_type         text not null,
  released_at      date,
  card_count       integer,
  available_on_arena boolean not null default false,
  icon_svg_uri     text,
  updated_at       timestamptz not null default now()
);

-- Cards (one row per printing)
create table cards (
  id                    uuid primary key default uuid_generate_v4(),
  scryfall_id           text not null unique,
  oracle_id             text not null,
  name                  text not null,
  mana_cost             text,
  cmc                   numeric not null default 0,
  type_line             text not null,
  oracle_text           text,
  power                 text,
  toughness             text,
  loyalty               text,
  colors                text[] not null default '{}',
  color_identity        text[] not null default '{}',
  set_code              text not null references sets(code),
  set_name              text not null,
  collector_number      text not null,
  rarity                card_rarity not null,
  available_on_arena    boolean not null default false,
  is_alchemy            boolean not null default false,
  image_uri_normal      text,
  image_uri_large       text,
  image_uri_art_crop    text,
  artist                text,
  flavor_text           text,
  digital               boolean not null default false,
  scryfall_uri          text not null,
  updated_at            timestamptz not null default now()
);

create index cards_oracle_id_idx on cards(oracle_id);
create index cards_name_trgm_idx on cards using gin(name gin_trgm_ops);
create index cards_set_code_idx on cards(set_code);
create index cards_arena_idx on cards(available_on_arena) where available_on_arena = true;
create index cards_alchemy_idx on cards(is_alchemy) where is_alchemy = true;

-- Card legalities
create table card_legalities (
  oracle_id  text not null,
  format     mtg_format not null,
  status     legality_status not null,
  primary key (oracle_id, format)
);

create index card_legalities_format_legal_idx
  on card_legalities(format, status) where status = 'legal';

-- Card rulings
create table card_rulings (
  id            uuid primary key default uuid_generate_v4(),
  oracle_id     text not null,
  source        text not null,
  published_at  date,
  comment       text not null
);

create index card_rulings_oracle_id_idx on card_rulings(oracle_id);

-- User collections (linked to auth.users)
create table user_collections (
  id                uuid primary key default uuid_generate_v4(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  oracle_id         text not null,
  quantity_regular  integer not null default 0,
  quantity_foil     integer not null default 0,
  imported_from     import_source not null default 'manual',
  imported_at       timestamptz not null default now(),
  unique(user_id, oracle_id)
);

create index user_collections_user_idx on user_collections(user_id);

-- Decks
create table decks (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  name           text not null,
  format         mtg_format not null,
  description    text,
  is_public      boolean not null default false,
  cover_card_id  uuid references cards(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index decks_user_idx on decks(user_id);

-- Deck cards
create table deck_cards (
  deck_id       uuid not null references decks(id) on delete cascade,
  oracle_id     text not null,
  quantity      integer not null default 1,
  is_sideboard  boolean not null default false,
  is_companion  boolean not null default false,
  primary key (deck_id, oracle_id, is_sideboard)
);

-- Rules documents
create table rules_documents (
  id             uuid primary key default uuid_generate_v4(),
  document_type  rules_doc_type not null,
  format         mtg_format,
  content_text   text not null,
  effective_date date,
  fetched_at     timestamptz not null default now(),
  source_url     text not null,
  checksum       text not null
);

-- Format banlists (fast lookup, populated from rules sync)
create table format_banlists (
  format            mtg_format not null,
  oracle_id         text not null,
  card_name         text not null,
  restriction_type  restriction_type not null,
  effective_date    date,
  primary key (format, oracle_id)
);

-- RLS policies
alter table user_collections enable row level security;
alter table decks enable row level security;
alter table deck_cards enable row level security;

create policy "users own their collections"
  on user_collections for all using (auth.uid() = user_id);

create policy "users own their decks"
  on decks for all using (auth.uid() = user_id);

create policy "public decks readable by all"
  on decks for select using (is_public = true or auth.uid() = user_id);

create policy "users own their deck cards"
  on deck_cards for all
  using (exists (select 1 from decks where decks.id = deck_id and decks.user_id = auth.uid()));

-- Cards and sets are public read-only
alter table cards enable row level security;
alter table sets enable row level security;
alter table card_legalities enable row level security;
alter table card_rulings enable row level security;

create policy "cards are public" on cards for select using (true);
create policy "sets are public" on sets for select using (true);
create policy "legalities are public" on card_legalities for select using (true);
create policy "rulings are public" on card_rulings for select using (true);
