# Análise: Manutenção da Funcionalidade "Compra"

## 🎯 Contexto
O app foca em **registrar fotos do patrimônio** ao invés de gerenciar transações financeiras complexas.

## 🔍 Análise Atual

### Como "Compra" Funciona Hoje:
- Tipo de evento: `'buy'`
- Afeta o caixa da conta (deduz valor)
- Adiciona unidades do ativo
- Requer preço de compra
- Calcula impacto financeiro completo

### Como Deveria Ser "Adição de Posição":
- Tipo de evento: `'position_add'` (novo)
- **NÃO afeta caixa** da conta
- Apenas adiciona unidades do ativo
- Usa preço de mercado atual (não preço de compra)
- Foco em registrar "o que eu tenho" vs "como comprei"

## 💡 Proposta de Solução

### Opção A: Substituir Completamente
- Remover `'buy'` → Adicionar `'position_add'`
- Migrar eventos existentes
- Interface mais simples

### Opção B: Manter Ambos (Recomendada)
- Manter `'buy'` para quem quer controle financeiro
- Adicionar `'position_add'` para registro simples
- Usuário escolhe o modelo que prefere

### Opção C: Modificar "Compra"
- Manter tipo `'buy'` mas adicionar toggle "Afetar Caixa?"
- Se false, comporta como adição de posição
- Mantém compatibilidade

## 🏆 Recomendação: Opção B

### Vantagens:
✅ Flexibilidade para diferentes casos de uso
✅ Não quebra funcionalidade existente
✅ Interface clara entre os dois modelos
✅ Permite evolução futura do produto

### Interface Sugerida:
```
┌─ Que tipo de operação? ─┐
│ 📥 Depósito             │
│ 📤 Saque                │
│ 🛒 Compra (afeta caixa) │
│ ➕ Adicionar Posição    │ ← NOVO
│ 💰 Avaliação            │
└─────────────────────────┘
```

## 📋 Implementação

### 1. Schema Update
```sql
-- Adicionar novo tipo de evento
ALTER TYPE event_kind ADD VALUE 'position_add';
```

### 2. Interface Changes
```typescript
type EventKind = 'deposit' | 'withdraw' | 'buy' | 'position_add' | 'valuation'
```

### 3. Business Logic
- `position_add`: units_delta positivo, sem impacto no caixa
- `buy`: units_delta positivo, deduz do caixa

### 4. Migration Path
Oferecer aos usuários existentes a opção de migrar compras antigas para adições de posição se preferirem o modelo simples.