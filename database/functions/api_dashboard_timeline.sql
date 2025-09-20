-- Ultra-fast timeline API - Maximum performance
CREATE OR REPLACE FUNCTION api_dashboard_timeline()
RETURNS TABLE(date date, total_value numeric) AS $$
BEGIN
  RETURN QUERY
  SELECT
    dp.date,
    SUM(dp.value)::numeric
  FROM daily_positions_acct dp
  WHERE dp.user_id = auth.uid()
    AND dp.is_final = true
    AND dp.date >= CURRENT_DATE - 30  -- Return 1 month only
  GROUP BY dp.date
  ORDER BY dp.date ASC  -- Chronological order
  LIMIT 30;  -- 30 days max
END;
$$ LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, extensions;

GRANT EXECUTE ON FUNCTION api_dashboard_timeline() TO authenticated;