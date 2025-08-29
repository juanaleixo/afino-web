# Setup Guide - Afino Hybrid Architecture

Este guia explica como configurar a arquitetura híbrida do Afino com Supabase + ClickHouse.

## 🏗️ Arquitetura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Supabase      │    │   ClickHouse    │
│   (Next.js)     │◄──►│  (PostgreSQL)   │◄──►│   (Analytics)   │
│                 │    │                 │    │                 │
│ • UI Components │    │ • Auth          │    │ • Portfolio     │
│ • State Mgmt    │    │ • Events        │    │ • Metrics       │
│ • Charts        │    │ • Users         │    │ • Charts Data   │
└─────────────────┘    │ • Real-time     │    │ • Performance   │
                       └─────────────────┘    └─────────────────┘
                              │                         ▲
                              │                         │
                              ▼                         │
                       ┌─────────────────┐             │
                       │ Event Processor │─────────────┘
                       │                 │
                       │ • Sync Events   │
                       │ • Cache Mgmt    │
                       │ • Retry Queue   │
                       └─────────────────┘
```

## 📋 Pré-requisitos

- Node.js 18+
- Conta no Supabase
- Conta no ClickHouse Cloud
- GitHub (para CI/CD)

## 🚀 Setup Passo a Passo

### 1. Configuração do Supabase

```bash
# 1. Criar projeto no Supabase
# 2. Executar migrações SQL
# 3. Configurar variáveis de ambiente
```

**SQL Migrations para Supabase:**
```sql
-- Tabela para fila de sincronização
CREATE TABLE sync_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW(),
  last_retry_at TIMESTAMP
);

-- Índices para performance
CREATE INDEX idx_sync_queue_operation ON sync_queue(operation);
CREATE INDEX idx_sync_queue_retry ON sync_queue(retry_count);

-- RLS (Row Level Security)
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;
```

### 2. Configuração do ClickHouse

```bash
# 1. Criar instância no ClickHouse Cloud
# 2. Executar schema inicial
clickhouse-client --queries-file database/clickhouse/schema.sql

# 3. Executar migration inicial
clickhouse-client --queries-file database/clickhouse/migrations/001_initial_schema.sql
```

### 3. Variáveis de Ambiente

```bash
# Copiar arquivo de exemplo
cp .env.example .env.local

# Preencher com suas credenciais
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua-chave-supabase
NEXT_PUBLIC_CLICKHOUSE_URL=https://seu-cluster.clickhouse.cloud:8443
NEXT_PUBLIC_CLICKHOUSE_USER=seu-usuario-clickhouse
NEXT_PUBLIC_CLICKHOUSE_PASSWORD=sua-senha-clickhouse
```

### 4. Instalação e Desenvolvimento

```bash
# Instalar dependências
npm install

# Adicionar cliente ClickHouse
npm install @clickhouse/client

# Executar em desenvolvimento
npm run dev
```

### 5. Sincronização Inicial

```bash
# Executar sincronização inicial (migrar dados existentes)
npm run sync:initial

# Ou via código:
node -e "
import { EventProcessor } from './src/lib/sync/event-processor'
EventProcessor.initialSync().then(() => console.log('Sync completa'))
"
```

## 🔧 Comandos Úteis

### Desenvolvimento
```bash
npm run dev              # Servidor de desenvolvimento
npm run build           # Build para produção
npm run test            # Executar testes
npm run lint            # Verificar código
npm run type-check      # Verificar tipos
```

### ClickHouse
```bash
# Conectar ao ClickHouse
clickhouse-client --host seu-host --user seu-usuario --password

# Verificar dados
SELECT count(*) FROM events_stream;
SELECT count(*) FROM portfolio_daily;

# Otimizar tabelas
OPTIMIZE TABLE events_stream FINAL;
OPTIMIZE TABLE portfolio_daily FINAL;
```

### Monitoring
```bash
# Verificar sync queue
SELECT operation, count(*) FROM sync_queue GROUP BY operation;

