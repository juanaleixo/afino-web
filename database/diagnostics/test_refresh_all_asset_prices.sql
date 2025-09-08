-- Script para testar a função refresh_all_asset_prices após correções
-- Execute este script para verificar se a função funciona corretamente

-- 1. Verificar estrutura da tabela antes
SELECT 
  'ESTRUTURA ATUAL DA TABELA' as info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'global_assets'
ORDER BY ordinal_position;

-- 2. Mostrar assets existentes antes
SELECT 
  'ASSETS ANTES DO REFRESH' as info,
  COUNT(*) as total_assets,
  COUNT(CASE WHEN class = 'crypto' THEN 1 END) as crypto_count,
  COUNT(CASE WHEN class = 'stock' THEN 1 END) as stock_count
FROM public.global_assets;

-- 3. Mostrar alguns exemplos
SELECT 
  'EXEMPLOS DE ASSETS' as info,
  symbol,
  class,
  currency,
  created_at
FROM public.global_assets
ORDER BY created_at DESC
LIMIT 10;

-- 4. Verificar preços existentes antes
SELECT 
  'PREÇOS ANTES DO REFRESH' as info,
  COUNT(*) as total_price_records,
  COUNT(DISTINCT asset_symbol) as assets_com_preco,
  MAX(date_created) as ultimo_preco_inserido
FROM public.global_price_daily
WHERE date_created > NOW() - INTERVAL '7 days';

-- 5. Executar a função de refresh
RAISE NOTICE '=== EXECUTANDO REFRESH_ALL_ASSET_PRICES ===';

-- Tentar executar a função
DO $$
BEGIN
  PERFORM public.refresh_all_asset_prices();
  RAISE NOTICE 'Função refresh_all_asset_prices executada com sucesso ✓';
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'ERRO ao executar refresh_all_asset_prices: %', SQLERRM;
END $$;

-- 6. Verificar resultados após o refresh
SELECT 
  'PREÇOS APÓS REFRESH' as info,
  COUNT(*) as total_price_records,
  COUNT(DISTINCT asset_symbol) as assets_com_preco,
  MAX(date_created) as ultimo_preco_inserido,
  COUNT(CASE WHEN date_created > NOW() - INTERVAL '1 hour' THEN 1 END) as precos_recentes
FROM public.global_price_daily;

-- 7. Mostrar estatísticas por tipo de asset
SELECT 
  'ESTATÍSTICAS POR CLASSE' as info,
  ga.class,
  COUNT(DISTINCT ga.symbol) as total_assets,
  COUNT(DISTINCT gpd.asset_symbol) as assets_com_precos,
  MAX(gpd.date_created) as ultimo_preco
FROM public.global_assets ga
LEFT JOIN public.global_price_daily gpd ON gpd.asset_symbol = ga.symbol
GROUP BY ga.class
ORDER BY total_assets DESC;

-- 8. Mostrar exemplos de preços atualizados recentemente
SELECT 
  'PREÇOS RECENTES' as info,
  asset_symbol,
  price,
  date_created,
  (SELECT class FROM public.global_assets WHERE symbol = asset_symbol LIMIT 1) as asset_class
FROM public.global_price_daily 
WHERE date_created > NOW() - INTERVAL '2 hours'
ORDER BY date_created DESC
LIMIT 10;

-- 9. Verificar se há erros ou assets sem preços
SELECT 
  'ASSETS SEM PREÇOS' as info,
  ga.symbol,
  ga.class,
  ga.currency,
  CASE 
    WHEN gpd.asset_symbol IS NULL THEN 'SEM PREÇOS'
    ELSE 'COM PREÇOS'
  END as status_preco
FROM public.global_assets ga
LEFT JOIN public.global_price_daily gpd ON gpd.asset_symbol = ga.symbol
WHERE ga.class IN ('crypto', 'stock')
ORDER BY ga.class, ga.symbol;