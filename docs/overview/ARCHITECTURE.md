# 🏗️ Arquitetura - Fino Web

## Visão Geral

O **Fino Web** é uma aplicação Next.js 14 que utiliza o **App Router** para criar um hub financeiro inteligente. A arquitetura segue o padrão de **Server Components** por padrão, com **Client Components** apenas quando necessário para interatividade.

## 🎯 Princípios Arquiteturais

### 1. **Server-First Approach**
- **Server Components** como padrão (`app/layout.tsx`, páginas principais)
- **Client Components** apenas para:
  - Interatividade (`"use client"`)
  - Hooks do React (`useState`, `useEffect`)
  - Event handlers

### 2. **Separação de Responsabilidades**
```
app/           # Rotas e páginas (Server Components)
components/    # Componentes reutilizáveis
├── ui/        # Componentes base (shadcn/ui)
└── *.tsx      # Componentes de negócio
lib/           # Serviços e utilitários
hooks/         # Hooks customizados
```

### 3. **Autenticação Centralizada**
- **Context API** para estado global de autenticação
- **Supabase Auth** como provedor de identidade
- **ProtectedRoute** para proteção de rotas

## 🏛️ Estrutura de Camadas

### **Camada de Apresentação** (`/app/`)
```typescript
// app/layout.tsx - Layout raiz
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="system">
          <AuthProvider>
            {children}
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
```

**Características:**
- **Server Component** por padrão
- **Providers** globais (Theme, Auth, Toaster)
- **Fontes** otimizadas (Inter)
- **Metadata** configurada

### **Camada de Componentes** (`/components/`)

#### **UI Base** (`/components/ui/`)
- **shadcn/ui** como sistema de design
- **14 componentes** base (button, card, dialog, form, etc.)
- **Tailwind CSS** para estilização
- **Radix UI** para acessibilidade

#### **Componentes de Negócio**
- **17 componentes** específicos do domínio
- **Header, Footer, Hero** - Landing page
- **PortfolioChart, PlanStatus** - Dashboard
- **ProtectedRoute** - Segurança

### **Camada de Serviços** (`/lib/`)

#### **Autenticação** (`lib/auth.tsx`)
```typescript
// Context API para estado global
const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  // ... lógica de autenticação
}
```

#### **Banco de Dados** (`lib/supabase.ts`)
- **Cliente Supabase** configurado
- **Tipagem TypeScript** completa
- **Variáveis de ambiente** seguras

#### **Portfólio** (`lib/portfolio.ts`)
- **Lógica de negócio** para investimentos
- **Serviços** para cálculos financeiros
- **Integração** com Supabase

### **Camada de Hooks** (`/hooks/`)
- **useUserPlan** - Gerenciamento de planos
- **Custom hooks** para lógica reutilizável

## 🔄 Fluxo de Dados

### **1. Autenticação**
```
Login → AuthProvider → Supabase → User Context → ProtectedRoute
```

### **2. Dashboard**
```
User → PortfolioService → Supabase → Stats → UI Components
```

### **3. Componentes**
```
Server Component → Client Component → Hook → Service → Database
```

## 🛡️ Segurança

### **Proteção de Rotas**
```typescript
// components/ProtectedRoute.tsx
export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])
  
  return <>{children}</>
}
```

### **Middleware de Autenticação**
- **Client-side** protection via `ProtectedRoute`
- **Server-side** validation via Supabase
- **Context API** para estado global

## ⚡ Performance

### **Otimizações Implementadas**
```typescript
// next.config.ts
const nextConfig: NextConfig = {
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons'],
  },
  images: {
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
}
```

### **Estratégias**
- **Server Components** para renderização estática
- **Lazy loading** de componentes pesados
- **Bundle optimization** via Next.js
- **Image optimization** automática

## 🎨 Sistema de Design

### **Tema e Estilos**
- **Tailwind CSS** para utilitários
- **CSS Variables** para temas
- **shadcn/ui** para componentes base
- **Lucide React** para ícones

### **Responsividade**
- **Mobile-first** approach
- **Breakpoints** padronizados
- **Flexbox/Grid** para layouts

## 🔧 Configuração

### **TypeScript**
- **Strict mode** habilitado
- **Path mapping** configurado
- **Type safety** em toda aplicação

### **ESLint**
- **Next.js** rules
- **TypeScript** integration
- **Build-time** validation

## 📊 Dependências Internas

### **Quem Chama Quem**
```
app/page.tsx → Header, Hero, Footer
app/dashboard/page.tsx → ProtectedRoute, PortfolioService
components/Header.tsx → ThemeSwitch, useAuth
lib/auth.tsx → supabase.ts
```

### **Imports Principais**
- `@/components/ui/*` - Componentes base
- `@/lib/*` - Serviços e utilitários
- `@/hooks/*` - Hooks customizados
- `@/styles/globals.css` - Estilos globais

## 🧪 Como Testar Rapidamente

### **1. Verificar Estrutura**
```bash
# Verificar se todos os arquivos estão no lugar
ls -la app/ components/ lib/ hooks/
```

### **2. Testar Autenticação**
```bash
# Verificar se o AuthProvider está funcionando
npm run dev
# Acessar /login e tentar fazer login
```

### **3. Verificar Build**
```bash
# Testar se a aplicação compila
npm run build
```

### **4. Verificar Tipos**
```bash
# Verificar se não há erros de TypeScript
npx tsc --noEmit
```

---

*Esta arquitetura garante escalabilidade, manutenibilidade e performance otimizada para o hub financeiro.* 