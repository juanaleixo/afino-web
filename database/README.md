# Database Documentation - Afino Finance

## 📋 Visão Geral

Documentação do banco de dados PostgreSQL do Afino Finance - plataforma de gestão de investimentos.

### Características
- **PostgreSQL 15+** com Supabase
- **Row Level Security (RLS)** para isolamento de dados
- **Particionamento** para performance em grandes volumes
- **Funções API** otimizadas para frontend

## 🗄️ Estrutura de Tabelas

### **user_profiles** - Controle de Usuários Premium
```sql
user_id uuid PRIMARY KEY              -- FK para auth.users
email text, full_name text, avatar_url text
stripe_customer_id text UNIQUE        -- ID do cliente no Stripe
stripe_subscription_id text UNIQUE    -- ID da assinatura no Stripe  
subscription_status text              -- 'active', 'canceled', 'trialing', etc.
premium_expires_at timestamptz        -- Data de expiração (NULL = nunca)
created_at timestamptz, updated_at timestamptz
```
**Lógica**: Usuário existe na tabela = Premium | Não existe = Free

### **accounts** - Contas de Investimento
```sql
id uuid PRIMARY KEY                   -- ID único da conta
user_id uuid                          -- FK para auth.users
label text NOT NULL                   -- Nome da conta ("Conta Corrente", "XP")
currency text DEFAULT 'BRL'          -- Moeda base da conta
created_at timestamptz
```

### **events** - Transações (Fonte da Verdade)
```sql
id uuid PRIMARY KEY
user_id uuid NOT NULL                 -- Dono da transação
account_id uuid                       -- Conta onde ocorreu
asset_symbol text                     -- Símbolo do ativo (VALE3, BTC, etc.)
tstamp timestamptz                    -- Momento da transação
kind text                             -- Tipo: 'deposit', 'withdraw', 'buy', 'position_add', 'valuation'
units_delta numeric                   -- Variação em unidades (+compra, -venda)
price_override numeric                -- Preço manual (quando aplicável)
price_close numeric                   -- Preço de fechamento
meta jsonb                            -- Dados extras em JSON
created_at timestamptz
```

### **global_assets** - Catálogo de Ativos Globais
```sql
id uuid PRIMARY KEY
symbol text UNIQUE NOT NULL           -- VALE3, BTC, USD, etc.
class text NOT NULL                   -- 'stock', 'crypto', 'currency', 'fund', 'reit', etc.
currency text NOT NULL                -- Moeda base do ativo
manual_price numeric                  -- Preço manual fixo (opcional)
label_ptbr text                       -- Nome em português
meta jsonb                            -- Metadados do ativo
created_at timestamptz
```

### **global_price_daily** - Preços Históricos
```sql
id uuid PRIMARY KEY
asset_symbol text                     -- FK para global_assets.symbol
date date NOT NULL                    -- Data do preço
price numeric NOT NULL                -- Valor do ativo
UNIQUE(asset_symbol, date)            -- Um preço por ativo por dia
```

### **custom_assets** - Ativos Personalizados
```sql
id uuid PRIMARY KEY
user_id uuid NOT NULL                 -- Dono do ativo customizado
label text NOT NULL                   -- Nome do ativo ("Meu Apartamento")
currency text NOT NULL                -- Moeda
class text                            -- Tipo do ativo (opcional)
symbol text                           -- Símbolo customizado (opcional)
meta jsonb                            -- Dados extras
created_at timestamptz
```

### **custom_asset_valuations** - Avaliações de Ativos Customizados
```sql
id uuid PRIMARY KEY
asset_id uuid NOT NULL                -- FK para custom_assets.id
date date NOT NULL                    -- Data da avaliação
value numeric NOT NULL                -- Valor atribuído
created_at timestamptz
UNIQUE(asset_id, date)               -- Uma avaliação por ativo por dia
```

### **daily_positions_acct** - Posições Diárias (PARTICIONADA)
```sql
user_id uuid NOT NULL                 -- Dono da posição
account_id uuid NOT NULL              -- Conta da posição  
asset_id text NOT NULL                -- ID do ativo (symbol ou uuid)
date date NOT NULL                    -- Data da posição
units numeric(38,18) NOT NULL         -- Quantidade de unidades
price numeric(20,10)                  -- Preço unitário usado
value numeric(20,10)                  -- Valor total (units * price)
currency text NOT NULL                -- Moeda
source_price text                     -- 'global', 'manual', 'custom'
is_final boolean DEFAULT true         -- Se é posição final do dia
PRIMARY KEY (user_id, account_id, asset_id, date)
```
**Particionamento**: Mensal (`daily_positions_acct_YYYY_MM`)

### **portfolio_value_*** - Views Agregadas (Pre-calculadas)
- **`portfolio_value_daily`**: `(user_id, date, total_value)` - Total por usuário/dia
- **`portfolio_value_monthly`**: `(user_id, month, month_value)` - Total por usuário/mês
- **`portfolio_value_daily_acct`**: `(user_id, account_id, date, total_value)` - Total por conta/dia  
- **`portfolio_value_daily_detailed`**: `(user_id, asset_id, date, asset_value)` - Total por ativo/dia

## ⚙️ Funções Principais

### 🎯 API (Frontend)

#### **`api_user_context()`** → JSON
Retorna contexto completo do usuário em uma única chamada.
```json
{
  "user_id": "uuid",
  "plan": "free|premium", 
  "is_premium": boolean,
  "features": { "dailyData": boolean, "multipleAccounts": boolean, ... },
  "total_events": number,
  "accounts_count": number
}
```

