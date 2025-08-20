# Arquitetura do Sistema de Snapshots Diários

## Visão Geral

O sistema de snapshots diários consolida o patrimônio total de um usuário por data, respeitando o timezone `America/Sao_Paulo`. O objetivo é criar uma "fotografia" diária do patrimônio sem calcular lucros, apenas agregando valores.

## Fórmula de Cálculo

```
Patrimônio do Dia = SUM(preço_do_ativo_no_dia × quantidade_possuída_no_dia) + saldo_de_CASH_no_dia
```

### Tipos de Operação Suportados

- **`deposit`**: Depósito de dinheiro ou ativos (entrada)
- **`withdraw`**: Saque/Retirada de dinheiro ou ativos (saída)
- **`buy`**: Compra de ativos (sem lógica de lucro, apenas como registro de entrada de ativo + saída de cash)
- **`valuation`**: Avaliação manual do preço de um ativo para snapshot

### Tratamento de Preços por Tipo de Ativo

#### 💰 **Cash (Currency)**
- **Preço fixo**: Sempre 1.0 (1 Real = 1 Real)
- **Operações**: `deposit`/`withdraw` apenas alteram quantidade
- **Exemplo**: Depósito R$ 5.000 → `quantity: 5000, last_price: 1.0`

#### 📈 **Ativos (Stocks, Crypto, etc.)**
- **Preço variável**: Definido na compra, mantido na retirada
- **`buy`**: Altera quantidade E preço (`price_close`)
- **`withdraw`**: Altera APENAS quantidade (preço não muda)
- **`valuation`**: Altera APENAS preço (quantidade não muda)
- **Exemplo**: 
  - Compra 100 ações @ R$ 30 → `quantity: 100, last_price: 30.0`
  - Retira 30 ações → `quantity: 70, last_price: 30.0` ✓
  - Avaliação @ R$ 35 → `quantity: 70, last_price: 35.0` ✓

> **Importante**: Retirada de ativos não altera preço - apenas quantidade. O valor de mercado é sempre `quantidade × último_preço_conhecido`.

## Componentes Principais

### 1. Tipos de Dados (`DailySnapshot`, `SnapshotSummary`)

- **DailySnapshot**: Interface para persistência futura no banco
- **SnapshotSummary**: Interface para retorno das funções de agregação
- **EventForSnapshot**: Eventos relevantes para cálculo de posições
- **AssetPosition**: Posição de um ativo em uma data específica

### 2. Utilitários de Timezone

```typescript
toSaoPauloDate(date: Date): string
getSaoPauloToday(): string  
getSaoPauloDayEnd(dateStr: string): Date
getSaoPauloDayStart(dateStr: string): Date
```

**Comportamento**: Snapshots "fecham" às 23:59:59 no horário de São Paulo (-03:00).

### 3. Funções Puras de Cálculo

#### `calculatePositionsAtDate(events, targetDate): AssetPosition[]`

- **Input**: Lista de eventos + data alvo
- **Output**: Posições de todos os ativos na data
- **Lógica**: 
  - Filtra eventos até o final do dia alvo (23:59:59 SP)
  - Agrupa por `asset_id`
  - Aplica deltas de quantidade e preços sequencialmente

#### `calculateDailySnapshot(positions, date, userId): SnapshotSummary`

- **Input**: Posições + metadados
- **Output**: Snapshot consolidado
- **Lógica**:
  - Separa ativos por classe (`currency` vs outros)
  - Calcula valores: `quantidade × último_preço`
  - Agrega: `cash_balance` + `assets_value` = `total_value`

### 4. Sistema de Cache (`SnapshotCache`)

- **Estratégia**: Cache em memória com LRU simples
- **Chave**: `${userId}:${date}`
- **Limite**: 1000 entradas (configurável)
- **Invalidação**: Por usuário ou data específica

### 5. Funções de Alto Nível

#### `getDailySnapshot(userId, date): Promise<SnapshotSummary>`

- Verifica cache primeiro
- Se não encontrado: busca eventos no DB, calcula e cacheia
- Retorna snapshot consolidado

#### `backfillDailySnapshots(userId): Promise<void>`

