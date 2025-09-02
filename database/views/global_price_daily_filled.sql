-- View: global_price_daily_filled
-- Description: Fills the gaps in the daily prices of global assets.

create materialized view public.global_price_daily_filled as
with
  assets as (
    select distinct
      a.symbol as asset_symbol,
      a.manual_price
    from
      global_assets a
    where
      (
        exists (
          select
            1
          from
            global_price_daily g
          where
            g.asset_symbol = a.symbol
        )
      )
      or a.manual_price is not null
      or (
        exists (
          select
            1
          from
            events e
          where
            e.asset_symbol = a.symbol
        )
      )
  ),
  bounds as (
    select
      a.asset_symbol,
      LEAST(
        COALESCE(
          (
            select
              min(g.date) as min
            from
              global_price_daily g
            where
              g.asset_symbol = a.asset_symbol
          ),
          CURRENT_DATE
        ),
        COALESCE(
          (
            select
              min(e.tstamp::date) as min
            from
              events e
            where
              e.asset_symbol = a.asset_symbol
          ),
          CURRENT_DATE
        )
      ) as start_date
    from
      assets a
  ),
  calendar as (
    select
      b.asset_symbol,
      gs.gs::date as date
    from
      bounds b,
      lateral generate_series(
        b.start_date::timestamp with time zone,
        CURRENT_DATE::timestamp with time zone,
        '1 day'::interval
      ) gs (gs)
  ),
  marked as (
    select
      c.asset_symbol,
      c.date,
      g.price
    from
      calendar c
      left join global_price_daily g on g.asset_symbol = c.asset_symbol
      and g.date = c.date
  ),
  last_date as (
    select
      m.asset_symbol,
      m.date,
      max(
        case
          when m.price is not null then m.date
          else null::date
        end
      ) over (
        partition by
          m.asset_symbol
        order by
          m.date rows between UNBOUNDED PRECEDING
          and CURRENT row
      ) as last_date_with_price
    from
      marked m
  ),
  filled as (
    select
      l.asset_symbol,
      l.date,
      (
        select
          g.price
        from
          global_price_daily g
        where
          g.asset_symbol = l.asset_symbol
          and g.date = l.last_date_with_price
      ) as global_price
    from
      last_date l
  ),
  resolved as (
    select
      f.asset_symbol,
      f.date,
      COALESCE(f.global_price, a.manual_price, 0::numeric)::numeric(20, 10) as price
    from
      filled f
      join assets a on a.asset_symbol = f.asset_symbol
  )
select
  asset_symbol,
  date,
  price
from
  resolved
order by
  asset_symbol,
  date;

ALTER MATERIALIZED VIEW public.global_price_daily_filled OWNER TO postgres;

CREATE UNIQUE INDEX idx_gpdf_asset_date ON public.global_price_daily_filled USING btree (asset_symbol, date);
