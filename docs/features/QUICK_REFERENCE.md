# ⚡ Referência Rápida - Afino Finance

## 🎯 Visão Geral
SaaS de gestão financeira com Next.js 15, TypeScript, Tailwind CSS e Supabase.

---

## 📁 Estrutura de Arquivos

### 🏠 Páginas Principais
```
app/
├── page.tsx                    # Landing page
├── login/page.tsx             # Login
├── signup/page.tsx            # Cadastro
├── pricing/page.tsx           # Planos
└── dashboard/                 # Área autenticada
    ├── page.tsx              # Dashboard principal
    ├── accounts/             # Gestão de contas
    ├── assets/               # Gestão de ativos
    ├── events/               # Eventos/transações
    ├── portfolio/            # Portfólio
    ├── reports/              # Relatórios
    └── settings/             # Configurações
```

### 🔧 Arquivos de Configuração
```
lib/
├── auth.tsx                  # Contexto de autenticação
├── supabase.ts              # Cliente e tipos
├── portfolio.ts             # Serviço de portfólio
└── utils.ts                 # Utilitários

components/
├── ui/                      # Componentes shadcn/ui
├── Header.tsx               # Cabeçalho
├── Footer.tsx               # Rodapé
├── ProtectedRoute.tsx       # Proteção de rotas
└── PlanStatus.tsx           # Status do plano
```

---

## 🗄️ Banco de Dados

### 📊 Tabelas Principais
```sql
-- Contas do usuário
accounts (id, user_id, label, currency, created_at)

-- Catálogo de ativos
global_assets (id, symbol, class, currency, manual_price, meta)

-- Eventos/transações
events (id, user_id, asset_id, account_id, tstamp, kind, units_delta, price_override)

-- Perfis de usuário
user_profiles (user_id, plan)
```

### 🔒 Segurança (RLS)
- Todas as tabelas têm Row Level Security
- Política: `user_id = auth.uid()`
- Funções RPC para acesso controlado

---

## 📊 Tipos de Eventos

| Tipo | Descrição | Campos Obrigatórios |
|------|-----------|-------------------|
| `deposit` | Depósito | `units_delta > 0` |
| `withdraw` | Saque | `units_delta > 0` |
| `buy` | Compra | `units_delta > 0`, `price_override > 0` |
| `sell` | Venda | `units_delta > 0`, `price_override > 0` |
| `transfer` | Transferência | `units_delta ≠ 0` |
| `valuation` | Avaliação | `price_override > 0` |

---

## 🎯 Funcionalidades por Plano

### 📋 Free
- ✅ Dashboard básico
- ✅ Gestão de contas e ativos
- ✅ Eventos e transações
- ✅ Série mensal do portfólio
- ✅ Snapshot atual por ativo

### 👑 Premium
- ✅ Série diária do portfólio
- ✅ Detalhamento por conta+ativo
- ✅ Snapshot por qualquer data
- ✅ Gráficos avançados
- ✅ Relatórios detalhados

---

## 🔧 Comandos Úteis

### 🚀 Desenvolvimento
```bash
npm run dev          # Iniciar servidor de desenvolvimento
npm run build        # Build para produção
npm run start        # Iniciar servidor de produção
npm run lint         # Executar linter
```

### 📦 Instalação
```bash
npm install          # Instalar dependências
```

---

## 🔐 Autenticação

### Hooks Principais
```typescript
const { user, signIn, signOut, loading } = useAuth()
```

### Proteção de Rotas
```tsx
<ProtectedRoute>
  <DashboardContent />
</ProtectedRoute>
```

---

## 📝 Validações

### Zod Schemas
```typescript
// Login
const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres")
})

// Conta
const accountSchema = z.object({
  label: z.string().min(1, "Nome da conta é obrigatório"),
  currency: z.enum(['BRL', 'USD', 'EUR'])
})

// Evento
const eventSchema = z.object({
  asset_id: z.string().min(1, "Ativo é obrigatório"),
  kind: z.enum(['deposit', 'withdraw', 'buy', 'sell', 'transfer', 'valuation']),
  // ... validações específicas por tipo
})
```

---

## 🎨 Componentes UI

### Principais Componentes
```tsx
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
```

---

## 🔍 Debugging

### Logs Úteis
```typescript
// Debug de dados
console.log('Dados sendo enviados:', data)

// Debug de erros
console.error('Erro do Supabase:', error)

// Debug de estado
console.log('Estado atual:', state)
```

### Problemas Comuns
1. **Constraint Error**: Verificar validação e constraints do banco
2. **RLS Error**: Verificar se `user_id` está sendo enviado
3. **TypeScript Error**: Atualizar interfaces em `lib/supabase.ts`
4. **Auth Error**: Verificar configuração do Supabase

---

## 📚 Serviços

### PortfolioService
```typescript
class PortfolioService {
  async getPortfolioData(dateRange, date)     // Dados completos
  async getDailySeries(from, to)              // Série diária (premium)
  async getMonthlySeries(from, to)            // Série mensal (free)
  async getHoldingsAt(date)                   // Posições por ativo
  async getHoldingsAccounts(date)             // Posições por conta (premium)
}
```

---

## 🌐 Variáveis de Ambiente

### `.env.local`
```env
NEXT_PUBLIC_SUPABASE_URL=sua_url_do_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=sua_chave_anonima_do_supabase
```

---

## 📊 Interfaces TypeScript

### Principais Interfaces
```typescript
interface User { id: string; email: string; created_at: string }
interface Account { id: string; user_id: string; label: string; currency: string }
interface Asset { id: string; symbol: string; class: string; currency: string }
interface Event { id: string; user_id: string; asset_id: string; kind: string }
interface PortfolioDaily { date: string; total_value: number }
interface PortfolioMonthly { month_eom: string; total_value: number }
```

---

## 🎯 Fluxo de Dados

```
Usuário → Formulário → Validação → Supabase → Banco → Resposta → Interface
```

---

## 🔄 Controle de Acesso

```
Autenticação → Verificação de Plano → Carregamento de Dados → Renderização
```

---

## 📖 Documentação Completa

- `DOCUMENTATION.md` - Documentação detalhada
- `STUDY_GUIDE.md` - Guia de estudo estruturado
- `README.md` - Visão geral do projeto
- `SETUP.md` - Guia de configuração
- `SCHEMA.md` - Schema completo do banco

---

*Esta referência rápida contém as informações mais importantes para trabalhar com o projeto. Para detalhes completos, consulte a documentação completa.* 