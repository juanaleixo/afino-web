-- Function: trg_events_create_custom_valuations()
-- Description: Automatically create custom asset valuations when events with prices are created

CREATE OR REPLACE FUNCTION public.trg_events_create_custom_valuations()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_is_custom_asset boolean := false;
  v_event_date date;
  v_price numeric(20,10);
BEGIN
  -- Verificar se é um ativo personalizado (UUID)
  v_is_custom_asset := NEW.asset_symbol ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  
  -- Se não for ativo personalizado, não faz nada
  IF NOT v_is_custom_asset THEN
    RETURN NEW;
  END IF;
  
  -- Extrair data do evento
  v_event_date := (NEW.tstamp)::date;
  
  -- Determinar preço baseado no tipo de evento
  v_price := NULL;
  
  CASE NEW.kind
    WHEN 'buy', 'position_add' THEN
      v_price := NEW.price_close;
    WHEN 'valuation' THEN
      v_price := NEW.price_override;
    ELSE
      -- Para outros tipos (deposit, withdraw), não criar avaliação
      RETURN NEW;
  END CASE;
  
  -- Se há preço válido, criar/atualizar avaliação
  IF v_price IS NOT NULL AND v_price > 0 THEN
    INSERT INTO public.custom_asset_valuations (asset_id, date, value)
    VALUES (NEW.asset_symbol::uuid, v_event_date, v_price)
    ON CONFLICT (asset_id, date)
    DO UPDATE SET 
      value = EXCLUDED.value,
      created_at = now();
      
    -- Log para debug (opcional, pode ser removido em produção)
    RAISE NOTICE 'Avaliação automática criada/atualizada: asset_id=%, date=%, value=%', 
      NEW.asset_symbol, v_event_date, v_price;
  END IF;
  
  RETURN NEW;
END;
$$;

ALTER FUNCTION public.trg_events_create_custom_valuations() OWNER TO postgres;

GRANT ALL ON FUNCTION public.trg_events_create_custom_valuations() TO supabase_admin;
GRANT ALL ON FUNCTION public.trg_events_create_custom_valuations() TO service_role;