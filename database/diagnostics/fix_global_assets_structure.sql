-- Script para corrigir estrutura da tabela global_assets se necessário
-- Execute este script apenas se o diagnóstico mostrar problemas

DO $$
DECLARE
  has_id_column boolean := false;
  table_exists boolean := false;
BEGIN
  -- Verificar se tabela existe
  SELECT EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE schemaname = 'public' AND tablename = 'global_assets'
  ) INTO table_exists;
  
  IF NOT table_exists THEN
    RAISE NOTICE 'Tabela global_assets não existe - criando...';
    
    -- Criar tabela completa
    CREATE TABLE public.global_assets (
      id uuid DEFAULT gen_random_uuid() NOT NULL,
      symbol text NOT NULL,
      class text NOT NULL,
      currency text NOT NULL,
      meta jsonb,
      created_at timestamp with time zone DEFAULT now(),
      manual_price numeric,
      label_ptbr text,
      CONSTRAINT global_assets_class_check CHECK (class = ANY (ARRAY[
        'currency'::text, 
        'cash'::text,
        'stock'::text, 
        'crypto'::text, 
        'fund'::text,
        'commodity'::text,
        'bond'::text,
        'reit'::text,
        'real_estate'::text,
        'vehicle'::text
      ]))
    );
    
    ALTER TABLE public.global_assets ADD CONSTRAINT global_assets_pkey PRIMARY KEY (id);
    
    -- Index único para symbol/class
    CREATE UNIQUE INDEX IF NOT EXISTS ux_global_assets_symbol_ci_class
      ON public.global_assets (lower(symbol), class);
      
    RAISE NOTICE 'Tabela global_assets criada com sucesso ✓';
    RETURN;
  END IF;
  
  -- Verificar se coluna id existe
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'global_assets' AND column_name = 'id'
  ) INTO has_id_column;
  
  IF NOT has_id_column THEN
    RAISE NOTICE 'Coluna id não existe - adicionando...';
    
    -- Adicionar coluna id
    ALTER TABLE public.global_assets ADD COLUMN id uuid DEFAULT gen_random_uuid();
    
    -- Preencher IDs para registros existentes
    UPDATE public.global_assets SET id = gen_random_uuid() WHERE id IS NULL;
    
    -- Tornar coluna NOT NULL
    ALTER TABLE public.global_assets ALTER COLUMN id SET NOT NULL;
    
    -- Verificar se já tem primary key
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints 
      WHERE table_schema = 'public' AND table_name = 'global_assets' 
      AND constraint_type = 'PRIMARY KEY'
    ) THEN
      ALTER TABLE public.global_assets ADD CONSTRAINT global_assets_pkey PRIMARY KEY (id);
    END IF;
    
    RAISE NOTICE 'Coluna id adicionada com sucesso ✓';
  ELSE
    RAISE NOTICE 'Coluna id já existe ✓';
  END IF;
  
  -- Verificar outras colunas essenciais
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'global_assets' AND column_name = 'created_at'
  ) THEN
    ALTER TABLE public.global_assets ADD COLUMN created_at timestamp with time zone DEFAULT now();
    RAISE NOTICE 'Coluna created_at adicionada ✓';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'global_assets' AND column_name = 'manual_price'
  ) THEN
    ALTER TABLE public.global_assets ADD COLUMN manual_price numeric;
    RAISE NOTICE 'Coluna manual_price adicionada ✓';
  END IF;
  
  -- Criar index único se não existir
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'ux_global_assets_symbol_ci_class') THEN
    CREATE UNIQUE INDEX ux_global_assets_symbol_ci_class
      ON public.global_assets (lower(symbol), class);
    RAISE NOTICE 'Index único criado ✓';
  END IF;
  
  RAISE NOTICE 'Estrutura da tabela global_assets verificada e corrigida ✓';
  
END $$;