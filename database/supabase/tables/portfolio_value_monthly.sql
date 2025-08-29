-- Table: portfolio_value_monthly
-- Description: Armazena o valor mensal agregado do portfólio por usuário (mês = 1º dia do mês).

CREATE TABLE IF NOT EXISTS public.portfolio_value_monthly (
    user_id uuid NOT NULL,
    month date NOT NULL,
    month_value numeric(20,10) DEFAULT 0,
    CONSTRAINT portfolio_value_monthly_pkey PRIMARY KEY (user_id, month)
);

ALTER TABLE public.portfolio_value_monthly OWNER TO postgres;

