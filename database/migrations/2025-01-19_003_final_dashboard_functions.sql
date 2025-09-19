-- Final migration with realistic timeouts and optimized queries
-- Removes all conflicts and creates working dashboard functions

-- Drop ALL possible conflicting function variations
DROP FUNCTION IF EXISTS api_dashboard_essential() CASCADE;
DROP FUNCTION IF EXISTS api_dashboard_essential(p_date text) CASCADE;
DROP FUNCTION IF EXISTS api_dashboard_essential(p_date date) CASCADE;
DROP FUNCTION IF EXISTS api_dashboard_holdings() CASCADE;
DROP FUNCTION IF EXISTS api_dashboard_holdings(p_date text) CASCADE;
DROP FUNCTION IF EXISTS api_dashboard_holdings(p_date date) CASCADE;
DROP FUNCTION IF EXISTS api_dashboard_timeline() CASCADE;
DROP FUNCTION IF EXISTS api_dashboard_timeline(p_date text) CASCADE;
DROP FUNCTION IF EXISTS api_dashboard_timeline(p_date date) CASCADE;
DROP FUNCTION IF EXISTS api_dashboard_timeline(p_date date, p_is_premium boolean) CASCADE;

-- Essential data function (optimized and realistic timeout)
CREATE OR REPLACE FUNCTION api_dashboard_essential()
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  -- Simplified ultra-fast query
  WITH user_premium AS (
    SELECT COALESCE(
      (SELECT up.subscription_status = 'active' AND
              (up.premium_expires_at IS NULL OR up.premium_expires_at > now())
       FROM user_profiles up
       WHERE up.user_id = v_user_id
       LIMIT 1),
      false
    ) as is_premium
  ),
  latest_portfolio AS (
    SELECT
      COALESCE(pv.total_value, 0) as total_value,
      extract(epoch FROM pv.date) * 1000 as last_updated
    FROM portfolio_value_daily pv
    WHERE pv.user_id = v_user_id
    ORDER BY pv.date DESC
    LIMIT 1
  ),
  holdings_count AS (
    SELECT count(DISTINCT asset_id)::integer as total_holdings
    FROM daily_positions_acct dp
    WHERE dp.user_id = v_user_id
      AND dp.date >= (current_date - interval '7 days')
      AND dp.value > 0.01
    LIMIT 50  -- Safety limit
  )
  SELECT jsonb_build_object(
    'user_context', jsonb_build_object(
      'user_id', v_user_id,
      'is_premium', up.is_premium,
      'last_update', extract(epoch FROM now()) * 1000
    ),
    'portfolio_summary', jsonb_build_object(
      'total_value', COALESCE(lp.total_value, 0),
      'last_updated', lp.last_updated,
      'holdings_count', COALESCE(hc.total_holdings, 0)
    ),
    'status', 'success',
    'timestamp', extract(epoch FROM now()) * 1000
  ) INTO v_result
  FROM user_premium up, latest_portfolio lp, holdings_count hc;

  RETURN COALESCE(v_result, jsonb_build_object(
    'user_context', jsonb_build_object(
      'user_id', v_user_id,
      'is_premium', false,
      'last_update', extract(epoch FROM now()) * 1000
    ),
    'portfolio_summary', jsonb_build_object(
      'total_value', 0,
      'holdings_count', 0,
      'last_updated', null
    ),
    'status', 'no_data',
    'timestamp', extract(epoch FROM now()) * 1000
  ));
END;
$$ LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
SET statement_timeout = '15s';

