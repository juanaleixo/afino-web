# Database Structure - Afino

## 📁 Estrutura Organizada

A estrutura do banco foi reorganizada para separar claramente os componentes de cada sistema:

```
database/
├── supabase/                    # 🟢 PostgreSQL (Supabase)
│   ├── 00_extensions.sql        # Extensões necessárias
│   ├── tables/                  # Definições de tabelas
│   ├── indexes/                 # Índices de performance
│   ├── functions/               # Funções PL/pgSQL
│   ├── triggers/                # Triggers automáticos
│   ├── rls/                     # Row Level Security policies
│   ├── views/                   # Views materializadas e normais
│   ├── migrations/              # Migrações de dados
│   ├── tests/                   # Testes de banco
│   ├── current_schema_analysis.sql
│   ├── triggers.sql            # ⚠️ Arquivo legado (ver CLICKHOUSE_SYNC_SETUP.md)
│   └── CLICKHOUSE_SYNC_SETUP.md # 📚 Guia de configuração
│
└── clickhouse/                 # 🟡 ClickHouse (Analytics)
    ├── schema.sql               # Schema principal original
    ├── enhanced_schema.sql      # Schema simplificado otimizado
    └── migrations/              # Migrações ClickHouse
        └── 001_initial_schema.sql
```

## 🎯 Responsabilidades

### 🟢 **Supabase (PostgreSQL)**
- **Transações** (OLTP)
- **Autenticação** e autorização
- **Real-time** subscriptions
- **Row Level Security**
- **Triggers** para sincronização
- **Source of truth** para events

### 🟡 **ClickHouse**
- **Analytics** (OLAP)
- **Preços** centralizados
- **Posições** calculadas automaticamente
- **Gráficos** e relatórios
- **Performance** otimizada para consultas

## 🚀 Setup Rápido

### 1. Supabase Setup
```bash
# Aplicar na ordem:
database/supabase/00_extensions.sql
database/supabase/tables/*
database/supabase/indexes/*
database/supabase/functions/*
database/supabase/triggers/*
database/supabase/rls/*
database/supabase/views/*
```

### 2. ClickHouse Setup
```bash
# Aplicar schema otimizado
npm run clickhouse:migrate
# ou manualmente:
clickhouse-client --queries-file database/clickhouse/enhanced_schema.sql
```

### 3. Sincronização
Seguir o guia em `supabase/CLICKHOUSE_SYNC_SETUP.md`

## 📊 Fluxo de Dados

```
┌─────────────────┐    Real-time     ┌──────────────────┐
│   Supabase      │ ──────────────→  │   ClickHouse     │
│   (PostgreSQL)  │    Webhooks      │   (Analytics)    │
│                 │                  │                  │
│ ✓ Events        │ ──────────────→  │ ✓ events_stream  │
│ ✓ Assets        │                  │ ✓ daily_prices   │
│ ✓ Users         │                  │ ✓ daily_positions│
│ ✓ Auth          │                  │ ✓ Views/MVs      │
└─────────────────┘                  └──────────────────┘
```

## 🛠️ Scripts NPM

```bash
# ClickHouse
npm run clickhouse:migrate    # Aplicar schema
npm run clickhouse:health     # Verificar conectividade

# Sincronização
npm run sync:prices          # Sync preços hoje
npm run sync:initial         # Migração inicial

# Desenvolvimento
npm run dev                  # Servidor de desenvolvimento
npm run build               # Build produção
npm run test                # Testes
```

## 📝 Convenções

### Nomes de Arquivos
- **Supabase**: `snake_case.sql`
- **ClickHouse**: `snake_case.sql`
- **Triggers**: `t_[table]_[action].sql`
- **Functions**: `[verb]_[object].sql`
- **RLS**: `[table]_rls.sql`

### Ordem de Aplicação
1. **Extensions** (`00_extensions.sql`)
2. **Tables** (todas as tabelas)
3. **Indexes** (índices de performance)
4. **Functions** (funções de negócio)
5. **Triggers** (automação)
6. **RLS** (segurança)
7. **Views** (consultas)

## 🔍 Troubleshooting

### Erro de Dependências
Se houver erro de dependências entre funções/triggers:
```sql
-- Remover dependências
DROP TRIGGER IF EXISTS trigger_name ON table_name;
DROP FUNCTION IF EXISTS function_name();

-- Recriar na ordem correta
-- functions/ primeiro, depois triggers/
```

### Verificar Sincronização
```sql
-- No Supabase
SELECT * FROM sync_queue_stats();

-- No ClickHouse  
SELECT COUNT(*) FROM events_stream;
```

---

**✨ Estrutura limpa e organizada para máxima produtividade!**