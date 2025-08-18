# Schema do Banco de Dados - Afino Finance

## 📋 Visão Geral

Este documento descreve o schema completo do banco de dados do Afino Finance, baseado no `afino_schema` fornecido.

## 🎯 Princípios de Design

- **Segurança**: Row Level Security (RLS) ativo em todas as tabelas de usuário
- **Performance**: Materialized Views para agregações, índices estratégicos
- **Escalabilidade**: Partições em tabelas grandes, funções RPC otimizadas
- **Flexibilidade**: Suporte a ativos globais e customizados
- **Controle de Acesso**: Gating por plano (free/premium)

## 🗄️ Entidades Principais

### **accounts**
Contas bancárias dos usuários.

```sql
CREATE TABLE accounts (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  currency text DEFAULT 'BRL',
  created_at timestamptz DEFAULT now()
);
```

**RLS**: `user_id = app_current_user()`

### **global_assets**
Catálogo público de ativos (ações, criptos, moedas, etc.).

```sql
CREATE TABLE global_assets (
  id uuid PRIMARY KEY,
  symbol text UNIQUE NOT NULL,
  class text NOT NULL, -- 'stock', 'crypto', 'currency', 'bond', 'fund'
  currency text DEFAULT 'BRL',
  manual_price numeric(20,10),
  meta jsonb,
  created_at timestamptz DEFAULT now()
);
```

**RLS**: Nenhum (somente GRANT SELECT para anon/authenticated)

### **global_price_daily**
Preços históricos dos ativos globais.

```sql
CREATE TABLE global_price_daily (
  id uuid PRIMARY KEY,
  asset_id uuid REFERENCES global_assets(id) ON DELETE CASCADE,
  date date NOT NULL,
  price numeric(20,10) NOT NULL,
  UNIQUE(asset_id, date)
);
```

**RLS**: Nenhum (GRANT SELECT)

### **custom_assets**
Ativos personalizados por usuário.

```sql
CREATE TABLE custom_assets (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  currency text DEFAULT 'BRL',
  meta jsonb
);
```

**RLS**: `user_id = app_current_user()`

### **events**
Transações e movimentações (fonte da verdade).

```sql
CREATE TABLE events (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  account_id uuid REFERENCES accounts(id),
  asset_id uuid REFERENCES global_assets(id),
  tstamp timestamptz DEFAULT now(),
  kind text CHECK (kind IN ('qty_change', 'valuation', 'price_cache')),
  units_delta numeric(38,18),
  price_override numeric(20,10),
  price_close numeric(20,10),
  meta jsonb
);
```

**Índices**:
- `(user_id, asset_id, tstamp)`
- `(user_id, tstamp)`
- `(account_id, tstamp)`

**RLS**: `user_id = app_current_user()`

### **daily_positions_acct**
Posições diárias por conta/ativo (materializada incremental).

```sql
CREATE TABLE daily_positions_acct (
  user_id uuid,
  account_id uuid,
  asset_id uuid,
  date date,
  units numeric(38,18) DEFAULT 0,
  price numeric(20,10),
  value numeric(20,10),
  currency text DEFAULT 'BRL',
  source_price text CHECK (source_price IN ('global', 'manual', 'custom')),
  is_final boolean DEFAULT true,
  PRIMARY KEY (user_id, account_id, asset_id, date)
);
```

**Partições**: `RANGE(date)` mensal — `daily_positions_acct_YYYY_MM`

**Índices**:
- `(user_id, date)`
- `(user_id, asset_id, date)`
- `(user_id, account_id, asset_id, date)`

**RLS**: `user_id = app_current_user()` (SELECT apenas)

**Escrita**: Via função SD `fn_recalc_positions_acct`

### **portfolio_value_daily** (MV)
Valor diário do portfólio agregado.

```sql
CREATE TABLE portfolio_value_daily (
  user_id uuid,
  date date,
  total_value numeric(20,10) DEFAULT 0,
  PRIMARY KEY (user_id, date)
);
```

**RLS**: Não suportado em MV — acesso direto REVOKE; usar RPC

### **portfolio_value_monthly** (MV)
Valor mensal do portfólio agregado.

```sql
CREATE TABLE portfolio_value_monthly (
  user_id uuid,
  month_eom date,
  total_value numeric(20,10) DEFAULT 0,
  PRIMARY KEY (user_id, month_eom)
);
```

**RLS**: Não suportado em MV — acesso direto REVOKE; usar RPC

### **portfolio_value_daily_acct** (MV)
Valor diário por conta.

```sql
CREATE TABLE portfolio_value_daily_acct (
  user_id uuid,
  account_id uuid,
  date date,
  total_value numeric(20,10) DEFAULT 0,
  PRIMARY KEY (user_id, account_id, date)
);
```

