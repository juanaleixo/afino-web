-- Script para verificar e corrigir estrutura da tabela global_assets
-- Execute este script para diagnosticar problemas com a tabela

-- 1. Verificar se a tabela existe
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'global_assets')
    THEN 'Tabela global_assets EXISTE ✓'
    ELSE 'Tabela global_assets NÃO EXISTE ✗'
  END as status_tabela;

-- 2. Listar todas as colunas da tabela
SELECT 
  'COLUNAS DA TABELA global_assets' as info,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' AND table_name = 'global_assets'
ORDER BY ordinal_position;

-- 3. Verificar se a coluna id existe especificamente
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' AND table_name = 'global_assets' AND column_name = 'id'
    )
    THEN 'Coluna id EXISTE ✓'
    ELSE 'Coluna id NÃO EXISTE ✗ - PROBLEMA ENCONTRADO!'
  END as status_coluna_id;

-- 4. Verificar primary key
SELECT 
  'PRIMARY KEY' as info,
  constraint_name,
  column_name
FROM information_schema.key_column_usage kcu
JOIN information_schema.table_constraints tc ON tc.constraint_name = kcu.constraint_name
WHERE tc.table_schema = 'public' 
  AND tc.table_name = 'global_assets'
  AND tc.constraint_type = 'PRIMARY KEY';

-- 5. Contar registros na tabela
SELECT 
  'DADOS NA TABELA' as info,
  COUNT(*) as total_registros
FROM public.global_assets;

-- 6. Mostrar alguns registros de exemplo
SELECT 
  'EXEMPLOS DE DADOS' as info,
  symbol,
  class,
  currency,
  created_at
FROM public.global_assets
ORDER BY created_at DESC
LIMIT 5;

-- 7. Verificar se há problema de permissões ou schema
DO $$
BEGIN
  -- Tentar fazer um SELECT simples
  PERFORM symbol FROM public.global_assets LIMIT 1;
  RAISE NOTICE 'Acesso à tabela global_assets: OK ✓';
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'ERRO: Tabela global_assets não encontrada ✗';
  WHEN undefined_column THEN
    RAISE NOTICE 'ERRO: Problema com colunas da tabela ✗';
  WHEN OTHERS THEN
    RAISE NOTICE 'ERRO: Problema de acesso: %', SQLERRM;
END $$;