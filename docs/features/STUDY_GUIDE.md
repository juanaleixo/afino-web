# 📖 Guia de Estudo - Afino Finance

## 🎯 Como Usar Este Guia

Este guia foi criado para você estudar e entender o projeto Afino Finance de forma estruturada. Siga a ordem sugerida para ter uma compreensão completa do sistema.

---

## 📚 Módulo 1: Fundamentos e Configuração

### 🎯 Objetivo
Entender a estrutura básica do projeto e como ele está configurado.

### 📋 Tópicos para Estudar

#### 1. **Estrutura do Projeto** (30 min)
- [ ] Ler `README.md` - Visão geral
- [ ] Explorar a estrutura de pastas
- [ ] Entender o `package.json` e dependências
- [ ] Verificar arquivos de configuração

#### 2. **Configuração do Supabase** (45 min)
- [ ] Ler `SETUP.md` - Guia de configuração
- [ ] Entender as variáveis de ambiente
- [ ] Explorar o schema do banco em `SCHEMA.md`
- [ ] Verificar as tabelas principais

#### 3. **Tecnologias Utilizadas** (30 min)
- [ ] Next.js 15 App Router
- [ ] TypeScript
- [ ] Tailwind CSS
- [ ] Supabase
- [ ] shadcn/ui

### 🔍 Exercícios Práticos
1. **Configurar o ambiente local**
2. **Criar um projeto no Supabase**
3. **Executar o setup do banco de dados**
4. **Rodar o projeto localmente**

---

## 📚 Módulo 2: Sistema de Autenticação

### 🎯 Objetivo
Compreender como funciona o sistema de autenticação e proteção de rotas.

### 📋 Tópicos para Estudar

#### 1. **Contexto de Autenticação** (30 min)
- [ ] Estudar `lib/auth.tsx`
- [ ] Entender o hook `useAuth()`
- [ ] Ver como a sessão é gerenciada
- [ ] Analisar o fluxo de login/logout

#### 2. **Proteção de Rotas** (20 min)
- [ ] Estudar `components/ProtectedRoute.tsx`
- [ ] Entender como funciona o redirecionamento
- [ ] Verificar a verificação de autenticação

#### 3. **Páginas de Autenticação** (40 min)
- [ ] Analisar `app/login/page.tsx`
- [ ] Estudar `app/signup/page.tsx`
- [ ] Entender a validação com Zod
- [ ] Verificar a integração com Supabase

### 🔍 Exercícios Práticos
1. **Criar um novo usuário**
2. **Testar o fluxo de login**
3. **Verificar a proteção de rotas**
4. **Analisar os logs de autenticação**

---

## 📚 Módulo 3: Dashboard e Navegação

### 🎯 Objetivo
Entender a estrutura do dashboard e como a navegação funciona.

### 📋 Tópicos para Estudar

#### 1. **Dashboard Principal** (30 min)
- [ ] Estudar `app/dashboard/page.tsx`
- [ ] Entender como os dados são carregados
- [ ] Analisar os componentes utilizados
- [ ] Verificar o status do plano

#### 2. **Layout e Navegação** (20 min)
- [ ] Explorar `app/layout.tsx`
- [ ] Estudar `components/Header.tsx`
- [ ] Entender a estrutura de navegação
- [ ] Verificar o tema escuro/claro

#### 3. **Componentes de Interface** (30 min)
- [ ] Explorar `components/ui/`
- [ ] Entender os componentes shadcn/ui
- [ ] Estudar `components/PlanStatus.tsx`
- [ ] Verificar a responsividade

### 🔍 Exercícios Práticos
1. **Navegar pelo dashboard**
2. **Testar a responsividade**
3. **Verificar o tema escuro/claro**
4. **Analisar os componentes utilizados**

---

## 📚 Módulo 4: Gestão de Contas

### 🎯 Objetivo
Compreender como funciona o CRUD de contas bancárias.

### 📋 Tópicos para Estudar

#### 1. **Listagem de Contas** (30 min)
- [ ] Estudar `app/dashboard/accounts/page.tsx`
- [ ] Entender como os dados são carregados
- [ ] Analisar a tabela de contas
- [ ] Verificar as operações disponíveis

#### 2. **Criação de Contas** (25 min)
- [ ] Estudar `app/dashboard/accounts/new/page.tsx`
- [ ] Entender o formulário e validação
- [ ] Analisar a integração com Supabase
- [ ] Verificar o redirecionamento

#### 3. **Operações CRUD** (20 min)
- [ ] Entender as operações de edição
- [ ] Analisar a exclusão de contas
- [ ] Verificar as validações
- [ ] Estudar o tratamento de erros

### 🔍 Exercícios Práticos
1. **Criar uma nova conta**
2. **Editar uma conta existente**
3. **Excluir uma conta**
4. **Testar as validações**

---

## 📚 Módulo 5: Gestão de Ativos

### 🎯 Objetivo
Entender como funciona o sistema de ativos e o catálogo global.

### 📋 Tópicos para Estudar

