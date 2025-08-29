# ClickHouse Sync - Setup Simplificado

## 📋 Resumo da Arquitetura

Esta é a configuração **simplificada** para sincronização automática entre Supabase e ClickHouse:

- **Events** são sincronizados automaticamente via triggers HTTP
- **Preços** são sincronizados via batch diário (script)  
- **Posições** são calculadas automaticamente no ClickHouse (Materialized Views)
- **Sem sobrecarga** no Supabase (triggers leves)

## 🔧 1. Configurar Supabase

### Aplicar arquivos SQL na ordem:

```bash
# 1. Criar tabela da fila de retry
database/tables/sync_queue.sql

# 2. Criar índices
database/indexes/sync_queue_indexes.sql

# 3. Criar funções
database/functions/sync_events_to_clickhouse.sql
database/functions/process_sync_queue.sql
database/functions/sync_queue_stats.sql

# 4. Criar triggers
database/triggers/t_events_sync_clickhouse.sql
database/triggers/t_global_assets_sync_clickhouse.sql

# 5. Aplicar RLS
database/rls/sync_queue_rls.sql
```

### Configurar variáveis de ambiente:

Execute no SQL Editor do Supabase Dashboard:

```sql
-- Configurar URL do webhook ClickHouse
ALTER DATABASE postgres SET app.clickhouse_sync_url = 'https://your-project.supabase.co/functions/v1/clickhouse-sync';

-- Configurar token de autenticação
ALTER DATABASE postgres SET app.clickhouse_sync_token = 'your-secret-token';
```

## 🚀 2. Deploy Edge Function

```bash
# Deploy da função de sincronização
supabase functions deploy clickhouse-sync
```

## 🏗️ 3. Configurar ClickHouse

```bash
# Aplicar schema simplificado
npm run clickhouse:migrate
```

## ⏰ 4. Configurar Sync de Preços

### Opção A: Cron Job Manual
```bash
# Adicionar ao seu cron
0 6 * * * cd /path/to/project && npm run sync:prices
```

### Opção B: Supabase Cron (pg_cron)
```sql
-- No Supabase SQL Editor (se pg_cron estiver habilitado)
SELECT cron.schedule('daily-price-sync', '0 6 * * *', 'SELECT process_sync_queue();');
```

## 📊 5. Monitoramento

### Verificar status da sincronização:
```sql
-- Ver estatísticas da fila
SELECT * FROM sync_queue_stats();

-- Ver registros com falha
SELECT * FROM sync_queue WHERE status = 'failed';

-- Processar fila manualmente
SELECT * FROM process_sync_queue();
```

### Scripts de monitoramento:
```bash
# Verificar conectividade ClickHouse
npm run clickhouse:health

# Sync manual de preços
npm run sync:prices
npm run sync:prices:yesterday
```

## 🔄 6. Fluxo de Dados

```
┌─────────────────┐    HTTP Trigger    ┌──────────────────┐
│   Events        │ ─────────────────→ │   ClickHouse     │
│   (Supabase)    │                    │   events_stream  │
└─────────────────┘                    └──────────────────┘
                                              │
                                              ▼
                                    ┌──────────────────┐
                                    │ Materialized     │
                                    │ View             │
                                    │ (Auto-calculate) │
                                    └──────────────────┘
                                              │
                                              ▼
┌─────────────────┐    Batch Daily     ┌──────────────────┐
│   External APIs │ ─────────────────→ │   daily_prices   │
│   (Prices)      │                    │   (ClickHouse)   │
└─────────────────┘                    └──────────────────┘
                                              │
                                              ▼
                                    ┌──────────────────┐
                                    │ daily_positions  │
                                    │ (Calculated)     │
                                    └──────────────────┘
```

## ✅ 7. Verificar Funcionamento

1. **Teste de Event Sync:**
   ```sql
   -- No Supabase, criar um evento de teste
   INSERT INTO events (user_id, asset_id, kind, units_delta, tstamp) 
   VALUES ('test-user', 'TEST', 'buy', 10, now());
   ```

2. **Verificar no ClickHouse:**
   ```sql
   -- Deve aparecer em events_stream
   SELECT * FROM events_stream WHERE asset_id = 'TEST';
   ```

3. **Teste de Price Sync:**
   ```bash
   # Executar sync de preços
   npm run sync:prices
   ```

4. **Verificar cálculos:**
   ```sql
   -- Posições devem ser calculadas automaticamente
   SELECT * FROM v_portfolio_daily WHERE user_id = 'test-user';
   ```

## 🚨 Troubleshooting

### Problema: Events não sincronizam
```sql
-- Verificar fila de retry
SELECT * FROM sync_queue WHERE table_name = 'events';

-- Processar fila manualmente
SELECT * FROM process_sync_queue();
```

### Problema: Preços desatualizados
```bash
# Re-executar sync de preços
npm run sync:prices
```

### Problema: Materialized Views não atualizam
```sql
-- No ClickHouse, verificar se MVs existem
SHOW TABLES LIKE '%_mv';

-- Recriar se necessário
DROP VIEW daily_positions_auto_mv;
-- Re-aplicar enhanced_schema.sql
```

---

**✨ Pronto!** Sua arquitetura simplificada está configurada e rodando.