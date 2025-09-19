-- Ultra-fast holdings API - Optimized to prevent statement timeout
-- Strategy: Get the latest available date first, then query only that date
-- This avoids scanning multiple partitions and is much faster

CREATE OR REPLACE FUNCTION api_dashboard_holdings()
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_latest_date date;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  -- First, find the latest date with data for this user (fast query)
  SELECT MAX(date) INTO v_latest_date
  FROM daily_positions_acct
  WHERE user_id = v_user_id
    AND date >= (current_date - interval '7 days')  -- Look back 7 days max
    AND is_final = true
    AND value > 0.01;

  -- If no recent data found, return empty result
  IF v_latest_date IS NULL THEN
    RETURN jsonb_build_object(
      'holdings', '[]'::jsonb,
      'assets_metadata', '{}'::jsonb,
      'custom_assets', '{}'::jsonb,
      'timestamp', extract(epoch FROM now()) * 1000
    );
  END IF;

  -- Now get all holdings for that specific date (very fast - single partition)
  RETURN jsonb_build_object(
    'holdings', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'asset_id', asset_id,
          'date', date,
          'units', units,
          'value', value
        )
        ORDER BY value DESC  -- Order by value for consistency
      ), '[]'::jsonb)
      FROM daily_positions_acct
      WHERE user_id = v_user_id
        AND date = v_latest_date  -- Single date = single partition scan
        AND is_final = true
        AND value > 0.01
      LIMIT 20  -- Safety limit
    ),
    'assets_metadata', '{}'::jsonb,
    'custom_assets', '{}'::jsonb,
    'timestamp', extract(epoch FROM now()) * 1000
  );
END;
$$ LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
SET statement_timeout = '3s';  -- Reduced timeout for faster failure detection

GRANT EXECUTE ON FUNCTION api_dashboard_holdings() TO authenticated;