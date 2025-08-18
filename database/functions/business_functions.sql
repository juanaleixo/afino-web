-- Funções de negócio (stubs/impl simplificada)

-- Recalcula posições (stub)
CREATE OR REPLACE FUNCTION fn_recalc_positions_acct(
  p_user uuid,
  p_account uuid,
  p_asset uuid,
  p_from date
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- TODO: Implementação real de recálculo incremental
  PERFORM 1;
END;
$$;

-- Trigger helper para recalcular após eventos
CREATE OR REPLACE FUNCTION trg_events_recalc_acct()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user uuid;
  v_account uuid;
  v_asset uuid;
  v_date date;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    v_user := NEW.user_id; v_account := NEW.account_id; v_asset := NEW.asset_id; v_date := NEW.tstamp::date;
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Recalcula lado OLD
    PERFORM fn_recalc_positions_acct(OLD.user_id, OLD.account_id, OLD.asset_id, OLD.tstamp::date);
    -- E lado NEW
    v_user := NEW.user_id; v_account := NEW.account_id; v_asset := NEW.asset_id; v_date := NEW.tstamp::date;
  ELSIF (TG_OP = 'DELETE') THEN
    v_user := OLD.user_id; v_account := OLD.account_id; v_asset := OLD.asset_id; v_date := OLD.tstamp::date;
  END IF;

  PERFORM fn_recalc_positions_acct(v_user, v_account, v_asset, v_date);
  RETURN COALESCE(NEW, OLD);
END;
$$;

