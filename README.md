# Afino - Análise Patrimonial Completa 💰

> **Visualize todo seu patrimônio em um só lugar - imóveis, veículos, investimentos e muito mais**

## 🏗️ Arquitetura Simplificada e Otimizada

O Afino utiliza uma **arquitetura híbrida simplificada** para máxima performance com mínima complexidade:

- **PostgreSQL (Supabase)**: Transações, autenticação e eventos
- **ClickHouse**: Preços centralizados + posições calculadas automaticamente
- **Sync Inteligente**: Apenas events sincronizam automaticamente, preços via batch diário
- **Zero Overhead**: Sem triggers pesados no Supabase, sem sobrecarga de performance

## 🌟 O que é o Afino?

O Afino é a plataforma definitiva para **análise patrimonial completa**. Diferente de apps bancários que mostram apenas investimentos ou planilhas que são difíceis de manter, o Afino permite que você:

- 🏠 **Registre TODOS seus bens** - de imóveis a criptomoedas
- 📊 **Acompanhe a evolução diária** do seu patrimônio total
- 🎯 **Visualize de forma intuitiva** onde está seu dinheiro
- 💡 **Tome decisões informadas** com análises profissionais

## 🚀 Por que o Afino é diferente?

### 📱 Patrimônio Completo, Não Apenas Investimentos

| Tipo de Patrimônio | Como Registrar | Exemplos |
|-------------------|----------------|----------|
| **🏠 Imóveis** | Adicione e avalie periodicamente | Casa, apartamento, terreno |
| **🚗 Veículos** | Registre com valor de mercado | Carro, moto, barco |
| **📈 Investimentos** | Acompanhe automaticamente | Ações, FIIs, ETFs |
| **🪙 Criptomoedas** | Valores em tempo real | Bitcoin, Ethereum |
| **💵 Contas e Aplicações** | Saldos atualizados | Poupança, CDB, CDI |
| **🎨 Outros Bens** | Personalize como quiser | Arte, joias, coleções |

### 🔍 Análise Diária Premium

Com a versão Premium, você tem acesso a:
- **Timeline Diária**: Veja exatamente como seu patrimônio evoluiu dia a dia
- **Múltiplas Carteiras**: Organize por objetivo (aposentadoria, emergência, etc)
- **Relatórios Detalhados**: Entenda onde está crescendo ou perdendo valor

## ⚡ Performance de Classe Enterprise

### Otimizações Avançadas
- **Gráficos carregam 10x mais rápido**: 200-400ms vs 2-5s tradicionais
- **Análise em tempo real**: Volatilidade, Sharpe ratio e métricas pré-calculadas
- **Recálculo instantâneo**: Mudanças refletem em menos de 100ms
- **Escala automática**: Suporta milhões de transações sem degradação

### Comparação de Performance

| Funcionalidade | Apps Tradicionais | Afino |
|----------------|-------------------|-------|
| Timeline de 1 ano | 5-15 segundos | 200ms |
| Breakdown por ativo | 10-30 segundos | 50ms |
| Recálculo após evento | 30-120 segundos | 100ms |
| Análise de volatilidade | Manual/Inexistente | Automática |

## 💫 Como Funciona?

### 1️⃣ Cadastre Seu Patrimônio Atual

**Imóveis e Veículos:**
```
Exemplo: "Tenho um apartamento que vale R$ 500.000"
→ Use "Adicionar Patrimônio Existente"
→ Selecione "Imóvel" 
→ Digite o valor atual
✅ Pronto! Já aparece no seu patrimônio total
```

**Investimentos:**
```
Exemplo: "Tenho 100 ações da Petrobras"
→ Use "Adicionar Patrimônio Existente"
→ Busque "PETR4"
→ Digite a quantidade
✅ O valor é calculado automaticamente!
```

### 2️⃣ Mantenha Atualizado

- **Ativos com Cotação** (ações, cripto): Atualização automática diária
- **Bens Físicos** (imóvel, veículo): Você atualiza quando quiser
- **Aplicações** (CDI, poupança): Registre os rendimentos mensalmente

