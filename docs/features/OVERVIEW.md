# 📚 Documentação Completa - Afino Análise Patrimonial

## 🎯 Visão Geral do Sistema

O **Afino** é uma plataforma completa de análise patrimonial construída com Next.js 15, TypeScript, Tailwind CSS e Supabase. O diferencial é permitir o registro e acompanhamento de **TODO o patrimônio** do usuário - não apenas investimentos financeiros.

### 🏗️ Arquitetura de Patrimônio

```
Patrimônio Total/
├── 🏠 Bens Físicos/           # Imóveis, veículos
├── 📈 Investimentos/          # Ações, fundos, renda fixa
├── 🪙 Criptomoedas/          # Bitcoin, Ethereum, etc
├── 💰 Contas Bancárias/      # Saldos e aplicações
└── 🎨 Outros Ativos/         # Arte, coleções, etc
```

---

## 🔐 Sistema de Ativos

### 📊 Tipos de Ativos Suportados

#### **Ativos Globais (Pré-cadastrados)**
Ativos com cotação automática que NÃO podem ser criados pelo usuário:

| Tipo | Classe | Exemplos | Atualização |
|------|--------|----------|-------------|
| **Ações** | `stock` | PETR4, VALE3, BBDC4 | Automática diária |
| **Criptomoedas** | `crypto` | BTC, ETH, ADA | Automática diária |
| **Fundos** | `fund` | FIIs, ETFs | Automática diária |
| **Moedas** | `currency` | BRL, USD, EUR | Taxa de câmbio |

#### **Ativos Personalizados (Criados pelo usuário)**
Ativos sem cotação automática que precisam avaliação manual:

| Tipo | Classe | Exemplos | Atualização |
|------|--------|----------|-------------|
| **Imóveis** | `real_estate` | Casa, apartamento, terreno | Manual pelo usuário |
| **Veículos** | `vehicle` | Carro, moto, barco | Manual pelo usuário |
| **Commodities** | `commodity` | Ouro físico, prata | Manual pelo usuário |
| **Outros** | `bond` | CDB, LCI, Tesouro | Manual pelo usuário |

### 🚫 Proteção contra Duplicação

O sistema **impede** que usuários criem ativos que já existem globalmente:
- ❌ Não pode criar "Bitcoin" personalizado
- ❌ Não pode criar "PETR4" personalizada
- ✅ Pode criar "Meu Apartamento Centro"
- ✅ Pode criar "Honda Civic 2020"

---

## 💫 Fluxo de Cadastro Intuitivo

### 1️⃣ **Adicionar Patrimônio Existente**
Para registrar algo que você já possui:

```
Usuário: "Tenho um apartamento"
Sistema: 
  1. Mostra categorias com ícones grandes
  2. Usuário seleciona "🏠 Imóvel"
  3. Preenche nome: "Apartamento Zona Sul"
  4. Informa valor: R$ 500.000
  5. Pronto! Aparece no patrimônio total
```

### 2️⃣ **Registrar Investimento**
Para ativos com cotação:

```
Usuário: "Tenho ações da Petrobras"
Sistema:
  1. Mostra busca inteligente
  2. Usuário digita "petr"
  3. Aparece "PETR4 - Petrobras PN"
  4. Informa quantidade: 100
  5. Valor calculado automaticamente!
```

### 3️⃣ **Atualizar Valores**
Para manter patrimônio atualizado:

```
Automático: Ações, crypto, fundos
Manual: 
  - Imóveis: "Avalie anualmente"
  - Veículos: "Use tabela FIPE"
  - CDI/CDB: "Atualize mensalmente"
```

---

## 🎨 Interface Focada em UX