-- Holdings data function (optimized)
CREATE OR REPLACE FUNCTION api_dashboard_holdings()
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  -- Get current holdings optimized with date range
  WITH current_holdings AS (
    SELECT
      dp.asset_id,
      COALESCE(ga.symbol, ca.symbol, dp.asset_id) as symbol,
      COALESCE(ga.class, ca.class, 'unknown') as class,
      COALESCE(ga.label_ptbr, ca.label, dp.asset_id) as label_ptbr,
      sum(dp.units) as total_units,
      sum(dp.value) as total_value
    FROM daily_positions_acct dp
    LEFT JOIN global_assets ga ON ga.symbol = dp.asset_id
    LEFT JOIN custom_assets ca ON ca.id::text = dp.asset_id AND ca.user_id = v_user_id
    WHERE dp.user_id = v_user_id
      AND dp.date >= (current_date - interval '7 days')
      AND dp.date = (
        SELECT max(date)
        FROM daily_positions_acct
        WHERE user_id = v_user_id
          AND date >= (current_date - interval '7 days')
      )
      AND dp.value > 0.01
    GROUP BY dp.asset_id, ga.symbol, ca.symbol, ga.class, ca.class, ga.label_ptbr, ca.label
    LIMIT 100  -- Safety limit
  ),
  portfolio_stats AS (
    SELECT
      count(*) as total_assets,
      sum(total_value) as portfolio_total,
      max(total_value) as largest_value,
      (SELECT symbol FROM current_holdings ORDER BY total_value DESC LIMIT 1) as largest_symbol
    FROM current_holdings
  )
  SELECT jsonb_build_object(
    'holdings', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'asset_id', ch.asset_id,
          'symbol', ch.symbol,
          'class', ch.class,
          'label_ptbr', ch.label_ptbr,
          'units', ch.total_units,
          'value', ch.total_value
        )
        ORDER BY ch.total_value DESC
      ), '[]'::jsonb)
      FROM current_holdings ch
    ),
    'portfolio_stats', (
      SELECT jsonb_build_object(
        'total_value', ps.portfolio_total,
        'total_assets', ps.total_assets,
        'largest_holding', CASE
          WHEN ps.largest_symbol IS NOT NULL THEN
            jsonb_build_object(
              'symbol', ps.largest_symbol,
              'percentage', CASE
                WHEN ps.portfolio_total > 0 THEN (ps.largest_value / ps.portfolio_total) * 100
                ELSE 0
              END
            )
          ELSE null
        END,
        'diversification', (
          SELECT jsonb_build_object(
            'score', CASE
              WHEN ps.total_assets >= 10 THEN 85
              WHEN ps.total_assets >= 5 THEN 65
              WHEN ps.total_assets >= 3 THEN 45
              ELSE 25
            END,
            'label', CASE
              WHEN ps.total_assets >= 10 THEN 'Alta'
              WHEN ps.total_assets >= 5 THEN 'Média'
              WHEN ps.total_assets >= 3 THEN 'Razoável'
              ELSE 'Baixa'
            END
          )
        )
      )
      FROM portfolio_stats ps
    ),
    'timestamp', extract(epoch FROM now()) * 1000
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
SET statement_timeout = '20s';

-- Timeline data function
CREATE OR REPLACE FUNCTION api_dashboard_timeline()
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_is_premium boolean;
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  -- Check premium status using correct table
  SELECT COALESCE(
    (SELECT up.subscription_status = 'active' AND
            (up.premium_expires_at IS NULL OR up.premium_expires_at > now())
     FROM user_profiles up
     WHERE up.user_id = v_user_id
     LIMIT 1),
    false
  ) INTO v_is_premium;

  -- Get optimized timeline data
  WITH timeline_data AS (
    -- For premium users: daily data from last 6 months
    SELECT 'daily' as type, d.date::text as period, d.total_value
    FROM portfolio_value_daily d
    WHERE d.user_id = v_user_id
      AND d.date >= (current_date - interval '6 months')
      AND v_is_premium

    UNION ALL

    -- For everyone: monthly data from last 12 months
    SELECT 'monthly' as type, m.month::text as period, m.month_value as total_value
    FROM portfolio_value_monthly m
    WHERE m.user_id = v_user_id
      AND m.month >= (current_date - interval '12 months')

    ORDER BY period DESC
    LIMIT 200 -- Safety limit
  )
  SELECT jsonb_build_object(
    'daily_series', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('date', td.period, 'total_value', td.total_value)
        ORDER BY td.period
      ), '[]'::jsonb)
      FROM timeline_data td
      WHERE td.type = 'daily' AND v_is_premium
    ),
    'monthly_series', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object('month_eom', td.period, 'total_value', td.total_value)
        ORDER BY td.period
      ), '[]'::jsonb)
      FROM timeline_data td
      WHERE td.type = 'monthly'
    ),
    'is_premium', v_is_premium,
    'timestamp', extract(epoch FROM now()) * 1000
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
SET statement_timeout = '25s';

-- Grant permissions
GRANT EXECUTE ON FUNCTION api_dashboard_essential() TO authenticated;
GRANT EXECUTE ON FUNCTION api_dashboard_holdings() TO authenticated;
GRANT EXECUTE ON FUNCTION api_dashboard_timeline() TO authenticated;

SELECT 'Final dashboard functions created successfully' as status;