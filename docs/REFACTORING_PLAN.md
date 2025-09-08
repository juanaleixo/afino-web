# 📋 Plano de Refatoração - Afino Finance

> **Objetivo**: Transformar a base de código em uma estrutura mais maintível, performática e escalável através de refatorações sistemáticas.

## 📊 **Análise Atual**

### Problemas Identificados
- **Componentes massivos**: Timeline (746 linhas), Dashboard (881 linhas)
- **Lógica duplicada**: Formatação, cache management, loading states
- **Falta de separação**: UI misturada com lógica de negócio
- **Performance**: Cálculos pesados sem memoização
- **Manutenibilidade**: Código difícil de testar e modificar

### Métricas Atuais
| Métrica | Valor Atual | Meta |
|---------|-------------|------|
| Linhas em TimelinePage | 746 | 200 |
| Linhas em DashboardPage | 881 | 300 |
| Arquivos com formatação duplicada | 8+ | 1 |
| Pontos de cache management | 5+ | 1 |
| Loading logic duplicado | 4+ | 1 hook |

---

## 🚀 **Fases de Execução**

### **Fase 1: Fundação** *(Alta Prioridade)*
*Estabelecer base sólida com hooks e utilitários centralizados*

#### 1.1 Extrair Utilitários de Formatação
**📁 Arquivo**: `src/lib/utils/formatters.ts`

```typescript
/**
 * Utilitários centralizados de formatação
 * Remove duplicação em 8+ arquivos
 */
export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

export const formatPercentage = (value: number, precision = 2) => {
  return `${value >= 0 ? '+' : ''}${value.toFixed(precision)}%`
}

export const formatDate = (date: string | Date, format: 'short' | 'long' = 'short') => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: format === 'short' ? 'short' : 'medium'
  }).format(dateObj)
}

export const formatNumber = (value: number, options?: Intl.NumberFormatOptions) => {
  return new Intl.NumberFormat('pt-BR', options).format(value)
}
```

**⏱️ Tempo estimado**: 2 horas  
**🎯 Impacto**: Remove duplicação em 8+ arquivos

#### 1.2 Criar Hook usePortfolioData
**📁 Arquivo**: `src/lib/hooks/usePortfolioData.ts`

```typescript
/**
 * Hook centralizado para dados do portfólio
 * Remove ~200 linhas duplicadas entre Dashboard e Timeline
 */
export interface PortfolioDataOptions {
  period?: '1M' | '3M' | '6M' | '1Y' | '2Y' | 'ALL' | 'CUSTOM'
  customFrom?: string
  customTo?: string
  granularity?: 'daily' | 'monthly'
  includePerformance?: boolean
  includeHoldings?: boolean
  includeBenchmark?: boolean
}

export function usePortfolioData(userId: string, options: PortfolioDataOptions = {}) {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const refetch = useCallback(async () => {
    // Implementar lógica de:
    // - Loading states
    // - Cache management com CacheService
    // - Error handling
    // - Data fetching via portfolioService
    // - Invalidação inteligente de cache
  }, [userId, options])

  useEffect(() => {
    refetch()
  }, [refetch])

  return {
    data,
    loading,
    error,
    refetch,
    lastUpdated
  }
}
```

**⏱️ Tempo estimado**: 4 horas  
**🎯 Impacto**: Remove ~200 linhas duplicadas

#### 1.3 Implementar CacheService
**📁 Arquivo**: `src/lib/services/cacheService.ts`

