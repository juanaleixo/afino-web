-- Table: portfolio_value_daily
-- Description: Armazena o valor diário agregado do portfólio por usuário.

CREATE TABLE IF NOT EXISTS public.portfolio_value_daily (
    user_id uuid NOT NULL,
    date date NOT NULL,
    total_value numeric(20,10) DEFAULT 0,
    CONSTRAINT portfolio_value_daily_pkey PRIMARY KEY (user_id, date)
);

ALTER TABLE public.portfolio_value_daily OWNER TO postgres;

