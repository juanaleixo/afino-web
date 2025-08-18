-- Function: ensure_daily_positions_partitions(date, date)
-- Description: Ensures that the daily positions partitions exist for a given date range.

CREATE FUNCTION public.ensure_daily_positions_partitions(p_from date, p_to date) RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
d_start date := date_trunc('month', p_from)::date;
d_end date := date_trunc('month', p_to)::date;
d_cur date;
part_name text;
part_exists boolean;
range_start date;
range_end date;
BEGIN
IF p_from IS NULL OR p_to IS NULL OR p_to < p_from THEN
RAISE EXCEPTION 'Parâmetros inválidos em ensure_daily_positions_partitions (p_from=%, p_to=%)', p_from, p_to;
END IF;
d_cur := d_start;
WHILE d_cur <= d_end LOOP
part_name := format('daily_positions_acct_%s', to_char(d_cur, 'YYYY_MM'));
range_start := d_cur;
range_end := (d_cur + INTERVAL '1 month')::date;
SELECT EXISTS (
SELECT 1
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relname = part_name
) INTO part_exists;
IF NOT part_exists THEN
-- cria a partição do mês
EXECUTE format(
'CREATE TABLE public.%I PARTITION OF public.daily_positions_acct FOR VALUES FROM (%L) TO (%L);',
part_name, range_start, range_end
);
-- índices essenciais na partição
EXECUTE format(
'CREATE INDEX IF NOT EXISTS %I ON public.%I (user_id, date);',
'ix_'||part_name||'_user_date', part_name
);
EXECUTE format(
'CREATE INDEX IF NOT EXISTS %I ON public.%I (user_id, asset_id, date);',
'ix_'||part_name||'_user_asset_date', part_name
);
EXECUTE format(
'CREATE INDEX IF NOT EXISTS %I ON public.%I (user_id, account_id, asset_id, date);',
'ix_'||part_name||'_user_acct_asset_date', part_name
);
END IF;
d_cur := range_end;
END LOOP;
END$$;

ALTER FUNCTION public.ensure_daily_positions_partitions(p_from date, p_to date) OWNER TO postgres;

GRANT ALL ON FUNCTION public.ensure_daily_positions_partitions(p_from date, p_to date) TO anon;
GRANT ALL ON FUNCTION public.ensure_daily_positions_partitions(p_from date, p_to date) TO authenticated;
GRANT ALL ON FUNCTION public.ensure_daily_positions_partitions(p_from date, p_to date) TO service_role;
GRANT ALL ON FUNCTION public.ensure_daily_positions_partitions(p_from date, p_to date) TO supabase_admin;