**RLS**: Não suportado em MV — acesso direto REVOKE; usar RPC

### **user_profiles**
Perfis de usuário com planos.

```sql
CREATE TABLE user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text DEFAULT 'free' CHECK (plan IN ('free', 'premium'))
);
```

**RLS**: `user_id = app_current_user()`

## 🔧 Funções do Sistema

### **app_current_user()**
Retorna o user_id atual.

```sql
CREATE FUNCTION app_current_user() RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN auth.uid();
END;
$$;
```

### **app_is_premium()**
Helper de gating via user_profiles.plan.

```sql
CREATE FUNCTION app_is_premium() RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM user_profiles 
    WHERE user_id = app_current_user() 
    AND plan = 'premium'
  );
END;
$$;
```

### **fn_recalc_positions_acct()**
Recalcula posições para uma janela de datas.

```sql
CREATE FUNCTION fn_recalc_positions_acct(
  p_user uuid, 
  p_account uuid, 
  p_asset uuid, 
  p_from date
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
-- Implementação do recálculo
$$;
```

## 🚀 Funções RPC (Frontend)

### **api_portfolio_daily(p_from date, p_to date)**
Série diária do patrimônio.

**Retorno**: `TABLE(date date, total_value numeric)`

**Visibilidade**: Premium (recomendado)

**Fonte**: `portfolio_value_daily`

### **api_portfolio_monthly(p_from date, p_to date)**
Série mensal do patrimônio.

**Retorno**: `TABLE(month_eom date, total_value numeric)`

**Visibilidade**: Free & Premium

**Fonte**: `portfolio_value_monthly`

### **api_holdings_at(p_date date)**
Snapshot por ativo.

**Retorno**: `TABLE(asset_id uuid, units numeric, value numeric)`

**Visibilidade**: Free & Premium

**Fonte**: `daily_positions_acct` (agregado por asset)

### **api_holdings_accounts(p_date date)**
Snapshot por conta+ativo.

**Retorno**: `TABLE(account_id uuid, asset_id uuid, units numeric, value numeric)`

**Visibilidade**: Premium (recomendado)

**Fonte**: `daily_positions_acct` (detalhado por conta)

## 🔒 Controle de Acesso

### **Row Level Security (RLS)**
- **Habilitado em**: accounts, events, custom_assets, custom_asset_valuations, custom_account_valuations, daily_positions_acct, user_profiles, external_items
- **Política base**: `user_id = app_current_user()` ou `EXISTS` via FK

### **Materialized Views**
- **Regra**: Sem RLS; acesso direto REVOKE; consumir via RPC

### **Roles**
- **anon/authenticated**:
  - `GRANT EXECUTE` nas RPCs `api_*`
  - `SELECT` direto em `global_assets`/`global_price_daily` (read-only)
- **service_role**:
  - `SELECT` nas MVs e manutenção (REFRESH)
- **supabase_admin**:
  - `GRANT ALL` em tabelas/seq/functions (RLS ainda se aplica)

## 🎯 Gating por Plano

### **Free**
- ✅ `api_portfolio_monthly`
- ✅ `api_holdings_at` (p_date: hoje)

### **Premium**
- ✅ `api_portfolio_daily`
- ✅ `api_holdings_accounts`
- ✅ `api_holdings_at` (qualquer data)

## 📊 Partições

**Padrão**: `daily_positions_acct_YYYY_MM`

**Garantia**: `ensure_daily_positions_partitions(p_from, p_to)` antes de recálculo de janelas longas

## 🔄 Triggers

### **t_events_recalc_acct**
- **Tabela**: events
- **Timing**: AFTER
- **Eventos**: INSERT, UPDATE, DELETE
- **Função**: `trg_events_recalc_acct()`

**Comportamento**:
- **INSERT**: recalc(user, account, asset, date)
- **UPDATE**: recalc lado OLD e lado NEW se mudou account/asset/tstamp
- **DELETE**: recalc(user, account, asset, date)

## 📈 Performance

### **Índices Estratégicos**
- Events: `(user_id, asset_id, tstamp)`, `(user_id, tstamp)`, `(account_id, tstamp)`
- Daily Positions: `(user_id, date)`, `(user_id, asset_id, date)`
- Global Prices: `(asset_id, date)`

### **Materialized Views**
- Agregações pré-calculadas para consultas frequentes
- Refresh incremental via triggers

### **Partições**
- Tabelas grandes particionadas por data
- Consultas mais eficientes em janelas temporais

---

**Nota**: Use sempre os RPCs (functions) para o front; não leia tabelas/MVs direto. Fora do Supabase, defina o usuário com: `SET app.user_id = '<uuid>'` por request. 