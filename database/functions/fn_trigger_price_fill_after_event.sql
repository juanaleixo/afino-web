-- Function: fn_trigger_price_fill_after_event()
-- Description: Trigger function que agenda preenchimento de preços após criação de evento

CREATE OR REPLACE FUNCTION public.fn_trigger_price_fill_after_event() 
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_global_asset boolean;
  v_needs_prices boolean;
BEGIN
  -- Só processa INSERTs
  IF TG_OP <> 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Verifica se é global asset (não é UUID)
  v_is_global_asset := NEW.asset_symbol IS NOT NULL 
    AND NEW.asset_symbol !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

  IF v_is_global_asset THEN
    -- Verifica se o asset precisa de preços (não tem preços recentes)
    SELECT COUNT(*) = 0 INTO v_needs_prices
    FROM public.global_price_daily gpd
    WHERE gpd.asset_symbol = NEW.asset_symbol
      AND gpd.date >= CURRENT_DATE - INTERVAL '7 days';

    IF v_needs_prices THEN
      -- Agenda preenchimento de preços (assíncrono via NOTIFY)
      PERFORM pg_notify('price_fill_needed', json_build_object(
        'asset_symbol', NEW.asset_symbol,
        'event_id', NEW.id,
        'created_at', NEW.created_at
      )::text);

      -- Log para debug
      RAISE NOTICE 'Preenchimento de preços agendado para asset: %', NEW.asset_symbol;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Cria o trigger na tabela events
DROP TRIGGER IF EXISTS trigger_price_fill_after_event ON public.events;
CREATE TRIGGER trigger_price_fill_after_event
  AFTER INSERT ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_trigger_price_fill_after_event();

ALTER FUNCTION public.fn_trigger_price_fill_after_event() OWNER TO postgres;
GRANT ALL ON FUNCTION public.fn_trigger_price_fill_after_event() TO authenticated;
GRANT ALL ON FUNCTION public.fn_trigger_price_fill_after_event() TO service_role;