```typescript
/**
 * Serviço centralizado de cache para sessionStorage
 * Centraliza 50+ linhas de lógica de cache repetida
 */
export interface CacheOptions {
  ttl?: number // Time to live em milliseconds
  version?: string // Para invalidação de versão
}

export class CacheService {
  private static readonly DEFAULT_TTL = 15 * 60 * 1000 // 15 minutos
  
  static get<T>(key: string): T | null {
    try {
      const item = sessionStorage.getItem(key)
      if (!item) return null
      
      const { value, expires, version } = JSON.parse(item)
      
      if (Date.now() > expires) {
        this.remove(key)
        return null
      }
      
      return value
    } catch {
      return null
    }
  }

  static set<T>(key: string, value: T, options: CacheOptions = {}): void {
    try {
      const expires = Date.now() + (options.ttl ?? this.DEFAULT_TTL)
      const item = {
        value,
        expires,
        version: options.version ?? '1.0'
      }
      sessionStorage.setItem(key, JSON.stringify(item))
    } catch (error) {
      console.warn('Failed to cache item:', error)
    }
  }

  static remove(key: string): void {
    sessionStorage.removeItem(key)
  }

  static invalidate(pattern: string): void {
    const keysToDelete: string[] = []
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && key.includes(pattern)) {
        keysToDelete.push(key)
      }
    }
    keysToDelete.forEach(key => this.remove(key))
  }

  static clear(): void {
    sessionStorage.clear()
  }

  static generateKey(prefix: string, userId: string, params: Record<string, any> = {}): string {
    const paramString = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join('|')
    return `${prefix}-${userId}${paramString ? `-${paramString}` : ''}`
  }
}
```

**⏱️ Tempo estimado**: 2 horas  
**🎯 Impacto**: Centraliza toda lógica de cache

---

### **Fase 2: Componentização** *(Alta Prioridade)*
*Quebrar componentes grandes em partes menores e focadas*

#### 2.1 Quebrar TimelinePage (746 → ~200 linhas)

##### TimelineFilters.tsx
**📁 Arquivo**: `src/components/dashboard/timeline/TimelineFilters.tsx`

```typescript
/**
 * Componente focado apenas em filtros da timeline
 * ~100 linhas extraídas do TimelinePage
 */
interface TimelineFiltersProps {
  filters: TimelineFilters
  onFiltersChange: (filters: Partial<TimelineFilters>) => void
  isPremium: boolean
  loading?: boolean
}

export function TimelineFilters({ filters, onFiltersChange, isPremium, loading }: TimelineFiltersProps) {
  // Implementar:
  // - Seletor de período (1M, 3M, 6M, etc.)
  // - Seletor de granularidade (diário/mensal)
  // - Datas customizadas
  // - Seletor de benchmark
  // - Indicadores premium/free
}
```

##### TimelineStats.tsx
**📁 Arquivo**: `src/components/dashboard/timeline/TimelineStats.tsx`

```typescript
/**
 * Componente para exibição de estatísticas da timeline
 * ~150 linhas de cards de métricas
 */
interface TimelineStatsProps {
  portfolioData: any
  loading: boolean
  period: string
}

export function TimelineStats({ portfolioData, loading, period }: TimelineStatsProps) {
  const { formatCurrency, formatPercentage } = useCurrencyFormatter()
  
  // Implementar:
  // - Cards de valor total, retorno, volatilidade
  // - Métricas de performance
  // - Comparação com benchmark
  // - Estados de loading
}
```

##### TimelineChart.tsx
**📁 Arquivo**: `src/components/dashboard/timeline/TimelineChart.tsx`

```typescript
/**
 * Componente principal do gráfico da timeline
 * ~200 linhas de lógica de gráfico
 */
interface TimelineChartProps {
  data: any[]
  filters: TimelineFilters
  onSelectionChange?: (selection: any) => void
}

export function TimelineChart({ data, filters, onSelectionChange }: TimelineChartProps) {
  const chartSelection = useChartSelection(data)
  
  // Implementar:
  // - Seleção de tipo de gráfico (PortfolioChart, AdvancedChart, TradingView)
  // - Controles de zoom e seleção
  // - Tooltips e interações
}
```

##### TimelineTabs.tsx
**📁 Arquivo**: `src/components/dashboard/timeline/TimelineTabs.tsx`

```typescript
/**
 * Componente para abas da timeline (Overview, Assets, Details)
 * ~100 linhas de conteúdo das abas
 */
interface TimelineTabsProps {
  view: 'overview' | 'assets' | 'details'
  onViewChange: (view: string) => void
  data: any
  isPremium: boolean
}

export function TimelineTabs({ view, onViewChange, data, isPremium }: TimelineTabsProps) {
  // Implementar:
  // - Aba Overview com gráficos principais
  // - Aba Assets com breakdown por ativo
  // - Aba Details com análise detalhada
  // - Controles específicos de cada aba
}
```

