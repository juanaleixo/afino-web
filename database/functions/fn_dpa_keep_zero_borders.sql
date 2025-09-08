-- Function: fn_dpa_keep_zero_borders(uuid, uuid, text, date, date, numeric)
-- Description: Deletes zero-value borders in the daily positions.

CREATE FUNCTION public.fn_dpa_keep_zero_borders(p_user uuid, p_account uuid, p_asset text, p_from date, p_to date, p_eps numeric DEFAULT 0.000000001) RETURNS void
LANGUAGE sql
AS $$
WITH rng AS (
SELECT d.date,
COALESCE(d.value,0) AS value,
COALESCE(d.units,0) AS units
FROM public.daily_positions_acct d
WHERE d.user_id = p_user
AND d.account_id = p_account
AND d.asset_id = p_asset
AND d.date BETWEEN (p_from - INTERVAL '1 day')::date
AND (p_to + INTERVAL '1 day')::date
),
mark AS (
SELECT date, value, units,
LAG(value) OVER (ORDER BY date) AS prev_val,
LEAD(value) OVER (ORDER BY date) AS next_val
FROM rng
),
to_delete AS (
SELECT date
FROM mark
WHERE date BETWEEN p_from AND p_to
AND date < p_to  -- Nunca remove o último dia do período
AND ABS(value) <= p_eps -- dia é zero
AND prev_val IS NOT NULL -- ambos vizinhos existem
AND next_val IS NOT NULL
AND ABS(prev_val) <= p_eps -- e ambos também zero
AND ABS(next_val) <= p_eps
)
DELETE FROM public.daily_positions_acct d
USING to_delete x
WHERE d.user_id = p_user
AND d.account_id = p_account
AND d.asset_id = p_asset
AND d.date = x.date;
$$;

ALTER FUNCTION public.fn_dpa_keep_zero_borders(p_user uuid, p_account uuid, p_asset text, p_from date, p_to date, p_eps numeric) OWNER TO postgres;

GRANT ALL ON FUNCTION public.fn_dpa_keep_zero_borders(p_user uuid, p_account uuid, p_asset text, p_from date, p_to date, p_eps numeric) TO supabase_admin;
GRANT ALL ON FUNCTION public.fn_dpa_keep_zero_borders(p_user uuid, p_account uuid, p_asset text, p_from date, p_to date, p_eps numeric) TO anon;
GRANT ALL ON FUNCTION public.fn_dpa_keep_zero_borders(p_user uuid, p_account uuid, p_asset text, p_from date, p_to date, p_eps numeric) TO authenticated;
GRANT ALL ON FUNCTION public.fn_dpa_keep_zero_borders(p_user uuid, p_account uuid, p_asset text, p_from date, p_to date, p_eps numeric) TO service_role;
