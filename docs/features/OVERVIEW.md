# 📚 Documentação Completa - Afino Finance

## 🎯 Visão Geral do Projeto

O **Afino Finance** é uma plataforma SaaS de gestão financeira construída com Next.js 15, TypeScript, Tailwind CSS e Supabase. O projeto implementa um sistema completo de controle de investimentos com funcionalidades diferenciadas por plano (Free/Premium).

### 🏗️ Arquitetura Geral

```
Afino Finance/
├── 📁 app/                    # Next.js App Router
│   ├── 📁 dashboard/         # Área autenticada
│   ├── 📁 auth/             # Páginas de autenticação
│   └── 📄 layout.tsx        # Layout principal
├── 📁 components/           # Componentes React reutilizáveis
│   ├── 📁 ui/              # Componentes shadcn/ui
│   └── 📄 *.tsx            # Componentes customizados
├── 📁 lib/                 # Utilitários e configurações
├── 📁 styles/              # Estilos globais
└── 📄 *.md                 # Documentação
```

---

## 🔐 Sistema de Autenticação

### 📄 `lib/auth.tsx`
**Propósito**: Contexto de autenticação global usando Supabase Auth.

**Funcionalidades**:
- Gerenciamento de estado do usuário
- Funções de login/logout
- Proteção de rotas
- Persistência de sessão

**Principais Hooks**:
```typescript
const { user, signIn, signOut, loading } = useAuth()
```

**Fluxo de Autenticação**:
1. Usuário acessa `/login` ou `/signup`
2. Formulário envia credenciais para Supabase
3. Supabase retorna sessão
4. Contexto atualiza estado global
5. Usuário é redirecionado para `/dashboard`

### 📄 `components/ProtectedRoute.tsx`
**Propósito**: Componente wrapper para proteger rotas autenticadas.

**Funcionalidades**:
- Verifica se usuário está autenticado
- Redireciona para login se não autenticado
- Mostra loading durante verificação

**Uso**:
```tsx
<ProtectedRoute>
  <DashboardContent />
</ProtectedRoute>
```

---

## 🏠 Páginas Principais

### 📄 `app/page.tsx` - Página Inicial
**Propósito**: Landing page pública do projeto.

**Componentes Utilizados**:
- `Header` - Navegação principal
- `Hero` - Seção de destaque
- `Features` - Funcionalidades do produto
- `Reviews` - Depoimentos
- `Footer` - Rodapé

**Funcionalidades**:
- Apresentação do produto
- Call-to-action para cadastro
- Informações sobre planos
- Navegação para outras páginas

### 📄 `app/login/page.tsx` - Página de Login
**Propósito**: Autenticação de usuários existentes.

**Funcionalidades**:
- Formulário de login com email/senha
- Validação com Zod
- Integração com Supabase Auth
- Redirecionamento após login
- Link para cadastro

**Validação**:
```typescript
const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres")
})
```

### 📄 `app/signup/page.tsx` - Página de Cadastro
**Propósito**: Registro de novos usuários.

**Funcionalidades**:
- Formulário de cadastro
- Validação de dados
- Criação de conta no Supabase
- Redirecionamento para dashboard
- Seleção de plano (Free/Premium)

---

## 🎛️ Dashboard - Área Autenticada

### 📄 `app/dashboard/page.tsx` - Dashboard Principal
**Propósito**: Página inicial do dashboard após login.

**Funcionalidades**:
- Resumo do portfólio
- Estatísticas principais
- Menu de navegação
- Status do plano do usuário
- Cards de ação rápida

**Componentes Utilizados**:
- `PlanStatus` - Status do plano
- Cards de estatísticas
- Menu de navegação

**Dados Carregados**:
- Valor total do portfólio
- Número de ativos
- Status do plano (Free/Premium)

### 📄 `app/dashboard/accounts/page.tsx` - Gestão de Contas
**Propósito**: CRUD completo de contas bancárias.

**Funcionalidades**:
- Listar contas do usuário
- Criar nova conta
- Editar conta existente
- Excluir conta
- Visualizar detalhes

**Campos da Conta**:
- Label (nome da conta)
- Currency (moeda)
- Data de criação

