# Database Structure

Estrutura organizacional do banco de dados do Afino, otimizada para clareza e manutenção.

## 📁 Estrutura Organizada

### 📊 **tables/** - Definições de Tabelas
```
tables/
├── core/           # Tabelas principais (usuários, contas, eventos)
│   ├── user_profiles.sql      # Perfis de usuários premium
│   ├── accounts.sql           # Contas de investimento
│   └── events.sql             # Eventos/transações
├── assets/         # Gestão de ativos e preços
│   ├── global_assets.sql          # Ativos globais (ações, cripto)
│   ├── custom_assets.sql          # Ativos customizados
│   ├── global_price_daily.sql     # Preços diários globais
│   ├── custom_asset_valuations.sql # Avaliações customizadas
│   └── custom_account_valuations.sql
├── portfolio/      # Cálculos e valores de portfolio
│   ├── daily_positions_acct.sql    # Posições diárias por conta
│   ├── portfolio_value_daily.sql   # Valores diários agregados
│   ├── portfolio_value_monthly.sql # Valores mensais
│   ├── portfolio_value_daily_acct.sql
│   └── portfolio_value_daily_detailed.sql
├── system/         # Tabelas de sistema e utilidades
│   ├── waitlist.sql           # Lista de espera
│   ├── external_items.sql     # Itens externos
│   └── core_tables.sql        # Tabelas base
└── pay/           # Sistema de pagamento (Stripe)
    ├── subscriptions.sql      # Assinaturas
    └── webhook_events.sql     # Eventos de webhook
```

### 🔒 **rls/** - Row Level Security
```
rls/
├── core/          # RLS para tabelas principais
├── assets/        # RLS para gestão de ativos  
├── portfolio/     # RLS para dados de portfolio
├── system/        # RLS para tabelas de sistema
└── pay/           # RLS para sistema de pagamento
```

### ⚡ **functions/** - Funções do Banco
Organizadas por funcionalidade (API, sistema, negócio, triggers)

### 🔄 **triggers/** - Triggers
Organizados por categoria das tabelas que afetam

### 📈 **Otimizações Aplicadas**

#### **indexes/** - Índices de Performance
- `performance_indexes.sql` - Índices críticos para consultas de timeline
- Índices compostos para consultas complexas
- Índices parciais para dados filtrados

#### **fixes/** - Correções de Estrutura
- `standardize_tables.sql` - Padronização de estruturas
- `missing_rls_policies.sql` - Políticas de segurança

#### **optimization/** - Estratégias de Otimização
- `partitioning_strategy.sql` - Particionamento para grandes volumes

#### **cleanup/** - Limpeza de Estrutura Antiga
- `drop_removed_tables.sql` - Remove tabelas obsoletas
- `recreate_functions_triggers.sql` - Recria objetos corretos

## 🎯 **Lógica Simplificada**

### **Usuários Premium**
- ✅ **user_profiles existe** = Usuário Premium
- ❌ **user_profiles não existe** = Usuário Free
- 🔗 **pay.subscriptions** → `auth.users` (referência direta)

### **Assets**
- `global_assets` - Ativos de mercado (ações, cripto)
- `custom_assets` - Ativos personalizados por usuário
- Preços em `global_price_daily` e `custom_asset_valuations`

### **Portfolio**
- `events` - Todas as transações/movimentações
- `daily_positions_acct` - Posições calculadas por conta/dia (particionado)
- `portfolio_value_*` - Valores agregados para performance

## 🚀 **Como Usar**

### **Setup Inicial**
```sql
-- 1. Executar estruturas principais
\i database/tables/core/
\i database/tables/assets/
\i database/tables/portfolio/
\i database/tables/system/
\i database/tables/pay/

-- 2. Aplicar RLS
\i database/rls/core/
\i database/rls/assets/
\i database/rls/portfolio/

-- 3. Otimizações
\i database/indexes/performance_indexes.sql
\i database/fixes/standardize_tables.sql
\i database/fixes/missing_rls_policies.sql
```

### **Para Ambientes Existentes**
```sql
-- 1. Cleanup primeiro
\i database/cleanup/drop_removed_tables.sql
\i database/cleanup/recreate_functions_triggers.sql

-- 2. Setup normal
-- (mesmo processo acima)
```

## 📊 **Monitoramento**

Use as funções de monitoramento:
```sql
-- Ver tamanhos das tabelas
SELECT * FROM get_table_sizes();

-- Criar partições automaticamente
SELECT create_daily_positions_partition(CURRENT_DATE);
```

## ⚠️ **Importante**

- Faça backup antes de aplicar mudanças em produção
- Scripts são idempotentes (seguros para re-execução)
- Siga a ordem recomendada para evitar dependências