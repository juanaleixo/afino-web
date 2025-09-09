-- Trigger to automatically update user premium status when subscriptions change
DROP TRIGGER IF EXISTS trigger_update_user_premium_status ON pay.subscriptions;
CREATE TRIGGER trigger_update_user_premium_status
    AFTER INSERT OR UPDATE OR DELETE ON pay.subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_user_premium_status();