**Operações**:
- `GET /accounts` - Listar contas
- `POST /accounts` - Criar conta
- `PUT /accounts/:id` - Atualizar conta
- `DELETE /accounts/:id` - Excluir conta

### 📄 `app/dashboard/accounts/new/page.tsx` - Nova Conta
**Propósito**: Formulário para criar nova conta bancária.

**Funcionalidades**:
- Formulário com validação
- Seleção de moeda
- Integração com Supabase
- Redirecionamento após criação

**Validação**:
```typescript
const accountSchema = z.object({
  label: z.string().min(1, "Nome da conta é obrigatório"),
  currency: z.enum(['BRL', 'USD', 'EUR'])
})
```

### 📄 `app/dashboard/assets/page.tsx` - Gestão de Ativos
**Propósito**: Visualizar e gerenciar ativos disponíveis.

**Funcionalidades**:
- Listar ativos globais
- Filtrar por classe (ação, cripto, etc.)
- Visualizar detalhes do ativo
- Criar ativo customizado

**Tipos de Ativos**:
- `stock` - Ações
- `bond` - Títulos
- `fund` - Fundos
- `crypto` - Criptomoedas
- `currency` - Moedas

### 📄 `app/dashboard/assets/new/page.tsx` - Novo Ativo
**Propósito**: Criar ativo customizado.

**Funcionalidades**:
- Formulário para novo ativo
- Seleção de classe
- Preço manual opcional
- Metadados em JSON

---

## 📊 Sistema de Eventos

### 📄 `app/dashboard/events/page.tsx` - Lista de Eventos
**Propósito**: Visualizar histórico de transações e eventos.

**Funcionalidades**:
- Listar eventos do usuário
- Filtrar por tipo
- Excluir eventos
- Visualizar detalhes

**Tipos de Eventos**:
- `deposit` - Depósito
- `withdraw` - Saque
- `buy` - Compra
- `sell` - Venda
- `transfer` - Transferência
- `valuation` - Avaliação

**Campos do Evento**:
- `asset_id` - Ativo relacionado
- `account_id` - Conta (opcional)
- `kind` - Tipo do evento
- `units_delta` - Mudança na quantidade
- `price_override` - Preço manual
- `tstamp` - Data/hora

### 📄 `app/dashboard/events/new/page.tsx` - Novo Evento
**Propósito**: Registrar nova transação ou evento.

**Funcionalidades**:
- Formulário dinâmico baseado no tipo
- Validação específica por tipo
- Seleção de ativo e conta
- Interface responsiva

**Validações por Tipo**:
- **Depósito/Saque**: Quantidade obrigatória > 0
- **Compra/Venda**: Quantidade > 0 E Preço > 0
- **Transferência**: Quantidade ≠ 0
- **Avaliação**: Preço > 0

**Interface Dinâmica**:
- Campos mostrados/ocultados conforme tipo
- Descrições explicativas
- Limpeza automática de campos irrelevantes

---

## 📈 Sistema de Portfólio

### 📄 `app/dashboard/portfolio/page.tsx` - Portfólio
**Propósito**: Visualização consolidada do patrimônio.

**Funcionalidades**:
- Gráfico de evolução temporal
- Posições por ativo
- Estatísticas do portfólio
- Diferenciação por plano

**Dados por Plano**:
- **Free**: Série mensal + snapshot atual
- **Premium**: Série diária + histórico completo

**Componentes**:
- `PortfolioChart` - Gráfico de evolução
- Cards de estatísticas
- Tabela de posições

### 📄 `lib/portfolio.ts` - Serviço de Portfólio
**Propósito**: Classe para gerenciar dados do portfólio.

**Métodos Principais**:
```typescript
class PortfolioService {
  async getPortfolioData(dateRange, date) // Dados completos
  async getDailySeries(from, to) // Série diária (premium)
  async getMonthlySeries(from, to) // Série mensal (free)
  async getHoldingsAt(date) // Posições por ativo
  async getHoldingsAccounts(date) // Posições por conta (premium)
}
```

