-- Function: api_portfolio_summary(date)
-- Description: Get portfolio summary with top assets in one call

CREATE OR REPLACE FUNCTION public.api_portfolio_summary(p_date date DEFAULT CURRENT_DATE)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result JSON;
  current_user_id UUID := app_current_user();
  target_date DATE;
BEGIN
  IF current_user_id IS NULL THEN
    RETURN json_build_object(
      'total_value', 0,
      'total_assets', 0,
      'date', p_date,
      'has_data', false
    );
  END IF;

  -- Find the latest available date
  SELECT MAX(d.date) INTO target_date
  FROM public.daily_positions_acct d
  WHERE d.user_id = current_user_id 
    AND d.date <= p_date 
    AND COALESCE(d.is_final, true) = true;

  IF target_date IS NULL THEN
    RETURN json_build_object(
      'total_value', 0,
      'total_assets', 0,
      'date', p_date,
      'has_data', false
    );
  END IF;

  SELECT json_build_object(
    'total_value', COALESCE(SUM(dp.value), 0),
    'total_assets', COUNT(DISTINCT dp.asset_id),
    'date', target_date,
    'has_data', true,
    'top_assets', COALESCE(
      json_agg(
        json_build_object(
          'asset_id', COALESCE(ranked_assets.symbol, ranked_assets.asset_id::text),
          'symbol', ranked_assets.symbol,
          'value', ranked_assets.asset_value,
          'percentage', ROUND((ranked_assets.asset_value / NULLIF(ranked_assets.total_portfolio_value, 0)) * 100, 2)
        )
        ORDER BY ranked_assets.asset_value DESC
      ) FILTER (WHERE ranked_assets.rn <= 5),
      '[]'::json
    )
  )
  INTO result
  FROM (
    SELECT 
      dp.asset_id,
      ga.symbol,
      SUM(dp.value) as asset_value,
      SUM(SUM(dp.value)) OVER () as total_portfolio_value,
      ROW_NUMBER() OVER (ORDER BY SUM(dp.value) DESC) as rn
    FROM public.daily_positions_acct dp
    LEFT JOIN public.global_assets ga ON ga.symbol = dp.asset_id::text
    WHERE dp.user_id = current_user_id 
      AND dp.date = target_date
      AND COALESCE(dp.is_final, true) = true
    GROUP BY dp.asset_id, ga.symbol
    HAVING SUM(dp.value) > 0.01
  ) ranked_assets;

  RETURN result;
END;
$$;

ALTER FUNCTION public.api_portfolio_summary(p_date date) OWNER TO postgres;

GRANT ALL ON FUNCTION public.api_portfolio_summary(p_date date) TO anon;
GRANT ALL ON FUNCTION public.api_portfolio_summary(p_date date) TO authenticated;
GRANT ALL ON FUNCTION public.api_portfolio_summary(p_date date) TO service_role;
GRANT ALL ON FUNCTION public.api_portfolio_summary(p_date date) TO supabase_admin;