**⏱️ Tempo estimado**: 6 horas  
**🎯 Impacto**: 746 → 200 linhas na página principal

#### 2.2 Refatorar DashboardPage (881 → ~300 linhas)

##### DashboardStats.tsx
**📁 Arquivo**: `src/components/dashboard/DashboardStats.tsx`

```typescript
/**
 * Grid de estatísticas do dashboard
 * ~200 linhas de cards de stats
 */
interface DashboardStatsProps {
  portfolioStats: any
  timelineData: any
  loading: boolean
}

export function DashboardStats({ portfolioStats, timelineData, loading }: DashboardStatsProps) {
  // Implementar:
  // - Patrimônio Total
  // - Tipos de Ativo  
  // - Maior Posição
  // - Diversificação
  // - Performance (usando StatsCard)
}
```

##### DashboardTimeline.tsx
**📁 Arquivo**: `src/components/dashboard/DashboardTimeline.tsx`

```typescript
/**
 * Seção de timeline preview no dashboard
 * ~250 linhas de preview e analytics
 */
interface DashboardTimelineProps {
  timelineData: any
  loading: boolean
  isPremium: boolean
}

export function DashboardTimeline({ timelineData, loading, isPremium }: DashboardTimelineProps) {
  // Implementar:
  // - Header da timeline com link para análise detalhada
  // - Gráfico principal (PortfolioChart)
  // - Quick analytics (melhor ativo, total de ativos, volatilidade)
}
```

**⏱️ Tempo estimado**: 4 horas  
**🎯 Impacto**: 881 → 300 linhas na página principal

#### 2.3 Criar StatsCard Reutilizável
**📁 Arquivo**: `src/components/ui/stats-card.tsx`

```typescript
/**
 * Componente reutilizável para cards de estatísticas
 * Padroniza 12+ cards existentes
 */
interface StatsCardProps {
  title: string
  value: string | number
  icon: React.ReactNode
  trend?: {
    value: number
    isPositive: boolean
    label?: string
  }
  loading?: boolean
  variant?: 'default' | 'compact'
  className?: string
}

export function StatsCard({
  title,
  value,
  icon,
  trend,
  loading = false,
  variant = 'default',
  className
}: StatsCardProps) {
  return (
    <Card className={cn("card-hover", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
          {icon}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <LoadingState variant="inline" size="sm" message="Carregando..." />
        ) : (
          <>
            <div className={cn(
              "font-bold text-foreground",
              variant === 'compact' ? "text-lg" : "text-2xl"
            )}>
              {value}
            </div>
            {trend && (
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge variant={trend.isPositive ? "success" : "error"} size="sm">
                  {trend.isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  {trend.value > 0 && trend.isPositive ? '+' : ''}{trend.value}%
                </StatusBadge>
                {trend.label && (
                  <span className="text-xs text-muted-foreground">
                    {trend.label}
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
```

**⏱️ Tempo estimado**: 2 horas  
**🎯 Impacto**: Padroniza 12+ cards de estatísticas

---

### **Fase 3: Performance** *(Média Prioridade)*
*Otimizações de rendering e carregamento*

#### 3.1 Criar Hook useChartSelection
**📁 Arquivo**: `src/lib/hooks/useChartSelection.ts`

```typescript
/**
 * Hook para lógica de seleção em gráficos
 * Remove ~100 linhas duplicadas entre PortfolioChart e AdvancedPortfolioChart
 */
export interface ChartSelection {
  startX: number
  endX: number
  startIndex: number
  endIndex: number
  data: any[]
}

export function useChartSelection(chartData: any[] = []) {
  const [selection, setSelection] = useState<ChartSelection | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; index: number } | null>(null)

  const handleMouseDown = useCallback((event: React.MouseEvent, index: number) => {
    // Implementar lógica de início de drag
  }, [])

  const handleMouseMove = useCallback((event: React.MouseEvent, index: number) => {
    // Implementar lógica de movimento durante drag
  }, [isDragging, dragStart])

  const handleMouseUp = useCallback(() => {
    // Implementar lógica de fim de drag
  }, [isDragging, dragStart, chartData])

  const clearSelection = useCallback(() => {
    setSelection(null)
    setIsDragging(false)
    setDragStart(null)
  }, [])

  return {
    selection,
    isDragging,
    handlers: {
      onMouseDown: handleMouseDown,
      onMouseMove: handleMouseMove,
      onMouseUp: handleMouseUp
    },
    clearSelection
  }
}
```

