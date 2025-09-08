-- Script para testar validações de eventos
-- Execute este script para verificar se as validações estão funcionando

-- Verificar se o trigger de validação existe
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_trigger 
      WHERE tgname = 't_events_validate_data' 
      AND tgrelid = (SELECT oid FROM pg_class WHERE relname = 'events')
    ) 
    THEN 'Trigger t_events_validate_data EXISTE ✓'
    ELSE 'Trigger t_events_validate_data NÃO EXISTE ✗'
  END as status_trigger;

-- Verificar se a função de validação existe
SELECT 
  CASE 
    WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'validate_event_data') 
    THEN 'Função validate_event_data EXISTE ✓'
    ELSE 'Função validate_event_data NÃO EXISTE ✗'
  END as status_funcao;

-- Testar validação com evento válido (deve funcionar)
DO $$
DECLARE
  test_user_id uuid := gen_random_uuid();
  test_account_id uuid := gen_random_uuid();
  test_asset_symbol text := 'PETR4';
BEGIN
  RAISE NOTICE 'Testando evento BUY válido...';
  
  -- Primeiro criar usuário e conta fictícios para o teste (se necessário)
  -- Este INSERT deve FUNCIONAR
  BEGIN
    INSERT INTO public.events (
      user_id, account_id, asset_symbol, tstamp, kind, units_delta, price_close
    ) VALUES (
      test_user_id, test_account_id, test_asset_symbol, now(), 'buy', 100, 25.50
    );
    RAISE NOTICE 'Evento BUY válido criado com sucesso ✓';
    
    -- Limpar teste
    DELETE FROM public.events WHERE user_id = test_user_id;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Erro inesperado ao criar evento válido: %', SQLERRM;
  END;
  
  RAISE NOTICE 'Testando evento BUY inválido (sem price_close)...';
  
  -- Este INSERT deve FALHAR
  BEGIN
    INSERT INTO public.events (
      user_id, account_id, asset_symbol, tstamp, kind, units_delta, price_close
    ) VALUES (
      test_user_id, test_account_id, test_asset_symbol, now(), 'buy', 100, NULL
    );
    RAISE NOTICE 'ERRO: Evento inválido foi aceito! ✗';
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Validação funcionou corretamente: %', SQLERRM;
  END;
  
  RAISE NOTICE 'Testando evento POSITION_ADD inválido (price_close negativo)...';
  
  -- Este INSERT deve FALHAR
  BEGIN
    INSERT INTO public.events (
      user_id, account_id, asset_symbol, tstamp, kind, units_delta, price_close
    ) VALUES (
      test_user_id, test_account_id, test_asset_symbol, now(), 'position_add', 50, -10.00
    );
    RAISE NOTICE 'ERRO: Evento com preço negativo foi aceito! ✗';
    
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Validação de preço negativo funcionou: %', SQLERRM;
  END;
  
END $$;

RAISE NOTICE 'Teste de validações concluído.';