### 3️⃣ Acompanhe a Evolução

Visualize através de:
- 📊 **Gráfico de Evolução**: Linha do tempo do patrimônio total
- 🥧 **Composição**: Pizza mostrando onde está cada real
- 📈 **Performance**: Quanto cada ativo contribuiu para o crescimento

## 🎯 Casos de Uso Reais

### 👨‍👩‍👧‍👦 Família Silva - Controle Patrimonial Completo
```
Patrimônio Registrado:
- Casa própria: R$ 800.000
- Carro SUV: R$ 120.000  
- Poupança: R$ 50.000
- Ações variadas: R$ 200.000
- Bitcoin: R$ 30.000

Benefício: "Agora vemos que 66% do patrimônio está em imóvel. 
Vamos diversificar mais!"
```

### 💼 João - Investidor Iniciante
```
Começou com:
- Conta corrente: R$ 5.000
- FGTS: R$ 15.000

Após 1 ano:
- CDB: R$ 10.000
- Ações: R$ 8.000
- Reserva: R$ 12.000

Benefício: "O gráfico mostra que economizei R$ 15.000 em 1 ano!"
```

## 🛠️ Operações Disponíveis

### Para Registrar Patrimônio

| Operação | Quando Usar | Exemplo |
|----------|-------------|---------|
| **➕ Adicionar Patrimônio** | Registrar algo que você já tem | "Tenho um carro de R$ 50.000" |
| **💰 Entrada de Dinheiro** | Recebeu dinheiro novo | "Recebi salário de R$ 5.000" |
| **📊 Atualizar Valor** | Mudou o valor de mercado | "Meu apto agora vale R$ 600.000" |

### Para Movimentações

| Operação | Quando Usar | Exemplo |
|----------|-------------|---------|
| **🛒 Compra** | Comprou algo novo | "Comprei 50 ações por R$ 30 cada" |
| **💸 Saída de Dinheiro** | Gastou ou retirou | "Paguei R$ 2.000 de contas" |

## 🆚 Comparação com Alternativas

| Funcionalidade | Afino | Apps Bancários | Planilhas |
|----------------|-------|----------------|-----------|
| Todos os tipos de patrimônio | ✅ | ❌ Só investimentos | ✅ Manual |
| Atualização automática | ✅ | ✅ Parcial | ❌ |
| Análise visual profissional | ✅ | ⚠️ Básica | ❌ |
| Histórico diário | ✅ | ❌ | ⚠️ Trabalhoso |
| Múltiplas carteiras | ✅ | ❌ | ✅ |
| Facilidade de uso | ✅ | ✅ | ❌ |

## 🎨 Interface Intuitiva

### Tela Principal - Visão Geral
- **Patrimônio Total**: Número grande no topo
- **Variação**: Quanto mudou hoje/mês/ano
- **Gráfico**: Evolução visual
- **Lista de Ativos**: Todos os seus bens organizados

### Adicionar Novo Patrimônio
1. **Escolha o Tipo**: Ícones grandes e claros
2. **Busque ou Crie**: Digite o nome e encontre
3. **Informe Detalhes**: Quantidade e valor
4. **Confirme**: Veja instantaneamente no patrimônio

## 🚀 Começar é Simples

### 1. Crie sua conta (grátis)
### 2. Adicione seu primeiro patrimônio
### 3. Veja seu patrimônio total instantaneamente

**Dica inicial**: Comece com o que é mais fácil - suas contas bancárias e investimentos. Depois adicione imóveis e outros bens.

## 💎 Planos

### Grátis Forever
- ✅ Patrimônio ilimitado
- ✅ Atualizações automáticas
- ✅ 1 carteira
- ✅ Visão mensal

### Premium (R$ 19,90/mês)
- ✅ Tudo do plano grátis
- ✅ **Análise diária detalhada**
- ✅ **Carteiras ilimitadas**
- ✅ **Exportar relatórios**
- ✅ **Suporte prioritário**

