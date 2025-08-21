# Otimizações de Performance Implementadas

## Problema Identificado
Múltiplas chamadas repetidas ao banco de dados foram identificadas na timeline:

- `user_profiles?select=plan` - **15+ chamadas repetidas**
- `api_holdings_at` - **5+ chamadas repetidas**  
- `events?select=created_at&order=created_at.desc&limit=1` - **4+ chamadas repetidas**
- `global_assets?select=id,symbol&id=in.(...)` - **4+ chamadas repetidas**

## Soluções Implementadas

### 1. Sistema de Cache (Frontend)
**Arquivo:** `src/lib/cache.ts`

- Cache em memória com TTL configurável
- Wrapper para funções assíncronas
- Evita chamadas duplicadas durante a sessão

### 2. Hook Otimizado para Plano do Usuário  
**Arquivo:** `src/hooks/use-user-plan-cached.ts`

- Substitui hooks duplicados (`useUserPlan` e `use-user-plan`)
- Cache de 10 minutos para dados do plano
- Reduz consultas de 15+ para 1 por sessão

### 3. Cache no PortfolioService
**Arquivo:** `src/lib/portfolio.ts`

- Métodos com cache para:
  - `getUserPlan()` - TTL 10 min
  - `getHoldingsRPC()` - TTL 2 min  
  - `getAssetsBatch()` - TTL 15 min
- Elimina chamadas repetidas durante navegação

### 4. Cache de Eventos (Dashboard)
**Arquivo:** `src/app/dashboard/page.tsx`

- Cache em SessionStorage para timestamp do último evento
- TTL de 1 minuto
- Reduz consultas para detecção de mudanças

### 5. Funções SQL Otimizadas (Backend)

#### `api_user_context()` 
- Retorna plano + metadados do usuário em 1 call
- Substitui múltiplas consultas separadas

#### `api_holdings_with_assets()`
- Holdings + metadados dos ativos em 1 call  
- Elimina necessidade de chamadas para `global_assets`

#### `api_assets_batch()`
- Lookup em lote para metadados de ativos
- Mais eficiente que consultas individuais

#### `api_portfolio_summary()`
- Resumo completo do portfólio em 1 call
- Inclui top 5 ativos e estatísticas

## Impacto Esperado

### Redução de Chamadas:
- **user_profiles**: 15+ → 1 por sessão
- **api_holdings_at**: 5+ → 1 por página  
- **events**: 4+ → 1 por minuto
- **global_assets**: 4+ → 1 por conjunto de ativos

### Performance:
- **Tempo de carregamento**: Redução estimada de 60-80%
- **Tráfego de rede**: Redução de ~75%
- **Carga no banco**: Redução significativa de queries

## Compatibilidade
- Todas as mudanças são backward-compatible
- Fallbacks implementados para funções antigas
- Deploy pode ser feito de forma incremental

## Próximos Passos
1. Deploy das funções SQL no banco
2. Atualizar imports nos componentes
3. Monitorar métricas de performance
4. Considerar cache Redis para produção