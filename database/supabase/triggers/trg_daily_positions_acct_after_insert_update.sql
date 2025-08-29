-- Trigger for INSERT or UPDATE operations on daily_positions_acct
CREATE TRIGGER trg_daily_positions_acct_after_insert_update
AFTER INSERT OR UPDATE ON daily_positions_acct
FOR EACH ROW
EXECUTE FUNCTION refresh_portfolio_mvs_incremental();
