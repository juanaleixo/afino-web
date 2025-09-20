"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import PortfolioChart from "@/components/PortfolioChart"
import { FadeIn } from "@/components/ui/fade-in"
import { ChartSkeleton } from "@/components/ui/skeleton-loader"
import { BarChart3, Crown, Zap, Loader2 } from "lucide-react"
import { TimelineFilters } from "./TimelineFilters"
import { lazy, Suspense } from "react"

// Lazy loading dos gráficos avançados
const AdvancedPortfolioChart = lazy(() => import("@/components/dashboard/timeline/advanced-portfolio-chart"))
const TradingViewChart = lazy(() => import("@/components/dashboard/timeline/tradingview-chart"))

interface TimelineChartProps {
  portfolioData: any
  assetBreakdownData?: any
  benchmarkData?: any
  filters: TimelineFilters
  loading: boolean
  isPremium: boolean
  performanceAnalysis?: any[]
  onSelectionChange?: (selection: any) => void
}

type ChartType = 'basic' | 'advanced' | 'tradingview'

export function TimelineChart({
  portfolioData,
  assetBreakdownData,
  benchmarkData,
  filters,
  loading,
  isPremium,
  performanceAnalysis = [],
  onSelectionChange
}: TimelineChartProps) {

  // Determinar qual tipo de gráfico usar
  const getChartType = (): ChartType => {
    // Se premium e granularidade diária, usar gráfico avançado
    if (isPremium && filters.granularity === 'daily') {
      return 'advanced'
    }
    // Por padrão, usar gráfico básico
    return 'basic'
  }

  const chartType = getChartType()

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <ChartSkeleton />
      </div>
    )
  }

  // Use the series already selected by usePortfolioData hook based on granularity
  const selectedSeries = portfolioData?.series || []
  const monthlySeries = portfolioData?.monthlySeries || []
  const dailySeries = portfolioData?.dailySeries || null

  if (selectedSeries.length === 0) {
    return (
      <FadeIn>
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-2">Nenhum dado disponível</p>
              <p className="text-sm text-muted-foreground">
                Adicione alguns eventos para ver a evolução do seu patrimônio
              </p>
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    )
  }

  return (
    <FadeIn className="space-y-4">
      {/* Header com informações do gráfico */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5" />
          <span className="font-medium">Evolução do Patrimônio</span>
          {chartType === 'advanced' && (
            <Badge variant="secondary" className="bg-primary/10 text-primary">
              <Crown className="h-3 w-3 mr-1" />
              Premium
            </Badge>
          )}
        </div>
        
        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
          <span>Granularidade: {filters.granularity === 'daily' ? 'Diária' : 'Mensal'}</span>
          {/* Benchmark desabilitado
          {filters.benchmark && (
            <>
              <span>•</span>
              <span>Benchmark: {getBenchmarkLabel(filters.benchmark)}</span>
            </>
          )}
          */}
        </div>
      </div>

      {/* Gráfico principal */}
      <div className="select-none">
        {chartType === 'advanced' ? (
          <Suspense fallback={
            <Card>
              <CardContent className="flex items-center justify-center h-64">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-6 w-6 animate-spin" />
                  <span>Carregando gráfico avançado...</span>
                </div>
              </CardContent>
            </Card>
          }>
            <AdvancedPortfolioChart
              monthlyData={monthlySeries}
              dailyData={dailySeries}
              assetBreakdown={assetBreakdownData}
              benchmarkData={benchmarkData}
              isLoading={loading}
              granularity={filters.granularity}
            />
          </Suspense>
        ) : (
          <PortfolioChart
            monthlyData={monthlySeries}
            dailyData={dailySeries}
            benchmarkData={benchmarkData}
            isLoading={loading}
            granularity={filters.granularity}
          />
        )}
      </div>

      {/* Hint para dados detalhados (Premium + Diário) */}
      {isPremium && 
       filters.granularity === 'daily' && 
       performanceAnalysis && 
       performanceAnalysis.length > 0 && (
        <FadeIn delay={200}>
          <Card className="border-dashed card-hover bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950/20 dark:to-purple-950/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Zap className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">
                    Dados detalhados por ativo disponíveis na aba &ldquo;Detalhes&rdquo;
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {performanceAnalysis.length} ativos com dados diários
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Aviso para usuários Free */}
      {!isPremium && (
        <FadeIn delay={300}>
          <Card className="border-dashed bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-950/20 dark:to-blue-950/20">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Crown className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">
                    Upgrade para Premium para acessar dados diários e análises avançadas
                  </span>
                </div>
                <Badge variant="outline" className="text-primary border-primary">
                  Premium
                </Badge>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </FadeIn>
  )
}

// Helper para labels de benchmark
function getBenchmarkLabel(benchmark: string): string {
  const labels: Record<string, string> = {
    'cdi': 'CDI',
    'ibov': 'IBOVESPA',
    'sp500': 'S&P 500',
    'btc': 'Bitcoin'
  }
  return labels[benchmark] || benchmark
}