**⏱️ Tempo estimado**: 3 horas  
**🎯 Impacto**: Remove ~100 linhas duplicadas

#### 3.2 Implementar Lazy Loading
**📁 Aplicar em**: Componentes pesados

```typescript
// Em timeline/page.tsx
const PremiumAnalytics = lazy(() => import('./premium-analytics'))
const AdvancedPortfolioChart = lazy(() => import('./advanced-portfolio-chart'))
const TradingViewChart = lazy(() => import('./tradingview-chart'))

// Uso com Suspense
<Suspense fallback={<ChartSkeleton />}>
  {isPremium && view === 'details' && <PremiumAnalytics data={data} />}
</Suspense>
```

**⏱️ Tempo estimado**: 2 horas  
**🎯 Impacto**: Melhora tempo de carregamento inicial

#### 3.3 Adicionar Memoização
**📁 Aplicar em**: Cálculos pesados

```typescript
// Em componentes com cálculos pesados
const chartData = useMemo(() => {
  if (!portfolioData?.series) return []
  
  return portfolioData.series.map(item => ({
    date: item.date,
    value: item.total_value,
    // outros cálculos pesados...
  }))
}, [portfolioData?.series])

const performanceMetrics = useMemo(() => {
  // Cálculos de performance, volatilidade, etc.
}, [portfolioData, selectedPeriod])
```

**⏱️ Tempo estimado**: 2 horas  
**🎯 Impacto**: Reduz re-renders desnecessários

---

### **Fase 4: Organização** *(Baixa Prioridade)*
*Melhorias estruturais para manutenibilidade*

#### 4.1 Reorganizar Estrutura de Pastas

**Nova estrutura proposta**:
```
src/
├── lib/
│   ├── hooks/
│   │   ├── usePortfolioData.ts
│   │   ├── useChartSelection.ts
│   │   ├── useCurrencyFormatter.ts
│   │   └── index.ts
│   ├── services/
│   │   ├── cacheService.ts
│   │   ├── portfolioService.ts (refactor de portfolio.ts)
│   │   └── index.ts
│   └── utils/
│       ├── formatters.ts
│       ├── chartUtils.ts
│       ├── dateUtils.ts
│       └── index.ts
├── components/
│   ├── ui/
│   │   ├── stats-card.tsx
│   │   ├── chart-skeleton.tsx
│   │   └── ...
│   └── dashboard/
│       ├── shared/
│       │   ├── StatsCard.tsx
│       │   ├── DataLoader.tsx
│       │   └── RefreshButton.tsx
│       ├── timeline/
│       │   ├── TimelineFilters.tsx
│       │   ├── TimelineStats.tsx
│       │   ├── TimelineChart.tsx
│       │   ├── TimelineTabs.tsx
│       │   └── index.ts
│       └── overview/
│           ├── DashboardStats.tsx
│           ├── DashboardTimeline.tsx
│           └── index.ts
```

**⏱️ Tempo estimado**: 1 hora  
**🎯 Impacto**: Melhora organização e imports

---

## 📈 **Roadmap de Execução**

### **Semana 1: Fundação**
1. ✅ Extrair utilitários de formatação (2h)
2. ✅ Criar hook usePortfolioData (4h) 
3. ✅ Implementar CacheService (2h)
4. ✅ Testar integração da base

### **Semana 2: Componentização Principal** 
5. ✅ Quebrar TimelinePage em componentes (6h)
6. ✅ Criar StatsCard reutilizável (2h)
7. ✅ Refatorar DashboardPage (4h)
8. ✅ Testes de integração