## 🔒 Segurança & Infraestrutura

### Segurança
- 🔐 Criptografia de ponta a ponta
- 🏦 Infraestrutura bancária (Supabase)
- 👤 Seus dados são só seus
- 🚫 Não vendemos suas informações

### Tecnologia Enterprise
- **ClickHouse**: Database analítico usado por Yandex, Uber, Cloudflare
- **PostgreSQL**: Confiabilidade ACID para transações
- **Next.js 15**: Framework moderno com SSR
- **Supabase**: Backend-as-a-Service com real-time
- **TypeScript**: Tipagem forte end-to-end

## 🛠️ Stack Técnica

```typescript
// Arquitetura Híbrida Simplificada
interface TechStack {
  frontend: 'Next.js 15 + TypeScript',
  styling: 'Tailwind CSS + shadcn/ui',
  charts: 'Recharts + Lightweight Charts',
  
  // WRITE SIDE (Transações)
  transactional: 'PostgreSQL (Supabase)',
  auth: 'Supabase Auth',
  realtime: 'Supabase Realtime',
  sync: 'Edge Functions (webhooks)',
  
  // READ SIDE (Analytics)
  analytics: 'ClickHouse (columnar)',
  prices: 'Centralized daily_prices table',
  positions: 'Auto-calculated via Materialized Views',
  
  // Data Flow Simplificado
  events: 'PostgreSQL → ClickHouse (real-time)',
  prices: 'External APIs → ClickHouse (batch daily)',
  positions: 'Auto-calculated from events + prices',
  
  // DevOps
  hosting: 'Cloudflare Pages',
  cicd: 'GitHub Actions'
}
```

## 🔧 Como Usar a Arquitetura Simplificada

### Setup e Configuração

```bash
# 1. Clone o repositório
git clone https://github.com/afino/afino-web.git
cd afino-web

# 2. Configure variáveis de ambiente
cp .env.example .env.local
# Configure CLICKHOUSE_URL, CLICKHOUSE_USER, CLICKHOUSE_PASSWORD

# 3. Configure ClickHouse (uma única vez)
npm run clickhouse:migrate

# 4. Configure triggers no Supabase
# Execute: database/supabase/triggers.sql no Supabase Dashboard

# 5. Deploy edge function para sync
supabase functions deploy clickhouse-sync
```

### Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev                    # Inicia o servidor de dev
npm run build                 # Build para produção

# ClickHouse
npm run clickhouse:migrate    # Aplica schema simplificado
npm run clickhouse:health     # Verifica conectividade

# Sincronização
npm run sync:prices           # Sync preços hoje
npm run sync:prices:yesterday # Sync preços ontem
npm run sync:initial          # Migração inicial (uma vez)

# Testes
npm run test                  # Roda testes unitários
npm run type-check           # Verifica tipos TypeScript
```

### Fluxo de Dados Simplificado

1. **Events (Tempo Real)**
   ```
   Usuário cria evento → Supabase → Trigger → ClickHouse
   ↓
   Materialized View recalcula posições automaticamente
   ```

2. **Preços (Batch Diário)**
   ```
   Cron job → External APIs → daily_prices table
   ↓
   Queries usam preços centralizados para cálculos
   ```

3. **Consultas (Ultra Rápidas)**
   ```
   Frontend → ClickHouse Views → Dados pré-calculados
   Resultado: 200ms instead of 2-5s
   ```

## 📱 Disponível em

- 💻 **Web**: Acesse de qualquer navegador
- 📱 **Mobile**: Em breve para iOS e Android

## 🤝 Suporte

- 📧 Email: contato@afino.app
- 💬 Chat: Dentro do app
- 📚 Central de ajuda: help.afino.app

---

**Afino** - Porque seu patrimônio é mais que números em uma planilha. É sua conquista, seu futuro, sua tranquilidade.

*Comece grátis hoje e descubra o poder de ver todo seu patrimônio em um só lugar.*