#### 1. **Listagem de Ativos** (30 min)
- [ ] Estudar `app/dashboard/assets/page.tsx`
- [ ] Entender o catálogo global
- [ ] Analisar os filtros por classe
- [ ] Verificar a estrutura dos ativos

#### 2. **Criação de Ativos** (25 min)
- [ ] Estudar `app/dashboard/assets/new/page.tsx`
- [ ] Entender o formulário de criação
- [ ] Analisar os tipos de ativos
- [ ] Verificar os metadados

#### 3. **Tipos de Ativos** (20 min)
- [ ] Entender as classes: stock, bond, fund, crypto, currency
- [ ] Analisar a estrutura de dados
- [ ] Verificar as validações
- [ ] Estudar os metadados JSON

### 🔍 Exercícios Práticos
1. **Explorar o catálogo de ativos**
2. **Criar um ativo customizado**
3. **Testar os filtros por classe**
4. **Analisar a estrutura de dados**

---

## 📚 Módulo 6: Sistema de Eventos

### 🎯 Objetivo
Compreender o sistema de eventos/transações, que é o coração da aplicação.

### 📋 Tópicos para Estudar

#### 1. **Tipos de Eventos** (30 min)
- [ ] Estudar os 6 tipos: deposit, withdraw, buy, sell, transfer, valuation
- [ ] Entender quando usar cada tipo
- [ ] Analisar as validações específicas
- [ ] Verificar os campos obrigatórios

#### 2. **Listagem de Eventos** (30 min)
- [ ] Estudar `app/dashboard/events/page.tsx`
- [ ] Entender como os eventos são listados
- [ ] Analisar as relações com ativos e contas
- [ ] Verificar as operações disponíveis

#### 3. **Criação de Eventos** (45 min)
- [ ] Estudar `app/dashboard/events/new/page.tsx`
- [ ] Entender o formulário dinâmico
- [ ] Analisar as validações por tipo
- [ ] Verificar a interface responsiva

#### 4. **Validações e Constraints** (30 min)
- [ ] Entender as constraints do banco
- [ ] Analisar as validações do frontend
- [ ] Verificar o tratamento de erros
- [ ] Estudar a interface dinâmica

### 🔍 Exercícios Práticos
1. **Criar eventos de cada tipo**
2. **Testar as validações**
3. **Verificar a interface dinâmica**
4. **Analisar os dados no banco**

---

## 📚 Módulo 7: Sistema de Portfólio

### 🎯 Objetivo
Entender como funciona o sistema de portfólio e a diferenciação por planos.

### 📋 Tópicos para Estudar

#### 1. **Serviço de Portfólio** (40 min)
- [ ] Estudar `lib/portfolio.ts`
- [ ] Entender a classe PortfolioService
- [ ] Analisar o controle de acesso por plano
- [ ] Verificar os métodos disponíveis

#### 2. **Página de Portfólio** (30 min)
- [ ] Estudar `app/dashboard/portfolio/page.tsx`
- [ ] Entender como os dados são carregados
- [ ] Analisar a diferenciação por plano
- [ ] Verificar os componentes utilizados

#### 3. **Gráfico do Portfólio** (25 min)
- [ ] Estudar `components/PortfolioChart.tsx`
- [ ] Entender a biblioteca Recharts
- [ ] Analisar os dados mensais vs diários
- [ ] Verificar a responsividade

#### 4. **Controle de Acesso** (20 min)
- [ ] Entender a verificação de plano
- [ ] Analisar as funcionalidades premium
- [ ] Verificar as limitações do plano free
- [ ] Estudar o upgrade de plano

### 🔍 Exercícios Práticos
1. **Testar com usuário free**
2. **Testar com usuário premium**
3. **Verificar as diferenças de funcionalidades**
4. **Analisar os dados carregados**

---

## 📚 Módulo 8: Banco de Dados e Segurança

### 🎯 Objetivo
Compreender a estrutura do banco de dados e as medidas de segurança.

### 📋 Tópicos para Estudar

#### 1. **Schema do Banco** (45 min)
- [ ] Estudar `SCHEMA.md` completamente
- [ ] Entender as tabelas principais
- [ ] Analisar as relações entre tabelas
- [ ] Verificar as constraints

#### 2. **Row Level Security** (30 min)
- [ ] Entender o conceito de RLS
- [ ] Analisar as políticas de segurança
- [ ] Verificar como funciona na prática
- [ ] Estudar as funções de segurança

#### 3. **Funções RPC** (30 min)
- [ ] Entender as funções `api_*`
- [ ] Analisar o controle de acesso
- [ ] Verificar a performance
- [ ] Estudar os parâmetros

#### 4. **Materialized Views** (20 min)
- [ ] Entender o conceito de MVs
- [ ] Analisar as views utilizadas
- [ ] Verificar a atualização
- [ ] Estudar a performance

### 🔍 Exercícios Práticos
1. **Explorar as tabelas no Supabase**
2. **Testar as políticas de RLS**
3. **Executar as funções RPC**
4. **Analisar as Materialized Views**

