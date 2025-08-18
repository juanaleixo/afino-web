# 🧠 Base de Conhecimento Completa — Afino Finance

---

## 1. Visão Geral do Projeto

O Afino Finance é uma plataforma SaaS de gestão de investimentos, construída com Next.js, TypeScript, Tailwind CSS e Supabase. O sistema oferece controle de portfólio, eventos financeiros, diferenciação de planos (Free/Premium), autenticação robusta e interface moderna.

---

## 2. Arquitetura e Estrutura de Pastas

```
afino-web/
├── app/                # Páginas e rotas Next.js (App Router)
│   ├── dashboard/      # Área autenticada do usuário
│   ├── login/          # Login
│   ├── signup/         # Cadastro
│   ├── pricing/        # Planos
│   └── ...             # Outras páginas
├── components/         # Componentes React reutilizáveis
│   ├── ui/             # Componentes shadcn/ui
├── lib/                # Serviços, hooks e utilitários
├── styles/             # Estilos globais
├── database/           # Scripts SQL e migrações
├── public/             # Assets estáticos
├── README.md           # Documentação principal
├── SCHEMA.md           # Schema do banco de dados
├── SETUP.md            # Guia de setup
└── ...
```

---

## 3. Autenticação e Contexto Global

### 3.1. `lib/auth.tsx`
- **Contexto React** para autenticação global.
- Usa Supabase Auth para login, logout, persistência de sessão.
- Fornece hook `useAuth()` para acessar usuário, loading, funções de login/logout.
- Protege rotas via componente `ProtectedRoute`.

### 3.2. Fluxo de Autenticação
1. Usuário acessa `/login` ou `/signup`.
2. Formulário envia dados para Supabase.
3. Supabase retorna sessão; contexto atualiza estado global.
4. Rotas protegidas redirecionam se não autenticado.

### 3.3. Segurança
- Todas as operações sensíveis usam o `user_id` do contexto.
- RLS (Row Level Security) no banco garante acesso apenas aos próprios dados.

---

## 4. Dashboard e Navegação

### 4.1. `app/dashboard/page.tsx`
- Página inicial autenticada.
- Mostra resumo do portfólio, cards de estatísticas, status do plano.
- Usa hooks para buscar dados agregados do usuário.
- Navegação para contas, ativos, eventos, portfólio, relatórios, configurações.

### 4.2. Layout
- `app/layout.tsx` define o layout global, incluindo Header, Footer, ThemeSwitch.
- Navegação responsiva, tema escuro/claro.

---

## 5. Gestão de Contas

### 5.1. `app/dashboard/accounts/page.tsx`
- Lista todas as contas do usuário.
- Permite criar, editar, excluir contas.
- Cada conta tem label, moeda, data de criação.
- Integração direta com Supabase (CRUD).

### 5.2. `app/dashboard/accounts/new/page.tsx`
- Formulário para criar nova conta.
- Validação com Zod.
- Redireciona para listagem após sucesso.

---

## 6. Gestão de Ativos

### 6.1. `app/dashboard/assets/page.tsx`
- Lista ativos globais (ações, cripto, moedas, etc).
- Permite filtrar por classe.
- Visualização detalhada de cada ativo.

### 6.2. `app/dashboard/assets/new/page.tsx`
- Formulário para criar ativo customizado.
- Permite definir classe, preço manual, metadados.

---

## 7. Sistema de Eventos/Transações

### 7.1. `app/dashboard/events/page.tsx`
- Lista todos os eventos do usuário.
- Permite filtrar por tipo, excluir eventos.
- Mostra ícones e labels para cada tipo de evento.

### 7.2. `app/dashboard/events/new/page.tsx`
- Formulário dinâmico para criar eventos.
- Tipos: deposit, withdraw, buy, sell, transfer, valuation.
- Validação específica por tipo (ex: compra exige quantidade e preço).
- Campos dinâmicos: só aparecem os relevantes para o tipo.
- Integração com Supabase para inserir evento.

### 7.3. Validações e Constraints
- Frontend: Zod + lógica customizada.
- Backend: Constraints SQL (ex: CHECK em kind, NOT NULL, FKs).
- Erros comuns: constraint violation, RLS violation.

---

## 8. Sistema de Portfólio

### 8.1. `app/dashboard/portfolio/page.tsx`
- Mostra gráfico de evolução do patrimônio.
- Lista posições por ativo.
- Diferencia funcionalidades por plano (Free: mensal, Premium: diário).
- Usa `PortfolioService` para buscar dados.

