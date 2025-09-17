"use client"

import { useState, useEffect, useCallback } from "react"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { useAuth } from "@/lib/auth"
import { usePortfolioData } from "@/lib/hooks"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RefreshCw, Crown } from "lucide-react"
import { toast } from "sonner"
import { useUserContextFromProvider } from '@/contexts/UserContextProvider'
// import { benchmarkService } from "@/lib/benchmarks" // DESABILITADO
import { FadeIn } from "@/components/ui/fade-in"
import { CardSkeleton } from "@/components/ui/skeleton-loader"
import { getPortfolioService } from "@/lib/portfolio"

// Import dos novos componentes
import { 
  TimelineFilters, 
  TimelineStats, 
  TimelineTabs,
  TimelineFiltersType 
} from "@/components/dashboard/timeline"

export default function TimelinePage() {
  const { user } = useAuth()
  const { userContext } = useUserContextFromProvider()
  const isPremium = userContext.is_premium
  const [view, setView] = useState<'overview' | 'assets' | 'details'>('overview')
  const [benchmarkData, setBenchmarkData] = useState<any>(null)
  // const [benchmarkCache, setBenchmarkCache] = useState<Map<string, any>>(new Map()) // DESABILITADO
  const [performanceAnalysis, setPerformanceAnalysis] = useState<any[]>([])
  const [normalizedPerformance, setNormalizedPerformance] = useState<any[]>([])
  const [refreshing, setRefreshing] = useState(false)
  
  const [filters, setFilters] = useState<TimelineFiltersType>({
    period: '1Y',
    granularity: 'monthly'
    // benchmark: undefined // DESABILITADO - estava causando problemas
  })

  // Usar o novo hook usePortfolioData
  const {
    data: portfolioData,
    loading,
    error,
    refetch,
    invalidateCache
  } = usePortfolioData(user?.id || '', {
    period: filters.period,
    customFrom: filters.customFrom,
    customTo: filters.customTo,
    granularity: filters.granularity,
    includePerformance: isPremium && filters.granularity === 'daily',
    includeHoldings: true,
    includeAssetBreakdown: isPremium,
    includeAccounts: false
  })


  const getDateRange = useCallback(() => {
    const to = new Date().toISOString().split('T')[0]!
    let from: string
    
    switch (filters.period) {
      case '1M':
        from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!
        break
      case '3M':
        from = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!
        break
      case '6M':
        from = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!
        break
      case '1Y':
        from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!
        break
      case '2Y':
        from = new Date(Date.now() - 730 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!
        break
      case 'ALL':
        from = '2020-01-01'
        break
      case 'CUSTOM':
        from = filters.customFrom || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!
        break
      default:
        from = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!
    }
    
    return { from, to: filters.period === 'CUSTOM' ? (filters.customTo || to) : to }
  }, [filters])

  // Carregar benchmark quando selecionado (Premium) - DESABILITADO
  /*
  useEffect(() => {
    const loadBenchmark = async () => {
      if (isPremium && filters.benchmark) {
        console.log('Carregando benchmark:', filters.benchmark)
        try {
          const { from, to } = getDateRange()
          console.log('Range de datas:', { from, to })
          
          // Criar chave de cache
          const cacheKey = `${filters.benchmark}-${from}-${to}`
          
          // Verificar cache primeiro
          if (benchmarkCache.has(cacheKey)) {
            console.log('Usando benchmark do cache:', cacheKey)
            setBenchmarkData(benchmarkCache.get(cacheKey))
            return
          }
          
          const benchmarkResult = await benchmarkService.getBenchmarkData(filters.benchmark, from, to)
          console.log('Resultado do benchmark:', benchmarkResult?.length, 'pontos de dados')
          
          // Salvar no cache
          setBenchmarkCache(prev => {
            const newCache = new Map(prev)
            newCache.set(cacheKey, benchmarkResult)
            return newCache
          })
          
          setBenchmarkData(benchmarkResult)
        } catch (error) {
          console.error('Erro ao carregar benchmark:', error)
          setBenchmarkData(null)
        }
      } else {
        console.log('Limpando benchmark data - isPremium:', isPremium, 'benchmark:', filters.benchmark)
        setBenchmarkData(null)
      }
    }

    loadBenchmark()
  }, [isPremium, filters.benchmark, filters.period, filters.customFrom, filters.customTo])
  */

  // Garantir que benchmarkData seja null (benchmark desabilitado)
  useEffect(() => {
    setBenchmarkData(null)
  }, [])

  // Carregar análise de performance quando Premium + Diário
  useEffect(() => {
    const loadPerformanceAnalysis = async () => {
      if (!user?.id || !isPremium || filters.granularity !== 'daily') {
        setPerformanceAnalysis([])
        setNormalizedPerformance([])
        return
      }

      try {
        const { from, to } = getDateRange()
        const portfolioService = getPortfolioService(user.id, { assumedPlan: 'premium' })
        const performanceData = await portfolioService.getAssetPerformanceAnalysis(from, to)
        
        setPerformanceAnalysis(performanceData)
        
        // Normalizar dados para o MultiAssetTradingView
        const normalized = performanceData.map(asset => ({
          asset_id: asset.asset_id,
          asset_symbol: asset.asset_symbol,
          asset_class: asset.asset_class,
          daily_values: asset.daily_values || []
        }))
        
        setNormalizedPerformance(normalized)
      } catch (error) {
        console.error('Erro ao carregar análise de performance:', error)
        setPerformanceAnalysis([])
        setNormalizedPerformance([])
      }
    }

    loadPerformanceAnalysis()
  }, [user?.id, isPremium, filters.granularity, filters.period, filters.customFrom, filters.customTo])

  const handleFiltersChange = (newFilters: Partial<TimelineFiltersType>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
    // Invalidar cache quando os filtros mudarem
    invalidateCache()
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await refetch()
      toast.success('Dados atualizados com sucesso')
    } catch (error) {
      toast.error('Erro ao atualizar dados')
    } finally {
      setRefreshing(false)
    }
  }

  if (error) {
    return (
      <DashboardLayout
        title="Timeline"
        description="Erro ao carregar dados"
      >
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <p className="text-red-600 mb-2">Erro ao carregar dados</p>
              <p className="text-sm text-muted-foreground mb-4">{error}</p>
              <Button onClick={handleRefresh}>Tentar novamente</Button>
            </div>
          </CardContent>
        </Card>
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title="Timeline"
      description="Acompanhe a evolução do seu patrimônio ao longo do tempo"
      backHref="/dashboard"
      backLabel="Voltar para Dashboard"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading || refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${(loading || refreshing) ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Filtros */}
        <FadeIn>
          <TimelineFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            isPremium={isPremium}
            loading={loading}
          />
        </FadeIn>

        {/* Estatísticas */}
        {portfolioData && (
          <FadeIn delay={100}>
            <TimelineStats
              portfolioData={portfolioData}
              loading={loading}
              period={filters.period}
              granularity={filters.granularity}
              isPremium={isPremium}
            />
          </FadeIn>
        )}

        {/* Loading skeleton para dados principais */}
        {loading && !portfolioData && (
          <FadeIn>
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          </FadeIn>
        )}

        {/* Conteúdo das abas */}
        {(portfolioData || loading) && (
          <FadeIn delay={200}>
            <TimelineTabs
              view={view}
              onViewChange={setView}
              portfolioData={portfolioData}
              benchmarkData={benchmarkData}
              performanceAnalysis={performanceAnalysis}
              normalizedPerformance={normalizedPerformance}
              filters={filters}
              loading={loading}
              isPremium={isPremium}
              onFiltersChange={handleFiltersChange}
              getDateRange={getDateRange}
            />
          </FadeIn>
        )}

        {/* Upgrade Premium para usuários Free */}
        {!isPremium && (
          <FadeIn delay={400}>
            <Card className="bg-gradient-to-r from-primary/5 to-secondary/5 border-dashed">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <h3 className="text-lg font-semibold">Desbloqueie Análises Avançadas</h3>
                  <p className="text-muted-foreground">
                    Upgrade para Premium e tenha acesso a dados diários, benchmarks, análise por ativos e muito mais.
                  </p>
                  <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg">
                    <Crown className="h-4 w-4 mr-2" />
                    Fazer Upgrade
                  </Button>
                </div>
              </CardContent>
            </Card>
          </FadeIn>
        )}
      </div>
    </DashboardLayout>
  )
}