-- API ultra-rápida - apenas dados brutos essenciais
-- Cálculos movidos para frontend para máxima velocidade

CREATE OR REPLACE FUNCTION api_dashboard_essential()
RETURNS jsonb AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_result jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  -- Ultra-simple raw data query
  SELECT jsonb_build_object(
    'user_context', jsonb_build_object(
      'user_id', v_user_id,
      'is_premium', COALESCE(
        (SELECT up.subscription_status = 'active' AND
                (up.premium_expires_at IS NULL OR up.premium_expires_at > now())
         FROM user_profiles up
         WHERE up.user_id = v_user_id
         LIMIT 1),
        false
      ),
      'last_update', extract(epoch FROM now()) * 1000
    ),
    'portfolio_summary', (
      SELECT jsonb_build_object(
        'total_value', COALESCE(pv.total_value, 0),
        'date', pv.date,
        'last_updated', extract(epoch FROM pv.date) * 1000
      )
      FROM portfolio_value_daily pv
      WHERE pv.user_id = v_user_id
      ORDER BY pv.date DESC
      LIMIT 1
    ),
    'status', 'success',
    'timestamp', extract(epoch FROM now()) * 1000
  ) INTO v_result;

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
SET statement_timeout = '3s';

-- Permissões
GRANT EXECUTE ON FUNCTION api_dashboard_essential() TO authenticated;