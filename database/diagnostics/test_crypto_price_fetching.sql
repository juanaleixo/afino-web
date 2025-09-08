-- Script para testar a função fetch_price_crypto_history melhorada
-- Execute este script para testar a busca de preços crypto com BRL e ponte USDT

-- Mostrar status antes dos testes
SELECT 
  'ANTES DOS TESTES' as status,
  COUNT(*) as total_crypto_assets,
  COUNT(CASE WHEN currency = 'BRL' THEN 1 END) as brl_assets
FROM public.global_assets 
WHERE class = 'crypto';

-- Testar crypto populares que DEVEM ter par direto BRL
RAISE NOTICE '=== TESTANDO CRYPTOS POPULARES (PAR DIRETO BRL) ===';

-- Bitcoin
SELECT public.fetch_price_crypto_history('BTC', 'crypto', 'BRL');

-- Ethereum  
SELECT public.fetch_price_crypto_history('ETH', 'crypto', 'BRL');

-- Verificar se os preços foram inseridos
SELECT 
  'PREÇOS BITCOIN' as info,
  COUNT(*) as registros_btc,
  MIN(date) as primeira_data,
  MAX(date) as ultima_data,
  MAX(price) as maior_preco,
  MIN(price) as menor_preco
FROM public.global_price_daily 
WHERE asset_symbol = 'BTC';

SELECT 
  'PREÇOS ETHEREUM' as info,
  COUNT(*) as registros_eth,
  MIN(date) as primeira_data,
  MAX(date) as ultima_data,
  MAX(price) as maior_preco,
  MIN(price) as menor_preco
FROM public.global_price_daily 
WHERE asset_symbol = 'ETH';

-- Testar crypto menos popular que PODE precisar de ponte USDT
RAISE NOTICE '=== TESTANDO CRYPTO QUE PODE PRECISAR PONTE USDT ===';

-- Cardano (pode não ter par direto ADA/BRL)
SELECT public.fetch_price_crypto_history('ADA', 'crypto', 'BRL');

-- Verificar resultado
SELECT 
  'PREÇOS CARDANO' as info,
  COUNT(*) as registros_ada,
  MIN(date) as primeira_data,
  MAX(date) as ultima_data,
  MAX(price) as maior_preco,
  MIN(price) as menor_preco
FROM public.global_price_daily 
WHERE asset_symbol = 'ADA';

-- Testar crypto muito obscura (deve usar ponte USDT)
RAISE NOTICE '=== TESTANDO CRYPTO OBSCURA (DEVE USAR PONTE USDT) ===';

-- Tentar uma crypto menos conhecida
SELECT public.fetch_price_crypto_history('MATIC', 'crypto', 'BRL');

SELECT 
  'PREÇOS MATIC' as info,
  COUNT(*) as registros_matic,
  MIN(date) as primeira_data,
  MAX(date) as ultima_data,
  MAX(price) as maior_preco,
  MIN(price) as menor_preco
FROM public.global_price_daily 
WHERE asset_symbol = 'MATIC';

-- Resumo final
SELECT 
  'RESUMO FINAL' as status,
  asset_symbol,
  COUNT(*) as total_registros,
  MIN(date) as primeira_data,
  MAX(date) as ultima_data,
  ROUND(AVG(price), 2) as preco_medio,
  MAX(price) as preco_maximo
FROM public.global_price_daily 
WHERE asset_symbol IN ('BTC', 'ETH', 'ADA', 'MATIC')
GROUP BY asset_symbol
ORDER BY total_registros DESC;

-- Verificar assets criados
SELECT 
  'ASSETS CRYPTO CRIADOS' as info,
  symbol,
  class,
  currency,
  created_at
FROM public.global_assets 
WHERE class = 'crypto' AND currency = 'BRL'
ORDER BY created_at DESC;