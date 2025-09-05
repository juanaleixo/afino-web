"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { formatCurrency } from "@/lib/utils/formatters"
import { FadeIn } from "@/components/ui/fade-in"
import { 
  TrendingUp, 
  PieChart, 
  BarChart3, 
  Loader2,
  Crown 
} from "lucide-react"
import MultiAssetTradingView from "@/components/dashboard/timeline/multi-asset-tradingview"
import PremiumAnalytics from "@/components/dashboard/timeline/premium-analytics"
import { TimelineChart } from "./TimelineChart"
import { TimelineFilters } from "./TimelineFilters"

interface TimelineTabsProps {
  view: 'overview' | 'assets' | 'details'
  onViewChange: (view: 'overview' | 'assets' | 'details') => void
  portfolioData: any
  assetBreakdownData?: any
  benchmarkData?: any
  performanceAnalysis: any[]
  normalizedPerformance: any[]
  filters: TimelineFilters
  loading: boolean
  isPremium: boolean
  onFiltersChange: (filters: Partial<TimelineFilters>) => void
  getDateRange: () => { from: string; to: string }
}

const ASSET_COLORS = [
  '#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', 
  '#db2777', '#0891b2', '#65a30d', '#c2410c', '#4338ca'
]

export function TimelineTabs({
  view,
  onViewChange,
  portfolioData,
  assetBreakdownData,
  benchmarkData,
  performanceAnalysis,
  normalizedPerformance,
  filters,
  loading,
  isPremium,
  onFiltersChange,
  getDateRange
}: TimelineTabsProps) {

  // Função para obter série ativa baseada na granularidade
  const getActiveSeries = () => {
    if (!portfolioData) return []
    const dailySeries = portfolioData.dailySeries || null
    const monthlySeries = portfolioData.monthlySeries || portfolioData.series || []
    
    return (isPremium && filters.granularity === 'daily' && dailySeries)
      ? dailySeries 
      : monthlySeries
  }

  return (
    <Tabs value={view} onValueChange={(value) => onViewChange(value as any)}>
      <TabsList className={`grid w-full ${isPremium ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <TabsTrigger value="overview" className="flex items-center space-x-2">
          <TrendingUp className="h-4 w-4" />
          <span>Visão Geral</span>
        </TabsTrigger>
        
        {isPremium && (
          <TabsTrigger value="assets" className="flex items-center space-x-2">
            <PieChart className="h-4 w-4" />
            <span>Por Ativos</span>
            <Crown className="h-3 w-3" />
          </TabsTrigger>
        )}
        
        <TabsTrigger value="details" className="flex items-center space-x-2">
          <BarChart3 className="h-4 w-4" />
          <span>Detalhes</span>
        </TabsTrigger>
      </TabsList>
      
      {/* ABA 1: VISÃO GERAL - Gráfico principal */}
      <TabsContent value="overview" className="space-y-6">
        <TimelineChart
          portfolioData={portfolioData}
          assetBreakdownData={assetBreakdownData}
          benchmarkData={benchmarkData}
          filters={filters}
          loading={loading}
          isPremium={isPremium}
          performanceAnalysis={performanceAnalysis}
        />
      </TabsContent>

      {/* ABA 2: POR ATIVOS - Análise multi-ativos (Premium) */}
      {isPremium && (
        <TabsContent value="assets" className="space-y-6">
          {filters.granularity === 'daily' ? (
            <FadeIn className="space-y-6">
              {/* Multi-Asset Chart */}
              <MultiAssetTradingView
                assetsData={normalizedPerformance.map((asset, index) => ({
                  asset_id: asset.asset_id,
                  asset_symbol: asset.asset_symbol,
                  asset_class: asset.asset_class,
                  daily_values: asset.daily_values || [],
                  color: ASSET_COLORS[index % ASSET_COLORS.length] || '#2563eb'
                }))}
                portfolioData={portfolioData}
                isPremium={isPremium}
                isLoading={loading}
              />
              
              {/* Performance Analysis */}
              <FadeIn delay={300}>
                <PremiumAnalytics
                  performanceData={normalizedPerformance}
                  benchmarkData={benchmarkData}
                  isLoading={loading}
                  period={getDateRange()}
                />
              </FadeIn>
            </FadeIn>
          ) : (
            <FadeIn>
              <Card className="card-hover">
                <CardContent className="flex items-center justify-center h-64">
                  <div className="text-center space-y-4">
                    <PieChart className="h-12 w-12 mx-auto text-muted-foreground" />
                    <div>
                      <h3 className="font-semibold mb-2">Análise Individual por Ativo</h3>
                      <p className="text-muted-foreground mb-4">
                        Para comparar ativos individuais, use a visualização diária
                      </p>
                    </div>
                    <Button onClick={() => {
                      const newFilters: Partial<TimelineFilters> = { granularity: 'daily' }
                      // Otimização automática para dados diários
                      if (!['1M', '3M'].includes(filters.period)) {
                        newFilters.period = '1M'
                      }
                      onFiltersChange(newFilters)
                    }}>
                      Alternar para Dados Diários
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          )}
        </TabsContent>
      )}

      {/* ABA 3: DETALHES - Tabela de dados */}
      <TabsContent value="details" className="space-y-4">
        <FadeIn>
          <Card className="card-hover">
            <CardHeader>
              <CardTitle>Dados Históricos</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin mr-2" />
                  Carregando dados...
                </div>
              ) : getActiveSeries().length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2">Data</th>
                        <th className="text-right p-2">Valor Total</th>
                        <th className="text-right p-2">Variação</th>
                        {isPremium && <th className="text-right p-2">% Crescimento</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {getActiveSeries().map((item: any, index: number, arr: any[]) => {
                        const previousValue = index > 0 ? arr[index - 1].total_value : 0
                        const change = item.total_value - previousValue
                        const percentChange = previousValue > 0 ? (change / previousValue) * 100 : 0
                        
                        return (
                          <tr key={index} className="border-b hover:bg-muted/50 transition-colors">
                            <td className="p-2">
                              {new Date(item.date || item.month_eom).toLocaleDateString('pt-BR', 
                                isPremium && filters.granularity === 'daily'
                                  ? { day: '2-digit', month: 'short', year: 'numeric' }
                                  : { month: 'long', year: 'numeric' }
                              )}
                            </td>
                            <td className="p-2 text-right font-mono">
                              {formatCurrency(item.total_value)}
                            </td>
                            <td className={`p-2 text-right font-mono ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {index > 0 ? (
                                <>
                                  {change >= 0 ? '+' : ''}{formatCurrency(change)}
                                </>
                              ) : '-'}
                            </td>
                            {isPremium && (
                              <td className={`p-2 text-right font-mono ${percentChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {index > 0 ? (
                                  <>
                                    {percentChange >= 0 ? '+' : ''}{percentChange.toFixed(2)}%
                                  </>
                                ) : '-'}
                              </td>
                            )}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex items-center justify-center h-32">
                  <div className="text-center text-muted-foreground">
                    <BarChart3 className="h-8 w-8 mx-auto mb-2" />
                    <p>Nenhum dado histórico disponível</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </FadeIn>
      </TabsContent>
    </Tabs>
  )
}