**Controle de Acesso**:
- Verificação automática do plano
- Dados limitados para usuários free
- Funcionalidades premium bloqueadas

### 📄 `components/PortfolioChart.tsx` - Gráfico do Portfólio
**Propósito**: Visualização gráfica da evolução do patrimônio.

**Funcionalidades**:
- Gráfico de linha temporal
- Dados mensais e diários
- Responsivo
- Tema escuro/claro

**Biblioteca**: Recharts

---

## ⚙️ Configurações e Utilitários

### 📄 `app/dashboard/settings/page.tsx` - Configurações
**Propósito**: Gerenciar configurações do usuário.

**Funcionalidades**:
- Perfil do usuário
- Configurações de notificação
- Preferências de interface
- Gerenciamento de conta

### 📄 `lib/supabase.ts` - Cliente Supabase
**Propósito**: Configuração e tipos do cliente Supabase.

**Funcionalidades**:
- Cliente Supabase configurado
- Interfaces TypeScript
- Tipos para todas as entidades

**Interfaces Principais**:
```typescript
interface User { id: string; email: string; created_at: string }
interface Account { id: string; user_id: string; label: string; currency: string }
interface Asset { id: string; symbol: string; class: string; currency: string }
interface Event { id: string; user_id: string; asset_id: string; kind: string }
```

### 📄 `lib/utils.ts` - Utilitários
**Propósito**: Funções utilitárias reutilizáveis.

**Funcionalidades**:
- `cn()` - Combinação de classes CSS
- Formatação de dados
- Helpers de validação

---

## 🎨 Componentes de Interface

### 📁 `components/ui/` - Componentes shadcn/ui
**Propósito**: Biblioteca de componentes base.

**Componentes Principais**:
- `Button` - Botões
- `Card` - Cards
- `Input` - Campos de entrada
- `Select` - Seletores
- `Table` - Tabelas
- `Form` - Formulários
- `Dialog` - Modais
- `Badge` - Etiquetas

### 📄 `components/Header.tsx` - Cabeçalho
**Propósito**: Navegação principal do site.

**Funcionalidades**:
- Logo e navegação
- Menu responsivo
- Botões de ação
- Tema escuro/claro

### 📄 `components/Footer.tsx` - Rodapé
**Propósito**: Rodapé do site.

**Funcionalidades**:
- Links importantes
- Informações da empresa
- Redes sociais

### 📄 `components/PlanStatus.tsx` - Status do Plano
**Propósito**: Exibir status do plano do usuário.

**Funcionalidades**:
- Indicador visual do plano
- Informações sobre limites
- Call-to-action para upgrade

---

## 🗄️ Estrutura do Banco de Dados

### 📊 Tabelas Principais

#### `accounts`
```sql
CREATE TABLE accounts (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  label text NOT NULL,
  currency text DEFAULT 'BRL',
  created_at timestamptz DEFAULT now()
);
```

#### `global_assets`
```sql
CREATE TABLE global_assets (
  id uuid PRIMARY KEY,
  symbol text UNIQUE NOT NULL,
  class text NOT NULL,
  currency text DEFAULT 'BRL',
  manual_price numeric,
  meta jsonb
);
```

#### `events`
```sql
CREATE TABLE events (
  id uuid PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  asset_id uuid REFERENCES global_assets(id),
  account_id uuid REFERENCES accounts(id),
  tstamp timestamptz DEFAULT now(),
  kind text CHECK (kind IN ('deposit', 'withdraw', 'buy', 'sell', 'transfer', 'valuation')),
  units_delta numeric,
  price_override numeric,
  price_close numeric
);
```

#### `user_profiles`
```sql
CREATE TABLE user_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  plan text DEFAULT 'free' CHECK (plan IN ('free', 'premium'))
);
```

### 🔒 Segurança (RLS)
- Todas as tabelas têm Row Level Security
- Política base: `user_id = auth.uid()`
- Usuários só acessam seus próprios dados

---

## 🎯 Funcionalidades por Plano

### 📋 Plano Free
**Funcionalidades Disponíveis**:
- ✅ Dashboard básico
- ✅ Gestão de contas
- ✅ Gestão de ativos
- ✅ Eventos e transações
- ✅ Série mensal do portfólio
- ✅ Snapshot atual por ativo

