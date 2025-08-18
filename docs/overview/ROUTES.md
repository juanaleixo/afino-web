# 🛣️ Rotas - Fino Web

## Visão Geral

O **Fino Web** utiliza o **Next.js App Router** com estrutura de pastas baseada em arquivos. Cada pasta em `/app/` representa uma rota, e cada `page.tsx` define o componente da página.

## 🌳 Árvore de Rotas

```
/                           # Página inicial (landing)
├── about/                  # Sobre a empresa
├── contact/                # Contato
├── demo/                   # Demonstração
├── features/               # Funcionalidades
├── login/                  # Autenticação
├── pricing/                # Planos e preços
├── signup/                 # Cadastro
└── dashboard/              # Área autenticada
    ├── accounts/           # Contas bancárias
    │   └── new/            # Nova conta
    ├── assets/             # Ativos e investimentos
    │   └── new/            # Novo ativo
    ├── events/             # Transações
    │   └── new/            # Nova transação
    ├── portfolio/          # Visão do portfólio
    ├── reports/            # Relatórios
    └── settings/           # Configurações
```

## 📄 Mapeamento de Páginas

### **Páginas Públicas** (Não Autenticadas)

#### `/` - Página Inicial
```typescript
// app/page.tsx
"use client"
export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.push("/dashboard") // Redirecionamento automático
    }
  }, [user, loading, router])
}
```
- **Tipo**: Client Component
- **Autenticação**: Redireciona usuários logados para `/dashboard`
- **Componentes**: Header, Hero, Footer
- **Comportamento**: Landing page para usuários não autenticados

#### `/login` - Autenticação
- **Tipo**: Client Component
- **Autenticação**: Formulário de login
- **Redirecionamento**: Para `/dashboard` após login bem-sucedido
- **Serviço**: `lib/auth.tsx`

#### `/signup` - Cadastro
- **Tipo**: Client Component
- **Autenticação**: Formulário de cadastro
- **Validação**: Email e senha
- **Serviço**: `lib/auth.tsx`

#### `/about`, `/contact`, `/demo`, `/features`, `/pricing`
- **Tipo**: Server Components (presumido)
- **Autenticação**: Não requerida
- **Conteúdo**: Páginas informativas estáticas

### **Páginas Autenticadas** (Dashboard)

#### `/dashboard` - Dashboard Principal
```typescript
// app/dashboard/page.tsx
"use client"
export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const [portfolioStats, setPortfolioStats] = useState<any>(null)
  
  // Carrega estatísticas do portfólio
  useEffect(() => {
    const loadDashboardStats = async () => {
      const portfolioService = new PortfolioService(user.id!)
      const stats = await portfolioService.getPortfolioStats(today)
      setPortfolioStats(stats)
    }
  }, [user?.id])
}
```
- **Tipo**: Client Component
- **Proteção**: `ProtectedRoute`
- **Dados**: Estatísticas do portfólio em tempo real
- **Componentes**: Cards de resumo, gráficos, menu de navegação

#### `/dashboard/accounts` - Gerenciamento de Contas
- **Tipo**: Client Component
- **Proteção**: `ProtectedRoute`
- **Funcionalidade**: Lista e gerencia contas bancárias
- **CRUD**: Create, Read, Update, Delete

#### `/dashboard/accounts/new` - Nova Conta
- **Tipo**: Client Component
- **Proteção**: `ProtectedRoute`
- **Funcionalidade**: Formulário para adicionar nova conta
- **Validação**: Dados bancários

#### `/dashboard/assets` - Catálogo de Ativos
- **Tipo**: Client Component
- **Proteção**: `ProtectedRoute`
- **Funcionalidade**: Lista de ativos disponíveis
- **Filtros**: Por tipo, categoria, risco

#### `/dashboard/assets/new` - Novo Ativo
- **Tipo**: Client Component
- **Proteção**: `ProtectedRoute`
- **Funcionalidade**: Adicionar novo ativo ao portfólio
- **Integração**: APIs de preços em tempo real

#### `/dashboard/events` - Transações
- **Tipo**: Client Component
- **Proteção**: `ProtectedRoute`
- **Funcionalidade**: Histórico de compras e vendas
- **Filtros**: Por data, tipo, ativo

#### `/dashboard/events/new` - Nova Transação
- **Tipo**: Client Component
- **Proteção**: `ProtectedRoute`
- **Funcionalidade**: Registrar nova transação
- **Validação**: Quantidade, preço, data

#### `/dashboard/portfolio` - Visão do Portfólio
- **Tipo**: Client Component
- **Proteção**: `ProtectedRoute`
- **Funcionalidade**: Visão consolidada dos investimentos
- **Componentes**: `PortfolioChart`, gráficos de distribuição

#### `/dashboard/reports` - Relatórios
- **Tipo**: Client Component
- **Proteção**: `ProtectedRoute`
- **Funcionalidade**: Relatórios financeiros
- **Exportação**: PDF, Excel

#### `/dashboard/settings` - Configurações
- **Tipo**: Client Component
- **Proteção**: `ProtectedRoute`
- **Funcionalidade**: Configurações do usuário
- **Componentes**: `PlanStatus`, preferências

## 🛡️ Middleware e Proteção

### **ProtectedRoute Component**
```typescript
// components/ProtectedRoute.tsx
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login") // Redirecionamento para login
    }
  }, [user, loading, router])
}
```

**Aplicado em:**
- `/dashboard/*` - Todas as rotas do dashboard
- Verificação automática de autenticação
- Loading state durante verificação

### **Redirecionamentos Automáticos**
- **Usuário logado** acessando `/` → `/dashboard`
- **Usuário não logado** acessando `/dashboard/*` → `/login`
- **Logout** → `/` (landing page)

## 📱 Responsividade

### **Breakpoints Utilizados**
- **Mobile**: < 768px
- **Tablet**: 768px - 1024px
- **Desktop**: > 1024px

### **Layout Adaptativo**
- **Dashboard**: Sidebar colapsável em mobile
- **Formulários**: Stack vertical em mobile
- **Gráficos**: Responsivos com recharts

## ⚡ Performance

### **Loading States**
```typescript
// Loading padrão para todas as páginas protegidas
if (loading) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin" />
      <span>Carregando...</span>
    </div>
  )
}
```

### **Lazy Loading**
- **Componentes pesados**: PortfolioChart, gráficos
- **Páginas**: Carregamento sob demanda
- **Imagens**: Otimização automática via Next.js

## 🔄 Navegação

### **Client-Side Navigation**
```typescript
import Link from "next/link"
import { useRouter } from "next/navigation"

// Navegação declarativa
<Link href="/dashboard/accounts">Contas</Link>

// Navegação programática
const router = useRouter()
router.push("/dashboard")
```

### **Breadcrumbs**
- **Dashboard**: Home > [Módulo Atual]
- **Subpáginas**: Home > [Módulo] > [Ação]

## 🧪 Como Testar Rapidamente

### **1. Testar Rotas Públicas**
```bash
npm run dev
# Acessar: http://localhost:3000/
# Verificar redirecionamento para /dashboard se logado
```

### **2. Testar Autenticação**
```bash
# Acessar: http://localhost:3000/login
# Fazer login e verificar redirecionamento para /dashboard
```

### **3. Testar Rotas Protegidas**
```bash
# Acessar: http://localhost:3000/dashboard
# Verificar se redireciona para /login se não autenticado
```

### **4. Testar Navegação**
```bash
# Logado, navegar entre módulos do dashboard
# Verificar se todas as rotas funcionam
```

---

*Este mapeamento garante navegação fluida e segura em toda a aplicação.* 