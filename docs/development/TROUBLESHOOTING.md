# Guia de Solução de Problemas - Afino Finance

## 🚨 Erros Comuns e Soluções

### 1. **Erro: "relation \"public.assets\" does not exist"**

**Causa**: As tabelas base não foram criadas no banco de dados.

**Solução**:
1. Execute o arquivo `database/complete_setup.sql` no SQL Editor do Supabase
2. Verifique se todas as tabelas foram criadas:
```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```

### 2. **Erro: "function does not exist"**

**Causa**: As funções RPC não foram criadas.

**Solução**:
1. Execute novamente o `database/complete_setup.sql`
2. Verifique se as funções existem:
```sql
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name LIKE 'api_%';
```

### 3. **Erro: "permission denied"**

**Causa**: Políticas RLS não configuradas ou usuário não autenticado.

**Solução**:
1. Verifique se o RLS está ativo:
```sql
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

2. Confirme que o usuário está autenticado:
```sql
SELECT auth.uid();
```

### 4. **Erro: "column does not exist"**

**Causa**: Estrutura da tabela diferente do esperado.

**Solução**:
1. Verifique a estrutura da tabela:
```sql
\d public.assets
\d public.events
\d public.accounts
```

2. Se necessário, recrie as tabelas:
```sql
DROP TABLE IF EXISTS public.events CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;
DROP TABLE IF EXISTS public.assets CASCADE;
-- Execute novamente o complete_setup.sql
```

### 5. **Dados não aparecem no frontend**

**Causa**: Não há dados nas tabelas ou funções RPC não retornam dados.

**Solução**:
1. Verifique se há dados:
```sql
SELECT COUNT(*) FROM assets;
SELECT COUNT(*) FROM events WHERE user_id = auth.uid();
SELECT COUNT(*) FROM daily_positions_acct WHERE user_id = auth.uid();
```

2. Insira dados de teste:
```sql
-- Execute o database/test_data.sql
```

### 6. **Erro: "auth.uid() returns null"**

**Causa**: Usuário não está autenticado no Supabase.

**Solução**:
1. Verifique se está logado no frontend
2. Teste a autenticação:
```sql
SELECT auth.uid() as current_user;
```

### 7. **Erro: "foreign key constraint"**

**Causa**: Tentativa de inserir dados com referências inválidas.

**Solução**:
1. Verifique se os IDs existem:
```sql
SELECT id FROM assets WHERE symbol = 'PETR4';
SELECT id FROM accounts WHERE user_id = auth.uid();
```

2. Insira os dados na ordem correta:
   - Primeiro: assets
   - Segundo: accounts
   - Terceiro: events

## 🔧 Comandos Úteis de Diagnóstico

### Verificar Estrutura do Banco
```sql
-- Listar todas as tabelas
SELECT tablename FROM pg_tables WHERE schemaname = 'public';

-- Verificar estrutura de uma tabela
\d public.assets

-- Verificar políticas RLS
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';
```

### Verificar Dados
```sql
-- Contar registros em cada tabela
SELECT 'assets' as table_name, COUNT(*) as count FROM assets
UNION ALL
SELECT 'accounts', COUNT(*) FROM accounts
UNION ALL
SELECT 'events', COUNT(*) FROM events
UNION ALL
SELECT 'user_profiles', COUNT(*) FROM user_profiles;

-- Verificar dados do usuário atual
SELECT * FROM accounts WHERE user_id = auth.uid();
SELECT * FROM events WHERE user_id = auth.uid();
SELECT * FROM user_profiles WHERE user_id = auth.uid();
```

### Testar Funções RPC
```sql
-- Testar função básica
SELECT app_current_user();

-- Testar holdings
SELECT * FROM api_holdings_at(current_date);

-- Testar série mensal
SELECT * FROM api_portfolio_monthly(
  date_trunc('month', current_date - interval '6 months')::date,
  current_date
);
```

## 🚀 Processo de Setup Completo

### Passo 1: Setup Inicial
```sql
-- Execute no SQL Editor do Supabase
-- Conteúdo do arquivo: database/complete_setup.sql
```

### Passo 2: Verificar Setup
```sql
-- Verificar se tudo foi criado
SELECT 'Tabelas:' as type, COUNT(*) as count FROM pg_tables WHERE schemaname = 'public'
UNION ALL
SELECT 'Funções RPC:', COUNT(*) FROM information_schema.routines 
WHERE routine_schema = 'public' AND routine_name LIKE 'api_%';
```

### Passo 3: Inserir Dados de Teste
```sql
-- Execute no SQL Editor do Supabase
-- Conteúdo do arquivo: database/test_data.sql
```

### Passo 4: Testar Frontend
1. Acesse o dashboard
2. Vá para a página do portfólio
3. Verifique se os dados aparecem

## 📞 Suporte Adicional

Se os problemas persistirem:

1. **Verifique os logs do Supabase**:
   - Vá para Dashboard > Logs
   - Procure por erros relacionados às funções RPC

2. **Teste as funções individualmente**:
   - Execute cada função RPC separadamente
   - Verifique os parâmetros e retornos

3. **Verifique a autenticação**:
   - Confirme que o usuário está logado
   - Teste `auth.uid()` no SQL Editor

4. **Recrie o banco se necessário**:
   ```sql
   -- CUIDADO: Isso apaga todos os dados
   DROP SCHEMA public CASCADE;
   CREATE SCHEMA public;
   -- Execute novamente o complete_setup.sql
   ```

---

**Dica**: Sempre execute os scripts na ordem correta:
1. `complete_setup.sql` (setup completo)
2. `test_data.sql` (dados de teste, opcional)
3. Teste as funções RPC
4. Teste o frontend 