-- API simplificada para dados brutos de timeline - sem processamento

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

  -- Check if premium (simple)
  SELECT COALESCE(
    (SELECT up.subscription_status = 'active' AND
            (up.premium_expires_at IS NULL OR up.premium_expires_at > now())
     FROM user_profiles up
     WHERE up.user_id = v_user_id
     LIMIT 1),
    false
  ) INTO v_is_premium;

  -- Raw timeline data - no processing
  SELECT jsonb_build_object(
    'monthly_data', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'month', m.month,
          'value', m.month_value
        )
        ORDER BY m.month DESC
      ), '[]'::jsonb)
      FROM portfolio_value_monthly m
      WHERE m.user_id = v_user_id
        AND m.month >= (current_date - interval '12 months')
      LIMIT 12
    ),
    'daily_data', (
      SELECT CASE WHEN v_is_premium THEN
        COALESCE(jsonb_agg(
          jsonb_build_object(
            'date', d.date,
            'value', d.total_value
          )
          ORDER BY d.date DESC
        ), '[]'::jsonb)
      ELSE '[]'::jsonb END
      FROM portfolio_value_daily d
      WHERE d.user_id = v_user_id
        AND d.date >= (current_date - interval '6 months')
        AND v_is_premium
      LIMIT 180
    ),
    'is_premium', v_is_premium,
    'timestamp', extract(epoch FROM now()) * 1000
  ) INTO v_result;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql VOLATILE
SECURITY DEFINER
SET search_path = public, extensions
SET statement_timeout = '5s';

GRANT EXECUTE ON FUNCTION api_dashboard_timeline() TO authenticated;