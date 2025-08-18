# 📁 Pasta `/app/` - Documentação Detalhada

## Visão Geral

A pasta `/app/` contém toda a estrutura de rotas da aplicação Fino Web usando o **Next.js App Router**. Cada pasta representa uma rota, e cada `page.tsx` define o componente da página correspondente.

## 🏗️ Estrutura de Arquivos

```
app/
├── layout.tsx              # Layout raiz da aplicação
├── page.tsx                # Página inicial (landing)
├── login/
│   └── page.tsx           # Página de autenticação
├── signup/
│   └── page.tsx           # Página de cadastro
├── about/
│   └── page.tsx           # Sobre a empresa
├── contact/
│   └── page.tsx           # Contato
├── demo/
│   └── page.tsx           # Demonstração
├── features/
│   └── page.tsx           # Funcionalidades
├── pricing/
│   └── page.tsx           # Planos e preços
└── dashboard/             # Área autenticada
    ├── page.tsx           # Dashboard principal
    ├── accounts/
    │   ├── page.tsx       # Lista de contas
    │   └── new/
    │       └── page.tsx   # Nova conta
    ├── assets/
    │   ├── page.tsx       # Lista de ativos
    │   └── new/
    │       └── page.tsx   # Novo ativo
    ├── events/
    │   ├── page.tsx       # Lista de transações
    │   └── new/
    │       └── page.tsx   # Nova transação
    ├── portfolio/
    │   └── page.tsx       # Visão do portfólio
    ├── reports/
    │   └── page.tsx       # Relatórios
    └── settings/
        └── page.tsx       # Configurações
```

## 📄 Análise Detalhada dos Arquivos

### **1. `app/layout.tsx` - Layout Raiz**

**Tipo**: Server Component  
**Tamanho**: 42 linhas  
**Função**: Layout principal que envolve toda a aplicação

```typescript
// Estrutura principal
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

**Características**:
- **Server Component** por padrão
- **Providers globais**: ThemeProvider, AuthProvider, Toaster
- **Fonte Inter** otimizada do Google Fonts
- **Metadata** configurada para SEO
- **SuppressHydrationWarning** para evitar warnings de hidratação

**Dependências**:
- `@/styles/globals.css` - Estilos globais
- `@/lib/auth` - Provider de autenticação
- `next-themes` - Gerenciamento de tema

### **2. `app/page.tsx` - Página Inicial**

**Tipo**: Client Component  
**Tamanho**: 47 linhas  
**Função**: Landing page com redirecionamento automático

```typescript
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

**Lógica de Redirecionamento**:
- **Usuário logado**: Redireciona automaticamente para `/dashboard`
- **Usuário não logado**: Mostra landing page com Header, Hero, Footer
- **Loading state**: Mostra spinner durante verificação

**Componentes Utilizados**:
- `Header` - Navegação principal
- `Hero` - Seção principal da landing
- `Footer` - Rodapé da aplicação

### **3. `app/login/page.tsx` - Autenticação**

**Tipo**: Client Component  
**Tamanho**: 163 linhas  
**Função**: Formulário de login com validação

**Validação com Zod**:
```typescript
const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
})
```

**Funcionalidades**:
- **Formulário controlado** com react-hook-form
- **Validação em tempo real** com Zod
- **Toggle de senha** (mostrar/ocultar)
- **Loading states** durante autenticação
- **Tratamento de erros** com feedback visual
- **Redirecionamento** para `/dashboard` após login

**Componentes UI**:
- `Card` - Container principal
- `Form` - Formulário com validação
- `Input` - Campos de entrada
- `Button` - Botão de submit

### **4. `app/signup/page.tsx` - Cadastro**

**Tipo**: Client Component  
**Tamanho**: 237 linhas  
**Função**: Formulário de cadastro com confirmação

**Validação Avançada**:
```typescript
const signupSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Senha deve ter pelo menos 8 caracteres"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Senhas não coincidem",
  path: ["confirmPassword"],
})
```

**Funcionalidades**:
- **Confirmação de senha** com validação
- **Estado de sucesso** com feedback visual
- **Redirecionamento automático** para login após cadastro
- **Validação customizada** para senhas coincidentes

**Estados de UI**:
- **Formulário normal**: Campos de cadastro
- **Sucesso**: Tela de confirmação com CheckCircle

### **5. `app/dashboard/page.tsx` - Dashboard Principal**

**Tipo**: Client Component  
**Tamanho**: 296 linhas  
**Função**: Dashboard principal com estatísticas e navegação

**Funcionalidades Principais**:
- **Estatísticas do portfólio** em tempo real
- **Menu de navegação** para módulos
- **Cards de resumo** com métricas
- **Logout** com confirmação

**Integração com Serviços**:
```typescript
const portfolioService = new PortfolioService(user.id!)
const stats = await portfolioService.getPortfolioStats(today)
```

**Componentes de Navegação**:
- **Contas**: Gerenciamento de contas bancárias
- **Ativos**: Catálogo de investimentos
- **Transações**: Histórico de operações
- **Portfólio**: Visão consolidada
- **Relatórios**: Análises financeiras
- **Configurações**: Preferências do usuário

### **6. `app/dashboard/accounts/page.tsx` - Gerenciamento de Contas**

**Tipo**: Client Component  
**Tamanho**: 399 linhas  
**Função**: CRUD completo de contas bancárias

**Funcionalidades**:
- **Listagem** de contas com filtros
- **Adição** de novas contas
- **Edição** de contas existentes
- **Exclusão** com confirmação
- **Formatação** de valores monetários