### 📱 Dashboard Principal
```
┌─────────────────────────────────┐
│ 💰 Patrimônio Total             │
│ R$ 1.234.567,89                 │
│ ↗️ +5.43% este mês              │
├─────────────────────────────────┤
│ [Gráfico de Evolução]           │
├─────────────────────────────────┤
│ 🏠 Imóveis         65% ████████ │
│ 📈 Ações           20% ███      │
│ 💵 Renda Fixa      10% ██       │
│ 🚗 Veículos         5% █        │
└─────────────────────────────────┘
```

### ➕ Tela de Adicionar Patrimônio
```
┌─────────────────────────────────┐
│ O que você quer adicionar?      │
├─────────────────────────────────┤
│ ┌───────┐ ┌───────┐ ┌───────┐  │
│ │  🏠   │ │  🚗   │ │  📈   │  │
│ │Imóvel │ │Veículo│ │Invest.│  │
│ └───────┘ └───────┘ └───────┘  │
│ ┌───────┐ ┌───────┐ ┌───────┐  │
│ │  💰   │ │  🪙   │ │  🎨   │  │
│ │ Conta │ │Crypto │ │ Outros│  │
│ └───────┘ └───────┘ └───────┘  │
└─────────────────────────────────┘
```

---

## 🔄 Tipos de Operações

### Para Patrimônio Inicial

| Operação | Nome Intuitivo | Quando Usar |
|----------|----------------|-------------|
| `position_add` | **"Adicionar Patrimônio"** | Registrar algo que já possui |
| `valuation` | **"Atualizar Valor"** | Corrigir valor de mercado |

### Para Movimentações

| Operação | Nome Intuitivo | Quando Usar |
|----------|----------------|-------------|
| `deposit` | **"Entrada"** | Recebeu dinheiro/salário |
| `withdraw` | **"Saída"** | Gastou ou retirou |
| `buy` | **"Compra"** | Adquiriu novo ativo |

---

## 📊 Análises Premium

### Timeline Diária
- Veja **exatamente** quanto tinha em cada dia
- Identifique **quando** houve grandes variações
- Compare períodos diferentes

### Múltiplas Carteiras
- **Aposentadoria**: Investimentos de longo prazo
- **Emergência**: Reserva de segurança
- **Objetivos**: Casa nova, viagem, etc

### Relatórios Profissionais
- Evolução por tipo de ativo
- Performance individualizada
- Exportação para PDF/Excel

---

## 🛡️ Segurança e Privacidade

### Proteção de Dados
- **RLS (Row Level Security)**: Cada usuário só vê seus dados
- **Criptografia**: Todos os dados sensíveis
- **Backups**: Automáticos diários

### Boas Práticas
- Não armazenamos senhas de bancos
- Não acessamos suas contas
- Você tem controle total dos dados

---

## 🚀 Roadmap de Funcionalidades

### ✅ Implementado
- Sistema completo de ativos
- Análise visual do patrimônio
- Múltiplos tipos de operações
- Interface intuitiva

### 🚧 Em Desenvolvimento
- Importação de extratos
- App mobile nativo
- Metas e objetivos
- Alertas inteligentes

### 📋 Planejado
- Integração com corretoras
- Análise de impostos
- Sugestões de diversificação
- Comparação com benchmarks

---

## 💡 Dicas de Uso

### Para Iniciantes
1. **Comece simples**: Adicione suas contas bancárias
2. **Seja consistente**: Atualize mensalmente
3. **Use categorias**: Organize por tipo

### Para Avançados
1. **Multiple wallets**: Separe por objetivo
2. **Tags personalizadas**: Use o campo meta
3. **Análise período**: Compare evolução

---

## 📞 Suporte

### Canais
- 💬 **Chat no app**: Resposta em minutos
- 📧 **Email**: suporte@afino.app
- 📚 **Base de conhecimento**: help.afino.app

### FAQ Rápido
- **Posso importar dados?** Em breve!
- **É seguro?** Sim, usamos criptografia bancária
- **Funciona offline?** Não, precisa internet
- **Tem app mobile?** Em desenvolvimento

---

*Afino - Porque gerenciar patrimônio deve ser simples, visual e completo.*