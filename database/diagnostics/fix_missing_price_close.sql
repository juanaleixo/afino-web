-- Script para identificar e corrigir eventos sem price_close
-- Execute este script para verificar e corrigir dados inconsistentes

-- 1. Identificar eventos que deveriam ter price_close mas não têm
SELECT 
  'EVENTOS SEM PRICE_CLOSE' as status,
  COUNT(*) as total_eventos_problemáticos,
  kind,
  COUNT(CASE WHEN asset_symbol ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 1 END) as custom_assets,
  COUNT(CASE WHEN asset_symbol !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN 1 END) as global_assets
FROM public.events 
WHERE kind IN ('buy', 'position_add') 
  AND price_close IS NULL
GROUP BY kind
ORDER BY total_eventos_problemáticos DESC;

-- 2. Mostrar alguns exemplos dos eventos problemáticos
SELECT 
  'EXEMPLOS DE EVENTOS PROBLEMÁTICOS' as info,
  id, user_id, kind, asset_symbol, tstamp, units_delta, price_close, price_override
FROM public.events 
WHERE kind IN ('buy', 'position_add') 
  AND price_close IS NULL
ORDER BY tstamp DESC
LIMIT 10;

-- 3. Tentar corrigir eventos que têm price_override mas não price_close
DO $$
DECLARE
  eventos_corrigidos INTEGER := 0;
BEGIN
  -- Corrigir eventos que têm price_override mas não price_close
  UPDATE public.events 
  SET price_close = price_override
  WHERE kind IN ('buy', 'position_add') 
    AND price_close IS NULL 
    AND price_override IS NOT NULL 
    AND price_override > 0;
  
  GET DIAGNOSTICS eventos_corrigidos = ROW_COUNT;
  
  IF eventos_corrigidos > 0 THEN
    RAISE NOTICE 'Corrigidos % eventos copiando price_override para price_close', eventos_corrigidos;
  ELSE
    RAISE NOTICE 'Nenhum evento foi corrigido automaticamente';
  END IF;
END $$;

-- 4. Para eventos que ainda estão sem preço, sugerir valores padrão baseados no histórico
WITH price_suggestions AS (
  SELECT 
    e.id,
    e.asset_symbol,
    e.tstamp,
    e.kind,
    -- Tentar encontrar preço mais próximo da data
    (CASE 
      WHEN e.asset_symbol ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
        -- Custom asset - buscar em custom_asset_valuations
        (SELECT cv.value 
         FROM public.custom_asset_valuations cv 
         WHERE cv.asset_id = e.asset_symbol::uuid 
           AND cv.date <= (e.tstamp)::date
         ORDER BY cv.date DESC 
         LIMIT 1)
      ELSE
        -- Global asset - buscar em global_price_daily
        (SELECT gpd.price 
         FROM public.global_price_daily gpd 
         WHERE gpd.asset_symbol = e.asset_symbol 
           AND gpd.date <= (e.tstamp)::date
         ORDER BY gpd.date DESC 
         LIMIT 1)
    END) as suggested_price
  FROM public.events e
  WHERE e.kind IN ('buy', 'position_add') 
    AND e.price_close IS NULL
)
SELECT 
  'SUGESTÕES DE PREÇOS PARA CORREÇÃO MANUAL' as info,
  ps.id,
  ps.asset_symbol,
  ps.tstamp,
  ps.kind,
  ps.suggested_price,
  CASE 
    WHEN ps.suggested_price IS NOT NULL THEN 
      'UPDATE public.events SET price_close = ' || ps.suggested_price || ' WHERE id = ''' || ps.id || ''';'
    ELSE 
      '-- Evento ' || ps.id || ': definir price_close manualmente (sem preço histórico encontrado)'
  END as sql_correção
FROM price_suggestions ps
ORDER BY ps.tstamp DESC
LIMIT 20;

-- 5. Verificar se ainda há eventos problemáticos após correções
SELECT 
  'STATUS FINAL' as status,
  COUNT(*) as eventos_ainda_problemáticos
FROM public.events 
WHERE kind IN ('buy', 'position_add') 
  AND price_close IS NULL;