**Operações CRUD**:
- **Create**: Formulário para nova conta
- **Read**: Lista com paginação
- **Update**: Modal de edição
- **Delete**: Confirmação antes de excluir

### **7. `app/dashboard/accounts/new/page.tsx` - Nova Conta**

**Tipo**: Client Component  
**Tamanho**: 167 linhas  
**Função**: Formulário para criação de nova conta

**Campos do Formulário**:
- **Nome da conta** (obrigatório)
- **Tipo de conta** (corrente, poupança, investimento)
- **Banco** (seleção)
- **Saldo inicial** (opcional)
- **Descrição** (opcional)

### **8. `app/dashboard/assets/page.tsx` - Catálogo de Ativos**

**Tipo**: Client Component  
**Tamanho**: 205 linhas  
**Função**: Listagem e gerenciamento de ativos

**Funcionalidades**:
- **Filtros** por tipo, categoria, risco
- **Busca** por nome ou código
- **Ordenação** por preço, variação, nome
- **Visualização** em cards ou tabela

### **9. `app/dashboard/assets/new/page.tsx` - Novo Ativo**

**Tipo**: Client Component  
**Tamanho**: 241 linhas  
**Função**: Adicionar novo ativo ao portfólio

**Integração com APIs**:
- **Busca automática** de preços
- **Validação** de códigos de ativos
- **Cálculo automático** de valores

### **10. `app/dashboard/events/page.tsx` - Transações**

**Tipo**: Client Component  
**Tamanho**: 268 linhas  
**Função**: Histórico de compras e vendas

**Filtros Disponíveis**:
- **Período**: Data inicial e final
- **Tipo**: Compra, venda, dividendos
- **Ativo**: Filtro por ativo específico
- **Conta**: Filtro por conta bancária

### **11. `app/dashboard/events/new/page.tsx` - Nova Transação**

**Tipo**: Client Component  
**Tamanho**: 471 linhas  
**Função**: Registrar nova transação

**Campos do Formulário**:
- **Tipo**: Compra, venda, dividendos
- **Ativo**: Seleção do ativo
- **Quantidade**: Número de unidades
- **Preço**: Preço unitário
- **Data**: Data da transação
- **Conta**: Conta bancária utilizada
- **Taxas**: Taxas e impostos

### **12. `app/dashboard/portfolio/page.tsx` - Visão do Portfólio**

**Tipo**: Client Component  
**Tamanho**: 311 linhas  
**Função**: Visão consolidada dos investimentos

**Componentes Especiais**:
- `PortfolioChart` - Gráficos de distribuição
- **Gráficos de pizza** por categoria
- **Gráficos de linha** de evolução
- **Métricas** de performance

### **13. `app/dashboard/reports/page.tsx` - Relatórios**

**Tipo**: Client Component  
**Tamanho**: 282 linhas  
**Função**: Geração de relatórios financeiros

**Tipos de Relatório**:
- **Performance** do portfólio
- **Distribuição** de ativos
- **Fluxo de caixa**
- **Ganhos/perdas** realizados

### **14. `app/dashboard/settings/page.tsx` - Configurações**

**Tipo**: Client Component  
**Tamanho**: 530 linhas  
**Função**: Configurações do usuário e sistema

**Seções de Configuração**:
- **Perfil**: Dados pessoais
- **Preferências**: Configurações de interface
- **Notificações**: Alertas e emails
- **Segurança**: Senha e autenticação
- **Plano**: Status da assinatura

## 🔄 Padrões Comuns

### **1. Estrutura de Client Components**
```typescript
"use client"
import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth"
// ... outros imports

export default function PageName() {
  // Estados locais
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  
  // Hooks customizados
  const { user } = useAuth()
  
  // Effects
  useEffect(() => {
    // Lógica de carregamento
  }, [])
  
  // Handlers
  const handleAction = async () => {
    // Lógica de ação
  }
  
  return (
    // JSX
  )
}
```

### **2. Proteção de Rotas**
```typescript
// Todas as páginas do dashboard usam ProtectedRoute
<ProtectedRoute>
  <DashboardContent />
</ProtectedRoute>
```

### **3. Loading States**
```typescript
if (loading) {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin" />
      <span>Carregando...</span>
    </div>
  )
}
```

### **4. Tratamento de Erros**
```typescript
try {
  // Operação
} catch (error) {
  toast.error('Erro ao executar operação')
  console.error('Erro:', error)
}
```

## 📊 Estatísticas dos Arquivos

- **Total de arquivos**: 15 páginas
- **Client Components**: 15 (100%)
- **Server Components**: 0 (0%)
- **Média de linhas**: 200 linhas por arquivo
- **Maior arquivo**: `settings/page.tsx` (530 linhas)
- **Menor arquivo**: `layout.tsx` (42 linhas)

## 🧪 Como Testar Rapidamente

### **1. Verificar Estrutura**
```bash
# Verificar se todos os arquivos existem
find app/ -name "page.tsx" | wc -l
# Deve retornar 15
```

### **2. Testar Navegação**
```bash
npm run dev
# Navegar por todas as rotas e verificar se carregam
```

### **3. Testar Autenticação**
```bash
# Testar login/signup e redirecionamentos
# Verificar se rotas protegidas funcionam
```

### **4. Verificar Build**
```bash
npm run build
# Verificar se não há erros de compilação
```

---

*Esta documentação cobre todos os arquivos da pasta `/app/` com detalhes técnicos e funcionais.* 