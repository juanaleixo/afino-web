# Changelog - Afino Finance

## [1.1.0] - 2024-12-19

### 🔄 **Mudanças no Schema**
- **Removido**: Plano 'pro' - agora apenas 'free' e 'premium'
- **Atualizado**: Função `app_is_premium()` para verificar apenas 'premium'
- **Simplificado**: Tipos TypeScript para planos de usuário

### 📝 **Arquivos Modificados**
- `database/complete_setup.sql` - Removido 'pro' do CHECK constraint
- `lib/supabase.ts` - Atualizado tipo UserProfile
- `hooks/useUserPlan.ts` - Atualizado tipo UserPlan
- `SCHEMA.md` - Removidas referências ao plano 'pro'

### ✅ **Compatibilidade**
- Mantida compatibilidade com dados existentes
- Usuários com plano 'pro' serão tratados como 'premium'
- Frontend continua funcionando normalmente

---

## [1.0.0] - 2024-12-19

### 🎉 **Lançamento Inicial**
- Implementação completa do schema fornecido
- Funções RPC para portfólio
- Controle de acesso por plano
- Dashboard com gráficos
- Gestão de contas e ativos

### 🗄️ **Schema do Banco**
- Tabelas: accounts, global_assets, events, custom_assets
- Materialized Views: portfolio_value_daily, portfolio_value_monthly
- Funções RPC: api_portfolio_daily, api_portfolio_monthly, api_holdings_at, api_holdings_accounts
- Controle de acesso: Row Level Security (RLS)

### 🎯 **Funcionalidades**
- **Free**: Série mensal + snapshot por ativo (hoje)
- **Premium**: Todas as funcionalidades + dados diários + detalhamento por conta

### 📁 **Estrutura**
- Next.js 15 com App Router
- TypeScript
- Tailwind CSS + shadcn/ui
- Supabase para backend
- Componentes reutilizáveis

---

**Nota**: Este changelog documenta as principais mudanças no projeto. Para detalhes técnicos, consulte os arquivos de documentação específicos. 