# Performance das queries
SELECT 
  query, 
  query_duration_ms, 
  memory_usage 
FROM system.query_log 
WHERE event_time > now() - INTERVAL 1 HOUR
ORDER BY query_duration_ms DESC;
```

## 📊 Monitoramento

### 1. Health Checks

```typescript
// Verificar conectividade ClickHouse
import { testClickHouseConnection } from './src/lib/clickhouse'

const isHealthy = await testClickHouseConnection()
console.log('ClickHouse status:', isHealthy ? 'OK' : 'ERROR')
```

### 2. Métricas Importantes

- **Latência das queries**: `portfolio_daily` deve responder < 200ms
- **Taxa de sync**: Eventos devem sincronizar em < 5s
- **Cache hit rate**: Deve ser > 80%
- **Retry queue**: Deve estar sempre < 100 items

### 3. Alertas Sugeridos

```bash
# ClickHouse queries lentas
SELECT count(*) FROM system.query_log 
WHERE query_duration_ms > 5000 
AND event_time > now() - INTERVAL 5 MINUTE;

# Fila de retry crescendo
SELECT count(*) FROM sync_queue 
WHERE created_at > now() - INTERVAL 1 HOUR;

# Falhas de conexão
grep "ClickHouse connection failed" /var/log/app.log
```

## 🚨 Troubleshooting

### ClickHouse não conecta
```bash
# Verificar conectividade
curl -H "X-ClickHouse-User: usuario" \
     -H "X-ClickHouse-Key: senha" \
     "https://host:8443/ping"

# Verificar certificados SSL
openssl s_client -connect host:8443 -servername host
```

### Dados desatualizados
```bash
# Forçar recálculo das Materialized Views
SYSTEM FLUSH LOGS;
SYSTEM RELOAD DICTIONARY assets_dict;
```

### Performance degradada
```sql
-- Verificar fragmentação das tabelas
SELECT 
  table,
  sum(rows) as total_rows,
  count() as parts_count,
  sum(bytes_on_disk) as size_bytes
FROM system.parts 
WHERE active 
GROUP BY table
ORDER BY parts_count DESC;

-- Otimizar se necessário
OPTIMIZE TABLE events_stream FINAL;
```

### Sync queue crescendo
```typescript
// Processar fila manualmente
import { EventProcessor } from './src/lib/sync/event-processor'
await EventProcessor.processRetryQueue()
```

## 📈 Otimizações de Performance

### 1. ClickHouse Tuning
```sql
-- Settings recomendados
SET max_memory_usage = 4000000000;  -- 4GB
SET max_execution_time = 30;        -- 30s
SET optimize_read_in_order = 1;
SET use_uncompressed_cache = 1;
```

### 2. Índices Adicionais
```sql
-- Para queries por usuário + período
ALTER TABLE portfolio_daily 
ADD INDEX idx_user_month (user_id, toYYYYMM(date)) 
TYPE bloom_filter(0.01) GRANULARITY 1;
```

### 3. Cache Strategies
```typescript
// Cache agressivo para dados históricos
const CACHE_SETTINGS = {
  portfolio_monthly: '1 hour',    // Dados mensais mudam pouco
  portfolio_daily: '5 minutes',   // Dados diários mais voláteis
  holdings_current: '1 minute'    // Holdings em tempo real
}
```

## 🔄 CI/CD Pipeline

```yaml
# .github/workflows/deploy.yml
name: Deploy Afino
on:
  push:
    branches: [main]
    
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run test
      - run: npm run build
      
  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Deploy to Cloudflare Pages
        uses: cloudflare/pages-action@1
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          projectName: afino-web
          directory: out
```

## 📚 Recursos Adicionais

- [Documentação ClickHouse](https://clickhouse.com/docs)
- [Guia Supabase](https://supabase.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Cloudflare Pages](https://pages.cloudflare.com/)

---

**Precisa de ajuda?** Abra uma issue no GitHub ou consulte os logs de aplicação para mais detalhes.