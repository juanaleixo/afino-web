# Afino Finance - Hub Financeiro Inteligente

Uma plataforma moderna de gestão financeira construída com Next.js 15, TypeScript, Tailwind CSS e Supabase, oferecendo controle completo de investimentos com funcionalidades diferenciadas por plano.

## 🚀 Tecnologias

- **Framework**: Next.js 15 (App Router)
- **Linguagem**: TypeScript
- **Estilização**: Tailwind CSS
- **Banco de Dados**: Supabase (PostgreSQL)
- **Autenticação**: Supabase Auth
- **UI Components**: shadcn/ui
- **Ícones**: Lucide React

## ✨ Funcionalidades

### 📊 **Dashboard Inteligente**
- Visão consolidada do patrimônio
- Gráficos de evolução temporal
- Estatísticas em tempo real
- Controle de acesso por plano (Free/Premium)

### 💰 **Gestão de Investimentos**
- Contas bancárias múltiplas
- Catálogo global de ativos
- Ativos customizados por usuário
- Transações e movimentações
- Posições diárias calculadas automaticamente

### 🎯 **Funcionalidades por Plano**

#### **Plano Free**
- ✅ Série mensal do patrimônio
- ✅ Snapshot por ativo (data atual)
- ✅ Dashboard básico
- ✅ Gestão de contas e ativos

#### **Plano Premium**
- ✅ Série diária do patrimônio
- ✅ Detalhamento por conta+ativo
- ✅ Snapshot por ativo (qualquer data)
- ✅ Gráficos avançados
- ✅ Relatórios detalhados

### 🔒 **Segurança e Performance**
- Row Level Security (RLS) ativo
- Funções RPC otimizadas
- Materialized Views para agregações
- Controle de acesso granular

## 🛠️ Instalação

### 1. Clone o repositório
```bash
git clone https://github.com/seu-usuario/afino-finance.git
cd afino-finance
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Configure o Supabase
1. Crie um projeto no [Supabase](https://supabase.com)
2. Vá para Settings > API
3. Copie a URL e anon key
4. Crie um arquivo `.env.local` na raiz do projeto:

```env
NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
```

### 4. Configure o Banco de Dados
Execute no SQL Editor do Supabase:

```sql
-- Execute o conteúdo do arquivo database/complete_setup.sql
```

### 5. Insira Dados de Teste (Opcional)
```sql
-- Execute o conteúdo do arquivo database/test_data.sql
```

### 6. Execute o projeto
```bash
npm run dev
```

Acesse: http://localhost:3000

## 🗄️ Estrutura do Banco de Dados

### **Tabelas Principais**
- `accounts` - Contas bancárias dos usuários
- `events` - Transações e movimentações
- `global_assets` - Catálogo público de ativos
- `global_price_daily` - Preços históricos dos ativos
- `custom_assets` - Ativos personalizados por usuário
- `daily_positions_acct` - Posições diárias por conta/ativo
- `user_profiles` - Perfis de usuário com planos

### **Materialized Views**
- `portfolio_value_daily` - Valor diário do portfólio
- `portfolio_value_monthly` - Valor mensal do portfólio
- `portfolio_value_daily_acct` - Valor diário por conta

### **Funções RPC**
- `api_portfolio_daily()` - Série diária (premium)
- `api_portfolio_monthly()` - Série mensal (free/premium)
- `api_holdings_at()` - Snapshot por ativo (free/premium)
- `api_holdings_accounts()` - Snapshot por conta+ativo (premium)

## 📁 Estrutura do Projeto

```
afino-finance/
├── app/                    # App Router (Next.js 15)
│   ├── dashboard/         # Páginas do dashboard
│   │   ├── portfolio/     # Página do portfólio
│   │   ├── accounts/      # Gestão de contas
│   │   ├── assets/        # Gestão de ativos
│   │   └── events/        # Transações
│   ├── login/            # Página de login
│   ├── signup/           # Página de cadastro
│   └── layout.tsx        # Layout principal
├── components/           # Componentes React
│   ├── ui/              # Componentes shadcn/ui
│   ├── PortfolioChart.tsx
│   ├── PlanStatus.tsx
│   └── ProtectedRoute.tsx
├── lib/                 # Utilitários e configurações
│   ├── auth.tsx         # Contexto de autenticação
│   ├── supabase.ts      # Cliente Supabase e tipos
│   └── portfolio.ts     # Serviço de portfólio
├── hooks/               # Hooks personalizados
│   └── useUserPlan.ts   # Hook de plano do usuário
├── database/            # Scripts SQL
│   ├── complete_setup.sql
│   ├── rpc_functions.sql
│   └── test_data.sql
└── styles/              # Estilos globais
```

## 🔐 Funcionalidades Implementadas

- ✅ Autenticação com Supabase
- ✅ Proteção de rotas
- ✅ Controle de acesso por plano
- ✅ Funções RPC para portfólio
- ✅ Dashboard com gráficos
- ✅ Gestão de contas e ativos
- ✅ Tema escuro/claro
- ✅ Interface responsiva
- ✅ Validação de formulários
- ✅ Notificações toast

## 🎨 Design System

O projeto utiliza Tailwind CSS com:

- **Cores**: Sistema de cores baseado em HSL
- **Tipografia**: Inter font
- **Tema**: Suporte a tema escuro/claro
- **Responsividade**: Mobile-first
- **Componentes**: shadcn/ui

## 🔧 Scripts Disponíveis

```bash
npm run dev          # Desenvolvimento
npm run build        # Build de produção
npm run start        # Servidor de produção
npm run lint         # Linting
```

## 🚀 Como Usar

### **Dashboard**
- Acesse `/dashboard` após fazer login
- Visualize estatísticas do portfólio
- Navegue entre as diferentes seções

### **Portfólio**
- Acesse `/dashboard/portfolio`
- Visualize gráficos de evolução
- Consulte posições por data
- Compare funcionalidades free vs premium

### **Gestão de Dados**
- Crie contas em `/dashboard/accounts`
- Adicione ativos em `/dashboard/assets`
- Registre transações em `/dashboard/events`

## 🔒 Controle de Acesso

### **Row Level Security (RLS)**
- Todas as tabelas de usuário têm RLS ativo
- Políticas baseadas em `user_id = app_current_user()`
- Materialized Views sem acesso direto (apenas via RPC)

### **Planos de Acesso**
- **Free**: Funcionalidades básicas
- **Premium**: Acesso completo a todas as funcionalidades

## 📊 Performance

- **Materialized Views** para agregações
- **Funções RPC** otimizadas
- **Partições** em tabelas grandes
- **Índices** estratégicos para consultas

## 🔄 Próximos Passos

- [ ] Implementar triggers de recálculo automático
- [ ] Adicionar mais tipos de ativos
- [ ] Implementar relatórios avançados
- [ ] Adicionar integração com APIs externas
- [ ] Implementar notificações em tempo real

## 📞 Suporte

Para problemas comuns, consulte:
- `DATABASE_SETUP.md` - Configuração do banco
- `TROUBLESHOOTING.md` - Solução de problemas
- `IMPLEMENTATION_SUMMARY.md` - Resumo da implementação

## 🤝 Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.

---

**Desenvolvido com ❤️ para simplificar a gestão financeira pessoal**