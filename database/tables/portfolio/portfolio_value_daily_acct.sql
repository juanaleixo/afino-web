-- Table: portfolio_value_daily_acct
-- Description: Armazena o valor diário agregado por conta para cada usuário.

CREATE TABLE IF NOT EXISTS public.portfolio_value_daily_acct (
    user_id uuid NOT NULL,
    account_id uuid NOT NULL,
    date date NOT NULL,
    total_value numeric(20,10) DEFAULT 0,
    CONSTRAINT portfolio_value_daily_acct_pkey PRIMARY KEY (user_id, account_id, date)
);

ALTER TABLE public.portfolio_value_daily_acct OWNER TO postgres;

