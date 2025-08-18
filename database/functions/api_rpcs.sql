-- RPCs expostas ao frontend

-- Série diária do patrimônio (Premium)
CREATE OR REPLACE FUNCTION api_portfolio_daily(p_from date, p_to date)
RETURNS TABLE(date date, total_value numeric)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT app_is_premium() THEN
    RAISE EXCEPTION 'Requires premium plan';
  END IF;
  RETURN QUERY
    SELECT d.date, d.total_value
    FROM portfolio_value_daily d
    WHERE d.user_id = app_current_user()
      AND d.date BETWEEN p_from AND p_to
    ORDER BY d.date;
END;
$$;

-- Série mensal do patrimônio (Free & Premium)
CREATE OR REPLACE FUNCTION api_portfolio_monthly(p_from date, p_to date)
RETURNS TABLE(month_eom date, total_value numeric)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT m.month_eom, m.total_value
  FROM portfolio_value_monthly m
  WHERE m.user_id = app_current_user()
    AND m.month_eom BETWEEN p_from AND p_to
  ORDER BY m.month_eom;
$$;

-- Snapshot por ativo em uma data
CREATE OR REPLACE FUNCTION api_holdings_at(p_date date)
RETURNS TABLE(asset_id uuid, units numeric, value numeric)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT p.asset_id,
         SUM(COALESCE(p.units,0)) AS units,
         SUM(COALESCE(p.value,0)) AS value
  FROM daily_positions_acct p
  WHERE p.user_id = app_current_user()
    AND p.date = p_date
    AND p.is_final
  GROUP BY p.asset_id
  ORDER BY value DESC NULLS LAST;
$$;

-- Snapshot por conta+ativo (Premium)
CREATE OR REPLACE FUNCTION api_holdings_accounts(p_date date)
RETURNS TABLE(account_id uuid, asset_id uuid, units numeric, value numeric)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NOT app_is_premium() THEN
    RAISE EXCEPTION 'Requires premium plan';
  END IF;
  RETURN QUERY
    SELECT p.account_id,
           p.asset_id,
           SUM(COALESCE(p.units,0)) AS units,
           SUM(COALESCE(p.value,0)) AS value
    FROM daily_positions_acct p
    WHERE p.user_id = app_current_user()
      AND p.date = p_date
      AND p.is_final
    GROUP BY p.account_id, p.asset_id
    ORDER BY p.account_id, value DESC NULLS LAST;
END;
$$;

-- Permissões para anon/authenticated executarem RPCs
GRANT EXECUTE ON FUNCTION api_portfolio_daily(date, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION api_portfolio_monthly(date, date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION api_holdings_at(date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION api_holdings_accounts(date) TO anon, authenticated;
