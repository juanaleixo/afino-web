-- Table: global_price_daily
-- Description: Stores the daily price of global assets.

create table public.global_price_daily (
  id uuid not null default gen_random_uuid (),
  date date not null,
  price numeric not null,
  asset_symbol text null,
  constraint global_price_daily_pkey primary key (id),
  constraint global_price_daily_asset_symbol_fkey foreign KEY (asset_symbol) references global_assets (symbol) on delete RESTRICT
) TABLESPACE pg_default;

ALTER TABLE public.global_price_daily OWNER TO postgres;