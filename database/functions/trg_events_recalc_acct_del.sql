-- Function: trg_events_recalc_acct_del()
-- Description: Trigger function to recalculate the daily positions and handle custom valuations after deleting an event.

CREATE OR REPLACE FUNCTION public.trg_events_recalc_acct_del() RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE 
  rec RECORD;
  valuation_rec RECORD;
  v_is_custom_asset boolean;
  v_has_other_events boolean;
BEGIN
  -- 1. Recalcular posições diárias (lógica original)
  FOR rec IN
  SELECT user_id, account_id, asset_symbol,
  MIN((tstamp)::date) AS from_date,
  MAX((tstamp)::date) AS to_date
  FROM old_rows
  WHERE user_id IS NOT NULL AND account_id IS NOT NULL AND asset_symbol IS NOT NULL
  GROUP BY 1,2,3
  LOOP
  PERFORM public.fn_recalc_positions_acct(rec.user_id, rec.account_id, rec.asset_symbol, rec.from_date);
  END LOOP;

  -- 2. Lidar com custom asset valuations para eventos deletados
  FOR valuation_rec IN
  SELECT DISTINCT 
    user_id, 
    asset_symbol,
    (tstamp)::date AS event_date,
    kind,
    price_close,
    price_override
  FROM old_rows
  WHERE user_id IS NOT NULL 
    AND asset_symbol IS NOT NULL
    AND kind IN ('buy', 'position_add', 'valuation')
    AND (
      (kind = 'valuation' AND price_override IS NOT NULL AND price_override > 0) OR
      (kind IN ('buy', 'position_add') AND price_close IS NOT NULL AND price_close > 0)
    )
  LOOP
    -- Verificar se é um ativo personalizado (UUID)
    v_is_custom_asset := valuation_rec.asset_symbol ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    
    -- Só processar ativos customizados
    IF v_is_custom_asset THEN
      -- Verificar se ainda há outros eventos na mesma data que fornecem preço
      SELECT EXISTS(
        SELECT 1 FROM public.events e
        WHERE e.user_id = valuation_rec.user_id
          AND e.asset_symbol = valuation_rec.asset_symbol
          AND (e.tstamp)::date = valuation_rec.event_date
          AND (
            (e.kind = 'valuation' AND e.price_override IS NOT NULL AND e.price_override > 0) OR
            (e.kind IN ('buy', 'position_add') AND e.price_close IS NOT NULL AND e.price_close > 0)
          )
      ) INTO v_has_other_events;
      
      -- Se não há outros eventos na mesma data, deletar a valuation
      IF NOT v_has_other_events THEN
        DELETE FROM public.custom_asset_valuations
        WHERE asset_id = valuation_rec.asset_symbol::uuid 
          AND date = valuation_rec.event_date;
          
        RAISE NOTICE 'Custom valuation removed: asset_id=%, date=%', 
          valuation_rec.asset_symbol, valuation_rec.event_date;
      ELSE
        -- Se há outros eventos, recalcular o preço baseado no último evento restante
        UPDATE public.custom_asset_valuations
        SET value = (
          SELECT COALESCE(e.price_override, e.price_close)
          FROM public.events e
          WHERE e.user_id = valuation_rec.user_id
            AND e.asset_symbol = valuation_rec.asset_symbol
            AND (e.tstamp)::date = valuation_rec.event_date
            AND (
              (e.kind = 'valuation' AND e.price_override IS NOT NULL AND e.price_override > 0) OR
              (e.kind IN ('buy', 'position_add') AND e.price_close IS NOT NULL AND e.price_close > 0)
            )
          ORDER BY e.tstamp DESC
          LIMIT 1
        ),
        created_at = now()
        WHERE asset_id = valuation_rec.asset_symbol::uuid 
          AND date = valuation_rec.event_date;
          
        RAISE NOTICE 'Custom valuation recalculated: asset_id=%, date=%', 
          valuation_rec.asset_symbol, valuation_rec.event_date;
      END IF;
    END IF;
  END LOOP;

  RETURN NULL;
END$$;

ALTER FUNCTION public.trg_events_recalc_acct_del() OWNER TO postgres;

GRANT ALL ON FUNCTION public.trg_events_recalc_acct_del() TO supabase_admin;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct_del() TO anon;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct_del() TO authenticated;
GRANT ALL ON FUNCTION public.trg_events_recalc_acct_del() TO service_role;