#### **`api_portfolio_daily(p_from date, p_to date)`** → TABLE(date, total_value)
**Uso**: Gráficos de evolução patrimonial diária  
**Restrição**: Premium apenas  
**Fonte**: `portfolio_value_daily` (pré-calculado)

#### **`api_portfolio_monthly(p_from date, p_to date)`** → TABLE(month, total_value)  
**Uso**: Gráficos de evolução patrimonial mensal  
**Restrição**: Free + Premium  
**Fonte**: `portfolio_value_monthly` (pré-calculado)

#### **`api_holdings_with_assets(p_date date)`** → TABLE(asset_id, symbol, class, units, value)
**Uso**: Lista de posições atuais com dados dos ativos  
**Restrição**: Free (só data atual), Premium (qualquer data)  
**Performance**: Otimizada, sem JSON aggregation

#### **`api_holdings_accounts(p_date date)`** → TABLE(account_id, asset_id, units, value, ...)
**Uso**: Detalhamento de posições por conta  
**Restrição**: Premium apenas  
**Fonte**: `daily_positions_acct` com JOIN em assets

### 🔧 Sistema

#### **`app_current_user()`** → uuid
**Uso**: Base de todas as políticas RLS  
**Lógica**: Tenta `auth.uid()` do Supabase, fallback para `app.user_id` session var

#### **`app_is_premium()`** → boolean  
**Uso**: Controle de acesso em funções  
**Lógica**: Verifica existência em `user_profiles` com `subscription_status = 'active'`

### 📊 Cálculos de Posições

#### **`fn_recalc_positions_acct(p_user uuid, p_account uuid, p_asset text, p_from date)`**
**Uso**: Recalcula posições diárias para uma combinação específica  
**Processo**:
1. Calcula unidades acumuladas até `p_from-1` (baseline)
2. Gera série temporal de `p_from` até `CURRENT_DATE`
3. Aplica deltas diários de `events`
4. Busca preços (global_price_daily ou custom_asset_valuations)
5. Atualiza `daily_positions_acct` e views agregadas
6. Usa advisory locks para evitar concorrência

#### **`fn_finalize_portfolio_day(p_date date)`**
**Uso**: Processa snapshots de fim de dia para todos os usuários  
**Processo**:
1. Atualiza preços via `refresh_all_asset_prices()`
2. Identifica todas combinações (user, account, asset) ativas até `p_date`
3. Chama `fn_recalc_positions_acct` para cada combinação
4. Garante existência de partições necessárias

#### **`ensure_daily_positions_partitions(p_from date, p_to date)`**
**Uso**: Cria partições mensais se não existirem  
**Pattern**: `daily_positions_acct_YYYY_MM`  
**Automático**: Chamado pelos cálculos principais

### 💰 Preços de Ativos

#### **`refresh_all_asset_prices()`**
**Uso**: Atualiza preços de ativos globais via APIs externas  
**Fontes**: Yahoo Finance, CoinGecko, B3  
**Frequência**: Cron job horário durante pregão

#### **`fetch_price_stock_history(p_symbol text, p_from date, p_to date)`**
**Uso**: Busca histórico de ações via Yahoo Finance  
**Insere**: Diretamente em `global_price_daily`

#### **`fetch_price_crypto_history_v2(p_symbol text, p_from date, p_to date)`**  
**Uso**: Busca histórico de criptomoedas via CoinGecko  
**Melhoria**: Versão otimizada com rate limiting

### 🛠️ Manutenção

#### **`refresh_mv(mv_name text)`**
**Uso**: Refresh manual de materialized views  
**Suporte**: `global_price_daily_filled` e outras MVs

#### **`fn_dpa_keep_zero_borders(user, account, asset, from, to)`**
**Uso**: Mantém bordas com valor zero nas posições (para continuidade visual)  
**Automático**: Chamado por `fn_recalc_positions_acct`

## 🔒 Segurança

### Row Level Security (RLS)
Política base: `user_id = app_current_user()` em todas as tabelas de usuário.

### Controle por Plano
**Free**: Dados mensais, holdings atuais  
**Premium**: Dados diários, históricos completos, múltiplas contas

## 🚀 Performance

### Índices Principais
- **Events**: `(user_id, tstamp)`, `(user_id, asset_symbol, tstamp)`
- **Daily Positions**: `(user_id, date)`, `(user_id, account_id, asset_id, date)`
- **Global Prices**: `(asset_symbol, date)`

### Particionamento
`daily_positions_acct` particionada mensalmente (`daily_positions_acct_YYYY_MM`)

## 🔄 Automação

### Triggers
- **`t_events_recalc_acct`** - Recalcula posições após mudanças em events
- **`t_events_validate_data`** - Validação de dados de negócio

### Cron Jobs
- **Diário (6:00 UTC)**: Finaliza snapshots do dia anterior
- **Horário comercial**: Atualiza preços dos ativos

## 🔧 Comandos Úteis

### Verificar Tamanhos
```sql
SELECT tablename, pg_size_pretty(pg_total_relation_size('public.'||tablename))
FROM pg_tables WHERE schemaname = 'public' 
ORDER BY pg_total_relation_size('public.'||tablename) DESC;
```

### Criar Partições
```sql
SELECT ensure_daily_positions_partitions('2024-01-01', '2024-12-31');
```

### Health Check
```sql
-- Eventos sem posições calculadas
SELECT COUNT(*) FROM events e
WHERE NOT EXISTS (
  SELECT 1 FROM daily_positions_acct d
  WHERE d.user_id = e.user_id AND d.asset_id = e.asset_symbol
  AND d.date = e.tstamp::date
);
```