**Limitações**:
- ❌ Série diária do portfólio
- ❌ Detalhamento por conta
- ❌ Histórico completo
- ❌ Relatórios avançados

### 👑 Plano Premium
**Funcionalidades Adicionais**:
- ✅ Série diária do portfólio
- ✅ Detalhamento por conta+ativo
- ✅ Snapshot por qualquer data
- ✅ Gráficos avançados
- ✅ Relatórios detalhados
- ✅ Exportação de dados

---

## 🔧 Configuração e Deploy

### 📄 `package.json`
**Dependências Principais**:
- `next@15` - Framework React
- `@supabase/supabase-js` - Cliente Supabase
- `react-hook-form` - Formulários
- `zod` - Validação
- `tailwindcss` - Estilização
- `lucide-react` - Ícones

### 📄 `.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
```

### 📄 `tailwind.config.js`
**Configuração**:
- Tema personalizado
- Cores do projeto
- Componentes shadcn/ui

### 📄 `next.config.ts`
**Configuração Next.js**:
- TypeScript
- Otimizações
- Headers de segurança

---

## 🚀 Fluxo de Desenvolvimento

### 1. **Estrutura de Páginas**
```
app/
├── page.tsx              # Landing page
├── login/page.tsx        # Login
├── signup/page.tsx       # Cadastro
├── pricing/page.tsx      # Planos
└── dashboard/           # Área autenticada
    ├── page.tsx         # Dashboard principal
    ├── accounts/        # Gestão de contas
    ├── assets/          # Gestão de ativos
    ├── events/          # Eventos/transações
    ├── portfolio/       # Portfólio
    ├── reports/         # Relatórios
    └── settings/        # Configurações
```

### 2. **Fluxo de Dados**
```
Usuário → Formulário → Validação → Supabase → Banco → Resposta → Interface
```

### 3. **Controle de Acesso**
```
Autenticação → Verificação de Plano → Carregamento de Dados → Renderização
```

---

## 🐛 Debugging e Troubleshooting

### Problemas Comuns

#### 1. **Erro de Constraint no Banco**
**Sintoma**: `violates check constraint`
**Solução**: Verificar validação no frontend e constraints no banco

#### 2. **Erro de RLS**
**Sintoma**: `new row violates row-level security policy`
**Solução**: Verificar se `user_id` está sendo enviado corretamente

#### 3. **Erro de Tipo TypeScript**
**Sintoma**: `Type 'X' is not assignable to type 'Y'`
**Solução**: Atualizar interfaces em `lib/supabase.ts`

#### 4. **Erro de Autenticação**
**Sintoma**: Redirecionamento infinito
**Solução**: Verificar configuração do Supabase e variáveis de ambiente

### Logs Úteis
```typescript
// Debug de dados
console.log('Dados sendo enviados:', data)

// Debug de erros
console.error('Erro do Supabase:', error)

// Debug de estado
console.log('Estado atual:', state)
```

---

## 📚 Recursos Adicionais

### Documentação Externa
- [Next.js 15 Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)

### Arquivos de Configuração
- `SETUP.md` - Guia de configuração
- `SCHEMA.md` - Schema completo do banco
- `README.md` - Visão geral do projeto

### Padrões de Código
- TypeScript strict mode
- ESLint + Prettier
- Conventional commits
- Component-first architecture

---

## 🎯 Próximos Passos

### Melhorias Sugeridas
1. **Testes**: Implementar testes unitários e E2E
2. **Performance**: Otimizar queries e cache
3. **UX**: Melhorar feedback visual
4. **Segurança**: Implementar rate limiting
5. **Monitoramento**: Adicionar analytics e logs

### Funcionalidades Futuras
1. **Notificações**: Sistema de alertas
2. **Relatórios**: Exportação avançada
3. **Integrações**: APIs externas
4. **Mobile**: App nativo
5. **IA**: Insights automáticos

---

*Esta documentação é um guia completo para entender e trabalhar com o projeto Afino Finance. Mantenha-a atualizada conforme o projeto evolui.* 