---

## 📚 Módulo 9: Configurações e Utilitários

### 🎯 Objetivo
Entender os utilitários, configurações e padrões do projeto.

### 📋 Tópicos para Estudar

#### 1. **Configurações do Usuário** (30 min)
- [ ] Estudar `app/dashboard/settings/page.tsx`
- [ ] Entender o gerenciamento de perfil
- [ ] Analisar as configurações de notificação
- [ ] Verificar as preferências

#### 2. **Utilitários** (25 min)
- [ ] Estudar `lib/utils.ts`
- [ ] Entender a função `cn()`
- [ ] Analisar os helpers disponíveis
- [ ] Verificar a formatação

#### 3. **Tipos TypeScript** (30 min)
- [ ] Estudar `lib/supabase.ts`
- [ ] Entender as interfaces
- [ ] Analisar os tipos customizados
- [ ] Verificar a tipagem

#### 4. **Padrões de Código** (20 min)
- [ ] Entender os padrões utilizados
- [ ] Analisar a estrutura de componentes
- [ ] Verificar as convenções
- [ ] Estudar a organização

### 🔍 Exercícios Práticos
1. **Configurar o perfil do usuário**
2. **Testar os utilitários**
3. **Analisar os tipos TypeScript**
4. **Verificar os padrões de código**

---

## 📚 Módulo 10: Debugging e Troubleshooting

### 🎯 Objetivo
Aprender a identificar e resolver problemas comuns no projeto.

### 📋 Tópicos para Estudar

#### 1. **Problemas Comuns** (30 min)
- [ ] Erros de constraint no banco
- [ ] Problemas de RLS
- [ ] Erros de TypeScript
- [ ] Problemas de autenticação

#### 2. **Logs e Debugging** (25 min)
- [ ] Entender os logs úteis
- [ ] Analisar erros do Supabase
- [ ] Verificar logs do console
- [ ] Estudar debugging

#### 3. **Validação e Tratamento de Erros** (30 min)
- [ ] Entender as validações
- [ ] Analisar o tratamento de erros
- [ ] Verificar feedback ao usuário
- [ ] Estudar prevenção de erros

### 🔍 Exercícios Práticos
1. **Simular erros comuns**
2. **Testar o tratamento de erros**
3. **Analisar os logs**
4. **Verificar as validações**

---

## 🎯 Projeto Final

### 📋 Desafio Completo
Crie uma nova funcionalidade para o projeto:

1. **Escolha uma funcionalidade**:
   - Sistema de notificações
   - Relatórios avançados
   - Exportação de dados
   - Dashboard personalizado

2. **Implemente seguindo os padrões**:
   - Use TypeScript
   - Implemente validações
   - Adicione testes
   - Documente o código

3. **Apresente o resultado**:
   - Demonstre a funcionalidade
   - Explique as decisões técnicas
   - Mostre o código
   - Discuta melhorias

---

## 📚 Recursos Adicionais

### 🔗 Links Úteis
- [Next.js Documentation](https://nextjs.org/docs)
- [Supabase Documentation](https://supabase.com/docs)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com/)

### 📖 Livros Recomendados
- "Learning TypeScript" - Josh Goldberg
- "Next.js in Action" - Phil Sturgeon
- "Database Design for Mere Mortals" - Michael Hernandez

### 🎥 Vídeos e Cursos
- Next.js 15 Tutorial
- Supabase Masterclass
- TypeScript Fundamentals
- React Patterns

---

## 🎯 Checklist de Conclusão

### ✅ Fundamentos
- [ ] Entendi a estrutura do projeto
- [ ] Configurei o ambiente local
- [ ] Conheço as tecnologias utilizadas

### ✅ Autenticação
- [ ] Compreendo o sistema de auth
- [ ] Entendo a proteção de rotas
- [ ] Posso criar e gerenciar usuários

### ✅ Funcionalidades Core
- [ ] Domino o CRUD de contas
- [ ] Entendo o sistema de ativos
- [ ] Compreendo os eventos/transações
- [ ] Conheço o sistema de portfólio

### ✅ Banco e Segurança
- [ ] Entendo o schema do banco
- [ ] Compreendo RLS e segurança
- [ ] Conheço as funções RPC
- [ ] Entendo as Materialized Views

### ✅ Desenvolvimento
- [ ] Posso debugar problemas
- [ ] Entendo os padrões de código
- [ ] Conheço as melhores práticas
- [ ] Posso implementar novas funcionalidades

---

## 🎉 Parabéns!

Se você completou todos os módulos e checklists, você tem um conhecimento sólido do projeto Afino Finance e está pronto para:

- ✅ Contribuir com o projeto
- ✅ Implementar novas funcionalidades
- ✅ Resolver problemas e bugs
- ✅ Manter e evoluir o código
- ✅ Explicar o projeto para outros desenvolvedores

**Continue estudando e praticando! O conhecimento só se consolida com a prática constante.** 🚀 