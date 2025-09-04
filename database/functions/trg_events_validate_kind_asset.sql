-- Function: Validate event kind vs asset class

CREATE OR REPLACE FUNCTION public.trg_events_validate_kind_asset()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_class text;
  v_symbol text;
BEGIN
  SELECT ga.class, ga.symbol INTO v_class, v_symbol
  FROM public.global_assets ga WHERE ga.symbol = COALESCE(NEW.asset_symbol, OLD.asset_symbol);

  IF v_class IS NULL THEN
    RAISE EXCEPTION 'Ativo % não encontrado', COALESCE(NEW.asset_symbol, OLD.asset_symbol);
  END IF;

  -- Regras:
  -- Caixa (class='currency' ou símbolo BRL/CASH): somente deposito/saque/transfer
  IF v_class = 'currency' OR upper(coalesce(v_symbol,'')) IN ('BRL','CASH') THEN
    IF NEW.kind IN ('buy','sell','valuation') THEN
      RAISE EXCEPTION 'Evento % não permitido para ativo de Caixa (%). Use depósito/saque/transferência.', NEW.kind, v_symbol;
    END IF;
  ELSE
    -- Ativos variáveis: não permitir deposito/saque (usar buy/sell ou transfer/valuation)
    IF NEW.kind IN ('deposit','withdraw') THEN
      RAISE EXCEPTION 'Evento % não permitido para ativo não-caixa (%). Use compra/venda/transferência/avaliação.', NEW.kind, v_symbol;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

ALTER FUNCTION public.trg_events_validate_kind_asset() OWNER TO postgres;

GRANT ALL ON FUNCTION public.trg_events_validate_kind_asset() TO supabase_admin;
GRANT ALL ON FUNCTION public.trg_events_validate_kind_asset() TO service_role;
