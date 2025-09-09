# Database Cleanup Scripts

Este diretório contém scripts para limpar a estrutura antiga do banco de dados após a simplificação do sistema de assinatura.

## Scripts Disponíveis

### 1. `drop_removed_tables.sql`
Remove todas as tabelas, índices, funções e objetos que foram eliminados durante a simplificação:

- ❌ `public.subscriptions` (duplicada)
- ❌ `public.subscription_plans` (redundante) 
- ❌ `pay.subscription_plans` (redundante)
- ❌ `pay.customers` (dados duplicados)
- ❌ `public.stripe_webhook_events` (nome antigo)
- ❌ Funções/triggers obsoletos
- ❌ Índices órfãos
- ❌ Colunas antigas (`is_premium`, `plan`, etc.)

### 2. `recreate_functions_triggers.sql`
Recria as funções e triggers corretos após o cleanup:

- ✅ `update_user_premium_status()` (versão corrigida)
- ✅ `is_user_premium()` (versão corrigida)  
- ✅ Trigger `trigger_update_user_premium_status`

## Como Usar

### Para ambientes existentes (com estrutura antiga):

```sql
-- 1. Execute o cleanup (remove estrutura antiga)
\i database/cleanup/drop_removed_tables.sql

-- 2. Recrie as funções corretas
\i database/cleanup/recreate_functions_triggers.sql

-- 3. Execute as estruturas atuais
\i database/tables/user_profiles.sql
\i database/tables/pay/subscriptions.sql  
\i database/tables/pay/webhook_events.sql
\i database/functions/update_user_premium_status.sql
\i database/triggers/update_user_premium_status.sql
```

### Para ambientes novos:
Apenas execute as estruturas atuais diretamente (não precisa do cleanup).

## Estrutura Final Simplificada

Após executar os scripts, você terá apenas:

```
📊 TABELAS FINAIS:
├── auth.users (Supabase managed)
├── public.user_profiles (só usuarios premium)
├── pay.subscriptions (referencias auth.users)
└── pay.webhook_events (eventos Stripe)

🔧 LÓGICA:
- Sem user_profiles = usuário FREE
- Com user_profiles = usuário PREMIUM
- Subscriptions sempre referencia auth.users
```

## ⚠️ Importante

- Execute `drop_removed_tables.sql` apenas UMA vez
- Faça backup antes de executar em produção
- Os scripts são idempotentes (seguros para re-execução)