### **Semana 3: Performance**
9. ✅ Criar hook useChartSelection (3h)
10. ✅ Implementar lazy loading (2h)
11. ✅ Adicionar memoização (2h)
12. ✅ Testes de performance

### **Semana 4: Organização**
13. ✅ Reorganizar estrutura de pastas (1h)
14. ✅ Atualizar imports e exports (1h)
15. ✅ Documentação e linting
16. ✅ Testes finais

**Total: ~28 horas distribuídas em 4 semanas**

---

## ✅ **Checklist de Execução**

### **Antes de Começar**
- [ ] Fazer backup do código atual
- [ ] Criar branch específica: `refactor/phase-1-foundation`
- [ ] Configurar ambiente de testes
- [ ] Documentar funcionalidades críticas

### **Durante Cada Fase**
- [ ] Manter funcionalidade existente intacta
- [ ] Executar `npm run build` após cada mudança
- [ ] Fazer commits pequenos e descritivos
- [ ] Testar em ambiente de desenvolvimento
- [ ] Validar que não há regressões

### **Após Cada Fase**
- [ ] Code review interno
- [ ] Testes funcionais completos
- [ ] Verificar métricas de performance
- [ ] Atualizar documentação
- [ ] Merge para main branch

---

## 🎯 **Métricas de Sucesso**

| Métrica | Valor Inicial | Meta Final | 
|---------|---------------|------------|
| **Linhas em TimelinePage** | 746 | 200 |
| **Linhas em DashboardPage** | 881 | 300 |
| **Arquivos com formatação duplicada** | 8+ | 1 |
| **Pontos de cache management** | 5+ | 1 |
| **Loading logic duplicado** | 4+ | 1 hook |
| **Tempo de build** | ~4s | <3s |
| **Bundle size (timeline)** | 69.7kB | <60kB |
| **Bundle size (dashboard)** | 10.6kB | <8kB |

---

## 🚨 **Riscos e Mitigações**

### **Riscos Técnicos**
| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Quebrar funcionalidade existente | Média | Alto | Testes extensivos + rollback plan |
| Performance degradation | Baixa | Médio | Benchmarks antes/depois |
| Conflitos de merge | Baixa | Médio | Commits pequenos + comunicação |

### **Riscos de Cronograma**
| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Estimativas otimistas | Alta | Médio | Buffer de 20% no cronograma |
| Complexidade subestimada | Média | Alto | Quebrar tasks em subtasks menores |
| Dependências bloqueantes | Baixa | Alto | Identificar dependências críticas |

---

## 📚 **Recursos Adicionais**

### **Documentação de Referência**
- [React Hooks Best Practices](https://react.dev/reference/react)
- [Next.js Performance Optimization](https://nextjs.org/docs/advanced-features)
- [TypeScript Utility Types](https://www.typescriptlang.org/docs/handbook/utility-types.html)

### **Ferramentas de Apoio**
- **ESLint/Prettier**: Manter consistência de código
- **React Developer Tools**: Debug de hooks e performance
- **Bundle Analyzer**: Análise de tamanho de bundles
- **Chrome DevTools**: Profiling de performance

---

## 💡 **Observações Finais**

### **Princípios a Seguir**
1. **Incremental**: Mudanças pequenas e testáveis
2. **Backward Compatible**: Não quebrar funcionalidades
3. **Performance First**: Cada mudança deve melhorar ou manter performance
4. **Developer Experience**: Código mais fácil de entender e modificar
5. **Future Proof**: Estrutura que suporte crescimento futuro

### **Benefícios Esperados**
- 📉 **Redução de ~40% nas linhas de código** dos componentes principais
- ⚡ **Melhoria de ~15% na performance** com lazy loading e memoização  
- 🔧 **Facilidade de manutenção** com componentes focados e reutilizáveis
- 🧪 **Melhoria na testabilidade** com lógica extraída para hooks
- 📦 **Redução no bundle size** com code splitting otimizado

---

**Este plano de refatoração transformará o Afino Finance em uma aplicação mais robusta, maintível e performática!** 🚀

*Última atualização: Janeiro 2025*