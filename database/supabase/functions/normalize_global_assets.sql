-- Function + Trigger: Normaliza símbolos e rótulos em global_assets

CREATE OR REPLACE FUNCTION public.trg_normalize_global_assets() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Normalizar símbolo em caixa alta para classes com símbolo padronizado
  IF NEW.class IN ('crypto','stock','fund','commodity','cash','currency') THEN
    NEW.symbol := upper(NEW.symbol);
  END IF;

  -- Label PT-BR: se não informado, tenta preencher a partir de símbolo/classe
  IF NEW.label_ptbr IS NULL OR btrim(NEW.label_ptbr) = '' THEN
    IF NEW.class = 'cash' OR (NEW.class = 'currency' AND NEW.symbol IN ('BRL','USD','EUR')) THEN
      NEW.label_ptbr := CASE NEW.symbol
        WHEN 'BRL' THEN 'Real Brasileiro'
        WHEN 'USD' THEN 'Dólar Americano'
        WHEN 'EUR' THEN 'Euro'
        ELSE 'Dinheiro'
      END;
    ELSIF NEW.class = 'crypto' THEN
      NEW.label_ptbr := CASE NEW.symbol
        WHEN 'BTC' THEN 'Bitcoin'
        WHEN 'ETH' THEN 'Ethereum'
        ELSE NEW.symbol
      END;
    ELSE
      NEW.label_ptbr := NEW.symbol; -- fallback
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$ BEGIN
  CREATE TRIGGER t_normalize_global_assets_biub
    BEFORE INSERT OR UPDATE ON public.global_assets
    FOR EACH ROW EXECUTE FUNCTION public.trg_normalize_global_assets();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

