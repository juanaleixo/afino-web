-- Script para testar manualmente a atualização de preços
-- Execute este script para testar se a função funciona corretamente

-- Mostrar informações antes da execução
SELECT 
  'ANTES DO REFRESH' as status,
  COUNT(*) as total_assets,
  COUNT(CASE WHEN class = 'crypto' THEN 1 END) as crypto_assets,
  COUNT(CASE WHEN class = 'stock' THEN 1 END) as stock_assets
FROM public.global_assets;

-- Mostrar últimas atualizações de preços (se houver)
SELECT 
  'ÚLTIMOS PREÇOS ATUALIZADOS' as info,
  COUNT(*) as total_price_records,
  MAX(date_created) as last_update
FROM public.global_price_daily 
WHERE date_created > NOW() - INTERVAL '7 days';

-- Executar a função de refresh
SELECT 'EXECUTANDO REFRESH...' as status;

-- Chamar a função
SELECT public.refresh_all_asset_prices();

SELECT 'REFRESH CONCLUÍDO ✓' as status;

-- Mostrar informações após a execução
SELECT 
  'APÓS REFRESH' as status,
  COUNT(*) as total_price_records,
  MAX(date_created) as last_update,
  COUNT(DISTINCT asset_id) as assets_with_prices
FROM public.global_price_daily 
WHERE date_created > NOW() - INTERVAL '1 hour';

-- Mostrar alguns exemplos de preços atualizados recentemente
SELECT 
  ga.symbol,
  ga.class,
  gpd.price,
  gpd.date_created
FROM public.global_price_daily gpd
JOIN public.global_assets ga ON ga.id = gpd.asset_id
WHERE gpd.date_created > NOW() - INTERVAL '1 hour'
ORDER BY gpd.date_created DESC
LIMIT 10;