### 8.2. `lib/portfolio.ts`
- Classe que centraliza todas as queries do portfólio.
- Métodos:
  - `getPortfolioData`: carrega tudo (mensal, diário, holdings)
  - `getDailySeries`, `getMonthlySeries`: séries temporais
  - `getHoldingsAt`, `getHoldingsAccounts`: snapshots
- Verifica plano do usuário antes de liberar dados premium.

### 8.3. `components/PortfolioChart.tsx`
- Gráfico de linha (Recharts) mostrando evolução do patrimônio.
- Suporta dados mensais e diários.
- Responsivo, tema escuro/claro.

---

## 9. Banco de Dados e Segurança

### 9.1. Principais Tabelas
- `accounts`: contas do usuário
- `global_assets`: catálogo de ativos
- `events`: transações/eventos
- `user_profiles`: plano do usuário

### 9.2. Row Level Security (RLS)
- Todas as tabelas sensíveis usam RLS.
- Políticas: `user_id = auth.uid()`
- Funções RPC para acesso controlado a MVs.

### 9.3. Funções RPC
- `api_portfolio_monthly`, `api_portfolio_daily`: séries temporais
- `api_holdings_at`, `api_holdings_accounts`: snapshots
- Sempre use as funções RPC no frontend, nunca leia MVs direto.

### 9.4. Materialized Views
- `portfolio_value_monthly`, `portfolio_value_daily`: agregações pré-calculadas
- Atualizadas via triggers após eventos

---

## 10. UI, Componentização e Padrões

### 10.1. Componentes shadcn/ui
- Botões, cards, inputs, selects, tabelas, formulários, badges, etc.
- Altamente reutilizáveis, estilizados com Tailwind.

### 10.2. Componentes Customizados
- `Header`, `Footer`, `PlanStatus`, `ThemeSwitch`, `ProtectedRoute`.
- Cada componente tem responsabilidade única.

### 10.3. Padrões de Código
- TypeScript estrito
- ESLint + Prettier
- Component-first
- Separação clara de responsabilidades

---

## 11. Integração com Supabase

- Cliente configurado em `lib/supabase.ts`.
- Todas as queries, inserts, updates e deletes usam Supabase.
- Tipos TypeScript para todas as entidades.
- Uso de hooks para integração reativa.

---

## 12. Troubleshooting e Dicas Avançadas

### 12.1. Erros Comuns
- **Constraint violation**: revise validação frontend e constraints SQL.
- **RLS violation**: verifique se está enviando o `user_id` correto.
- **TypeScript error**: mantenha interfaces em `lib/supabase.ts` atualizadas.
- **Auth error**: revise variáveis de ambiente e configuração do Supabase.

### 12.2. Debugging
- Use `console.log` para inspecionar dados enviados e recebidos.
- Sempre trate erros do Supabase e mostre feedback ao usuário.
- Use o painel do Supabase para logs detalhados.

### 12.3. Boas Práticas
- Sempre use funções RPC para acessar dados agregados.
- Nunca exponha chaves sensíveis no frontend.
- Mantenha o código limpo e documentado.
- Atualize a documentação sempre que fizer mudanças relevantes.

---

## 13. Referências e Recursos

- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

---

## 14. Explicação Detalhada de Arquivos (Exemplo)

### 14.1. `app/dashboard/events/new/page.tsx`

- **Importações**: Hooks, componentes de UI, validação, roteamento, notificações.
- **Schema de validação**: Zod, com regras específicas para cada tipo de evento.
- **Formulário**: React Hook Form, campos dinâmicos, integração com Supabase.
- **Função de submit**: Prepara dados, faz validação extra, insere no banco, trata erros.
- **Interface**: Campos mudam conforme o tipo de evento, feedback visual, loading.

### 14.2. `lib/portfolio.ts`

- **Classe PortfolioService**: Centraliza toda a lógica de dados do portfólio.
- **Métodos**: Carregam séries temporais, snapshots, diferenciam por plano.
- **Controle de acesso**: Só libera dados premium para usuários premium.

### 14.3. `components/ProtectedRoute.tsx`

- **Hook de autenticação**: Verifica se usuário está logado.
- **Redirecionamento**: Se não autenticado, envia para login.
- **Loading**: Mostra loading enquanto verifica sessão.

---

## 15. Como Contribuir e Evoluir

- Siga os padrões de código e arquitetura.
- Sempre escreva testes para novas funcionalidades.
- Documente toda mudança relevante.
- Use o checklist de estudo para garantir domínio do sistema.
- Sugira melhorias via issues ou pull requests.

---

*Esta base de conhecimento é viva: mantenha-a atualizada conforme o projeto evolui!*