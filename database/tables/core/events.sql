-- Table: events
-- Description: Stores all events and transactions.

create table public.events (
  id uuid not null default gen_random_uuid (),
  user_id uuid not null,
  account_id uuid null,
  tstamp timestamp with time zone not null default now(),
  kind text not null,
  units_delta numeric null,
  price_override numeric null,
  price_close numeric null,
  meta jsonb null default '{}'::jsonb,
  created_at timestamp with time zone null default now(),
  asset_symbol text null,
  constraint events_pkey primary key (id),
  -- Removed FK constraint to allow both global asset symbols and custom asset UUIDs
  constraint events_user_id_fkey foreign KEY (user_id) references auth.users (id),
  constraint events_account_id_fkey foreign KEY (account_id) references accounts (id),
  constraint events_kind_check check (
    (
      kind = any (
        array[
          'deposit'::text,
          'withdraw'::text,
          'buy'::text,
          'position_add'::text,
          'valuation'::text
        ]
      )
    )
  ),
  constraint events_business_logic_check check (
    (
      (
        (kind <> 'valuation'::text)
        and (units_delta is not null)
      )
      or (
        (kind = 'valuation'::text)
        and (
          (
            (
              kind = any (array['buy'::text, 'position_add'::text])
            )
            and (price_close is not null)
          )
          or (
            kind <> all (array['buy'::text, 'position_add'::text])
          )
        )
        and (
          (
            (kind = 'valuation'::text)
            and (price_override is not null)
          )
          or (kind <> 'valuation'::text)
        )
        and (
          (price_override is null)
          or (
            kind = any (
              array[
                'deposit'::text,
                'withdraw'::text,
                'valuation'::text
              ]
            )
          )
        )
      )
    )
  ),
  constraint events_tstamp_not_future check ((tstamp <= now()))
) TABLESPACE pg_default;

ALTER TABLE ONLY public.events FORCE ROW LEVEL SECURITY;

ALTER TABLE public.events OWNER TO postgres;