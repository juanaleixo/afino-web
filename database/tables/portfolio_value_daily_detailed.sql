-- Table: portfolio_value_daily_detailed
-- Description: Armazena o valor diário por ativo para cada usuário (tabela de agregados incremental).

CREATE TABLE IF NOT EXISTS public.portfolio_value_daily_detailed (
    user_id uuid NOT NULL,
    asset_id text NOT NULL,
    date date NOT NULL,
    asset_value numeric(20,10) DEFAULT 0,
    CONSTRAINT portfolio_value_daily_detailed_pkey PRIMARY KEY (user_id, asset_id, date)
);

ALTER TABLE public.portfolio_value_daily_detailed OWNER TO postgres;

