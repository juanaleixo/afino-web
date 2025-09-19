-- Working holdings API

CREATE OR REPLACE FUNCTION api_dashboard_holdings()
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  -- Get only latest position per asset (minimal data)
  RETURN jsonb_build_object(
    'holdings', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'asset_id', asset_id,
          'date', date,
          'units', units,
          'value', value
        )
      ), '[]'::jsonb)
      FROM (
        SELECT DISTINCT ON (asset_id)
          asset_id, date, units, value
        FROM daily_positions_acct
        WHERE user_id = v_user_id
          AND date >= (current_date - interval '3 days')
          AND value > 0.01
        ORDER BY asset_id, date DESC
        LIMIT 20  -- Max 20 different assets
      ) latest_holdings
    ),
    'assets_metadata', '{}'::jsonb,
    'custom_assets', '{}'::jsonb,
    'timestamp', extract(epoch FROM now()) * 1000
  );
END;
$$ LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
SET statement_timeout = '5s';

GRANT EXECUTE ON FUNCTION api_dashboard_holdings() TO authenticated;