-- Table: daily_positions_acct
-- Description: Stores the daily positions of each asset in each account.

CREATE TABLE public.daily_positions_acct (
    user_id uuid NOT NULL,
    account_id uuid NOT NULL,
    asset_id text NOT NULL,
    date date NOT NULL,
    units numeric(38,18) NOT NULL,
    price numeric(20,10),
    value numeric(20,10),
    currency text NOT NULL,
    source_price text,
    is_final boolean DEFAULT true,
    CONSTRAINT daily_positions_acct_source_price_check CHECK ((source_price = ANY (ARRAY['global'::text, 'manual'::text, 'custom'::text])))
)
PARTITION BY RANGE (date);

ALTER TABLE ONLY public.daily_positions_acct FORCE ROW LEVEL SECURITY;

ALTER TABLE public.daily_positions_acct OWNER TO postgres;

ALTER TABLE ONLY public.daily_positions_acct
ADD CONSTRAINT daily_positions_acct_pkey PRIMARY KEY (user_id, account_id, asset_id, date);

CREATE UNIQUE INDEX ux_dpa_user_acct_asset_date ON ONLY public.daily_positions_acct USING btree (user_id, account_id, asset_id, date);
