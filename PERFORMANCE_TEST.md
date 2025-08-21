# Teste de Performance - Otimizações de Cache

## Como Testar

### 1. Aplicar Funções no Banco
```sql
-- No console do Supabase, execute:
SELECT api_user_context();
SELECT api_holdings_with_assets('2025-08-21'::date);
SELECT api_portfolio_summary('2025-08-21'::date);
```

### 2. Testar no Frontend

#### Antes das Otimizações:
- Abra DevTools → Network
- Acesse `/dashboard/timeline`
- Conte quantas chamadas para:
  - `user_profiles?select=plan` 
  - `api_holdings_at`
  - `events?select=created_at`
  - `global_assets`

#### Depois das Otimizações:
- Limpe o cache do navegador
- Recarregue a página
- Observe a redução drástica de chamadas

### 3. Verificar Cache

#### No Console do Browser:
```javascript
// Verificar cache de plano do usuário
console.log(window.sessionStorage.getItem('user_plan_cache'))

// Verificar logs de cache
// Procure por mensagens "Cache hit" vs "Cache miss"
```

## Resultados Esperados

### Redução de Chamadas:
- **user_profiles**: 15+ → 1 por contexto
- **api_holdings_at**: 5+ → 1 por página (com fallback)
- **events**: 4+ → 1 por minuto
- **global_assets**: 4+ → 1 por conjunto de assets

### Melhorias de Performance:
- ⚡ **Carregamento inicial**: 60-80% mais rápido
- 📊 **Navegação entre páginas**: Cache hits instantâneos
- 🔄 **Recarregamentos**: Dados servidos do cache
- 📱 **Experiência do usuário**: Interface mais responsiva

## Funcionalidades de Fallback

Se as novas funções não estiverem no banco:
- ✅ Sistema funciona normalmente com funções antigas
- ✅ Cache ainda reduz chamadas repetidas
- ✅ Logs indicam quando fallback é usado
- ✅ Performance melhora mesmo sem funções SQL otimizadas

## Monitoramento

### Browser DevTools:
1. **Network Tab**: Conte requisições antes/depois
2. **Console**: Veja logs de cache hit/miss
3. **Performance Tab**: Meça tempo de carregamento

### Métricas Importantes:
- Total de requests para Supabase
- Tempo até primeiro conteúdo útil
- Tempo de navegação entre páginas
- Uso de memória (cache em RAM)