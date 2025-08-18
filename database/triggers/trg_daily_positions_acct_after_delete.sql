-- Trigger for DELETE operations on daily_positions_acct
CREATE TRIGGER trg_daily_positions_acct_after_delete
AFTER DELETE ON daily_positions_acct
FOR EACH ROW
EXECUTE FUNCTION refresh_portfolio_mvs_incremental();