- Processa últimos 365 dias em lotes de 30
- Popula cache para consultas futuras
- Log de progresso

#### `invalidateSnapshotsFromDate(userId, fromDate): Promise<void>`

- Limpa cache da data em diante
- Usado após inserção de novos eventos

## Fluxo de Dados

```
[Eventos no DB] → [Filter por data] → [Calculate Positions] → [Calculate Snapshot] → [Cache] → [Return]
                                ↑                                          ↓
                        [Timezone SP]                              [Invalidate on new events]
```

## Considerações de Performance

### Cache Strategy
- **Hit Rate**: Esperado >80% em uso normal
- **Miss Penalty**: ~100-500ms (query + cálculo)
- **Memory Usage**: ~50KB por snapshot (estimativa)

### Backfill Performance
- **365 dias**: ~12 lotes de 30 dias
- **Tempo estimado**: 30-60s por usuário
- **Batch size**: Ajustável (padrão: 30)

### Incremental Updates
- **Trigger**: Após inserção de evento
- **Scope**: Apenas datas >= data do evento
- **Eficiência**: O(dias_afetados), não O(todos_os_eventos)

## Timezone Handling

### Problema
Usuários brasileiros podem inserir eventos em fusos diferentes, mas snapshots devem consolidar no horário local.

### Solução
- **Corte diário**: 23:59:59 America/Sao_Paulo
- **Conversão**: UTC → SP timezone para comparações
- **Consistência**: Todas as datas internas em formato YYYY-MM-DD SP

### Exemplo
```
Evento: 2024-01-15T01:30:00Z (UTC)
SP Local: 2024-01-14T22:30:00-03:00
Snapshot: Incluído no dia 2024-01-14
```

## Casos de Uso Suportados

### 1. Portfolio Timeline
```typescript
const snapshots = await getDailySnapshotRange(userId, '2024-01-01', '2024-01-31')
// Returns: Array de 31 snapshots para visualização
```

### 2. Performance Tracking
```typescript
const today = await getDailySnapshot(userId, getSaoPauloToday())
const monthAgo = await getDailySnapshot(userId, getDateXDaysAgo(30))
const performance = (today.total_value - monthAgo.total_value) / monthAgo.total_value
```

### 3. Asset Breakdown
```typescript
const snapshot = await getDailySnapshot(userId, '2024-01-15')
snapshot.asset_breakdown.forEach(asset => {
  console.log(`${asset.symbol}: ${asset.value} (${asset.quantity} @ ${asset.price})`)
})
```

## Limitações Conhecidas

### 1. Preços de Mercado
- **Atual**: Usa último preço conhecido (valuation/compra)
- **Futuro**: Integração com feeds de preços em tempo real

### 2. Múltiplas Moedas
- **Atual**: Assume BRL como única currency
- **Futuro**: Suporte a conversão de moedas

### 3. Instrumentos Complexos
- **Atual**: Ativos simples (ações, crypto, cash)
- **Futuro**: Derivativos, opções, etc.

## Testes

### Casos Cobertos
- ✅ Cálculo de posições por data
- ✅ Agregação de patrimônio
- ✅ Funcionamento do cache
- ✅ Timezone São Paulo
- ✅ Caso de referência (planilha)

### Caso de Referência
```
Dia 1: Depósito R$ 10.000
Dia 2: Compra 100 PETR4 @ R$ 30 → Total R$ 10.000
Dia 3: Avaliação PETR4 @ R$ 35 → Total R$ 10.500
```

## Monitoramento

### Métricas Importantes
- Cache hit rate por usuário
- Tempo de cálculo por snapshot
- Frequency de invalidações
- Memória utilizada pelo cache

### Logs
- Backfill progress
- Cache misses para debugging
- Invalidações por novos eventos

## Evolução Futura

### Persistência
- Salvar snapshots calculados no banco
- Estratégia de retenção (e.g., 2 anos)

### Real-time Updates
- Websockets para updates em tempo real
- Invalidação automática via triggers

### Analytics
- Agregações por período (semanal, mensal)
- Comparações com benchmarks
- Relatórios de performance