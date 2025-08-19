"use client"

import { useState, useEffect, useCallback } from "react"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { useAuth } from "@/lib/auth"
import { PortfolioService } from "@/lib/portfolio"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { TrendingUp, TrendingDown, Calendar, Filter, BarChart3, Eye, Crown, Loader2, DollarSign, Zap, Settings, Monitor, Target, Activity, PieChart } from "lucide-react"
import { toast } from "sonner"
import { useUserPlan } from "@/hooks/use-user-plan"
import PortfolioChart from "@/components/PortfolioChart"
import AdvancedPortfolioChart from "@/components/dashboard/timeline/advanced-portfolio-chart"
import AdvancedFilters from "@/components/dashboard/timeline/advanced-filters"
import TradingViewChart from "@/components/dashboard/timeline/tradingview-chart"
import PremiumAnalytics from "@/components/dashboard/timeline/premium-analytics"
import AssetDrillDown from "@/components/dashboard/timeline/asset-drill-down"
import { benchmarkService } from "@/lib/benchmarks"

interface TimelineFilters {
  period: '1M' | '3M' | '6M' | '1Y' | '2Y' | 'ALL' | 'CUSTOM'
  customFrom?: string
  customTo?: string
  accountIds: string[]
  assetClasses: string[]
  selectedAssets: string[]
  showCashOnly: boolean
  showProjections: boolean
  granularity: 'daily' | 'monthly'
  showAssetBreakdown: boolean
  benchmark?: string | undefined
  excludeZeroValues: boolean
}

export default function TimelinePage() {
  const { user } = useAuth()
  const { isPremium } = useUserPlan()
  const [loading, setLoading] = useState(true)
  const [portfolioData, setPortfolioData] = useState<any>(null)
  const [accounts, setAccounts] = useState<Array<{ id: string; label: string }>>([])
  const [assets, setAssets] = useState<Array<{ id: string; symbol: string; class: string }>>([])
  const [view, setView] = useState<'chart' | 'table' | 'advanced' | 'tradingview' | 'analytics' | 'drill-down'>('chart')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const [assetBreakdownData, setAssetBreakdownData] = useState<any>(null)
  const [benchmarkData, setBenchmarkData] = useState<any>(null)
  const [performanceAnalysis, setPerformanceAnalysis] = useState<any[]>([])
  const [selectedAssetForDrillDown, setSelectedAssetForDrillDown] = useState<string | null>(null)
  const [assetDailyPositions, setAssetDailyPositions] = useState<any[]>([])
  
  const [filters, setFilters] = useState<TimelineFilters>({
    period: '1Y',
    accountIds: [],
    assetClasses: [],
    selectedAssets: [],
    showCashOnly: false,
    showProjections: false,
    granularity: 'monthly',
    showAssetBreakdown: false,
    benchmark: undefined,
    excludeZeroValues: false
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

  const loadTimelineData = useCallback(async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      const { from, to } = getDateRange()
      
      const portfolioService = new PortfolioService(user.id, { assumedPlan: isPremium ? 'premium' : 'free' })
      // Garantir que o serviço sabe o plano do usuário antes de chamadas premium
      await portfolioService.initialize()
      
      // Carregar dados básicos reais
      const [monthlyData, dailyData, holdingsData, accountsData, assetsData] = await Promise.all([
        portfolioService.getMonthlySeries(from, to),
        isPremium && filters.granularity === 'daily' ? portfolioService.getDailySeries(from, to).catch(() => null) : Promise.resolve(null),
        portfolioService.getHoldingsAt(to),
        portfolioService.getAccounts().catch(() => []),
        portfolioService.getUniqueAssets(to).catch(() => [])
      ])

      // Carregar dados por ativo se solicitado (Premium) - DADOS REAIS
      let assetBreakdown = null
      if (isPremium && filters.showAssetBreakdown) {
        try {
          assetBreakdown = await portfolioService.getAssetBreakdown(from, to)
        } catch (error) {
          console.error('Erro ao carregar breakdown por ativo:', error)
          // Fallback para dados baseados nos holdings atuais
          const totalValue = holdingsData?.reduce((sum: number, h: any) => sum + h.value, 0) || 0
          assetBreakdown = holdingsData?.map((holding: any) => ({
            date: to,
            asset_id: holding.asset_id,
            asset_symbol: holding.symbol || holding.asset_id,
            asset_class: holding.class || 'unknown',
            value: holding.value,
            percentage: totalValue > 0 ? (holding.value / totalValue) * 100 : 0
          })) || []
        }
      }

      setPortfolioData({
        monthlySeries: monthlyData,
        dailySeries: dailyData,
        holdingsAt: holdingsData,
        period: { from, to }
      })
      
      setAssetBreakdownData(assetBreakdown)
      
      // Usar contas reais do banco
      setAccounts(accountsData)
      
      // Usar ativos reais do banco
      setAssets(assetsData)

      // Carregar dados de benchmark se selecionado (Premium)
      if (isPremium && filters.benchmark) {
        try {
          const benchmarkResult = await benchmarkService.getBenchmarkData(filters.benchmark, from, to)
          setBenchmarkData(benchmarkResult)
        } catch (error) {
          console.error('Erro ao carregar benchmark:', error)
          setBenchmarkData(null)
        }
      } else {
        setBenchmarkData(null)
      }

      // Carregar análise de performance avançada se Premium e dados diários ativados
      if (isPremium && filters.granularity === 'daily') {
        try {
          const performanceData = await portfolioService.getAssetPerformanceAnalysis(from, to)
          setPerformanceAnalysis(performanceData)
        } catch (error) {
          console.error('Erro ao carregar análise de performance:', error)
          setPerformanceAnalysis([])
        }
      } else {
        setPerformanceAnalysis([])
      }
      
    } catch (error) {
      console.error('Erro ao carregar timeline:', error)
      toast.error('Erro ao carregar dados da timeline')
    } finally {
      setLoading(false)
    }
  }, [user?.id, getDateRange, isPremium, filters.showAssetBreakdown, filters.benchmark, filters.granularity])

  useEffect(() => {
    loadTimelineData()
  }, [loadTimelineData])

  const handleFiltersChange = (newFilters: Partial<TimelineFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }

  const handleAssetDrillDown = async (assetId: string) => {
    if (!user?.id || !isPremium) return

    try {
      setLoading(true)
      const { from, to } = getDateRange()
      const portfolioService = new PortfolioService(user.id)
      
      const dailyPositions = await portfolioService.getDailyPositionsByAsset(assetId, from, to)
      setAssetDailyPositions(dailyPositions)
      setSelectedAssetForDrillDown(assetId)
      setView('drill-down')
    } catch (error) {
      console.error('Erro ao carregar dados do ativo:', error)
      toast.error('Erro ao carregar dados do ativo')
    } finally {
      setLoading(false)
    }
  }

  const handleLoadAccountAssetData = async (accountId: string, assetId: string) => {
    if (!user?.id || !isPremium) return []

    const { from, to } = getDateRange()
    const portfolioService = new PortfolioService(user.id)
    return await portfolioService.getDailyPositionsByAccountAsset(accountId, assetId, from, to)
  }

  const getSelectedAssetInfo = () => {
    if (!selectedAssetForDrillDown) return null
    const asset = assets.find(a => a.id === selectedAssetForDrillDown)
    return asset || null
  }

  const calculateTotalValue = () => {
    if (!portfolioData?.holdingsAt) return 0
    return portfolioData.holdingsAt.reduce((total: number, holding: any) => total + Number(holding.value || 0), 0)
  }

  // Determinar série ativa conforme granularidade
  const getActiveSeries = () => {
    const dailyActive = isPremium && filters.granularity === 'daily' && portfolioData?.dailySeries?.length
      ? (portfolioData?.dailySeries || [])
      : null
    if (dailyActive) {
      const arr = dailyActive.map((d: any) => ({ date: d.date, total_value: d.total_value }))
      return filters.excludeZeroValues ? arr.filter((x: any) => x.total_value > 0) : arr
    }
    const monthlyActive = portfolioData?.monthlySeries || []
    const arr = monthlyActive.map((m: any) => ({ date: m.month_eom, total_value: m.total_value }))
    return filters.excludeZeroValues ? arr.filter((x: any) => x.total_value > 0) : arr
  }

  const calculateReturns = () => {
    const active = getActiveSeries()
    if (!active || active.length < 2) {
      return { totalReturn: 0, totalReturnPercent: 0, periodReturn: 0 }
    }

    const initial = active[0].total_value
    const final = active[active.length - 1].total_value
    const totalReturn = final - initial
    const totalReturnPercent = initial > 0 ? (totalReturn / initial) * 100 : 0

    // Retorno do último intervalo (dia/mês conforme granularidade)
    const prev = active[active.length - 2].total_value
    const current = active[active.length - 1].total_value
    const periodReturn = prev > 0 ? ((current - prev) / prev) * 100 : 0
    return { totalReturn, totalReturnPercent, periodReturn }
  }

  const { totalReturn, totalReturnPercent, periodReturn } = calculateReturns()
  const totalValue = calculateTotalValue()

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  return (
    <DashboardLayout
      title="Linha do Tempo"
      description="Acompanhe a evolução do seu patrimônio ao longo do tempo"
      icon={<TrendingUp className="h-6 w-6" />}
      backHref="/dashboard"
      breadcrumbs={[
        { label: "Painel", href: "/dashboard" },
        { label: "Linha do Tempo" },
      ]}
      actions={
        <div className="flex items-center space-x-2">
          {!isPremium && (
            <Badge variant="secondary" className="flex items-center space-x-1">
              <Eye className="h-3 w-3" />
              <span>Básico</span>
            </Badge>
          )}
          {isPremium && (
            <Badge variant="default" className="flex items-center space-x-1">
              <Crown className="h-3 w-3" />
              <span>Premium</span>
            </Badge>
          )}
          <div className="flex items-center space-x-1 bg-background border rounded-md">
            <Button
              variant={view === 'chart' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('chart')}
              title="Gráfico Simples"
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            {isPremium && (
              <>
                <Button
                  variant={view === 'advanced' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setView('advanced')}
                  title="Gráfico Avançado"
                >
                  <Zap className="h-4 w-4" />
                </Button>
                <Button
                  variant={view === 'analytics' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setView('analytics')}
                  title="Analytics Premium"
                  disabled={filters.granularity !== 'daily'}
                >
                  <Target className="h-4 w-4" />
                </Button>
                <Button
                  variant={view === 'tradingview' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setView('tradingview')}
                  title="TradingView Professional"
                >
                  <Monitor className="h-4 w-4" />
                </Button>
              </>
            )}
            <Button
              variant={view === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('table')}
              title="Visualização em Tabela"
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Filtros Básicos de Período */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Filter className="h-5 w-5" />
              <span>Período</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">Selecionar:</span>
                <div className="flex space-x-1">
                  {['1M', '3M', '6M', '1Y', '2Y', 'ALL'].map((period) => (
                    <Button
                      key={period}
                      variant={filters.period === period ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => handleFiltersChange({ period: period as any })}
                      disabled={!isPremium && ['2Y', 'ALL'].includes(period)}
                    >
                      {period === 'ALL' ? 'Tudo' : period}
                      {!isPremium && ['2Y', 'ALL'].includes(period) && <Crown className="h-3 w-3 ml-1" />}
                    </Button>
                  ))}
                </div>
              </div>
              
              {filters.period === 'CUSTOM' && (
                <div className="flex items-center space-x-2">
                  <input
                    type="date"
                    value={filters.customFrom || ''}
                    onChange={(e) => handleFiltersChange({ customFrom: e.target.value })}
                    className="px-3 py-1 border rounded text-sm"
                  />
                  <span className="text-sm">até</span>
                  <input
                    type="date"
                    value={filters.customTo || ''}
                    onChange={(e) => handleFiltersChange({ customTo: e.target.value })}
                    className="px-3 py-1 border rounded text-sm"
                  />
                </div>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleFiltersChange({ period: 'CUSTOM' })}
                disabled={!isPremium}
              >
                <Calendar className="h-4 w-4 mr-1" />
                Personalizado
                {!isPremium && <Crown className="h-3 w-3 ml-1" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Filtros Avançados Premium */}
        <AdvancedFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          accounts={accounts}
          assets={assets}
          isPremium={isPremium}
          isOpen={showAdvancedFilters}
          onToggle={() => setShowAdvancedFilters(!showAdvancedFilters)}
        />

        {/* Cards de Resumo */}
        {portfolioData && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(totalValue)}</div>
                <p className="text-xs text-muted-foreground">
                  Patrimônio atual
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Retorno Total</CardTitle>
                <TrendingUp className={`h-4 w-4 ${totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalReturn >= 0 ? '+' : ''}{formatCurrency(totalReturn)}
                </div>
                <p className={`text-xs ${totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalReturn >= 0 ? '+' : ''}{totalReturnPercent.toFixed(2)}% no período
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Última Variação</CardTitle>
                <TrendingUp className={`h-4 w-4 ${periodReturn >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${periodReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {periodReturn >= 0 ? '+' : ''}{periodReturn.toFixed(2)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Último {isPremium && filters.granularity === 'daily' ? 'dia' : 'mês'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pontos de Dados</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {getActiveSeries().length}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isPremium && filters.granularity === 'daily' && portfolioData?.dailySeries ? 'Dados diários' : 'Dados mensais'}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Conteúdo Principal */}
        <Tabs value={view} onValueChange={(value) => setView(value as any)}>
          <TabsList className={`grid w-full ${isPremium ? 'grid-cols-6' : 'grid-cols-2'}`}>
            <TabsTrigger value="chart" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Simples</span>
            </TabsTrigger>
            {isPremium && (
              <>
                <TabsTrigger value="advanced" className="flex items-center space-x-2">
                  <Zap className="h-4 w-4" />
                  <span>Avançado</span>
                </TabsTrigger>
                <TabsTrigger 
                  value="analytics" 
                  className="flex items-center space-x-2"
                  disabled={filters.granularity !== 'daily'}
                >
                  <Target className="h-4 w-4" />
                  <span>Analytics</span>
                </TabsTrigger>
                <TabsTrigger value="tradingview" className="flex items-center space-x-2">
                  <Monitor className="h-4 w-4" />
                  <span>Professional</span>
                </TabsTrigger>
                <TabsTrigger value="drill-down" className="flex items-center space-x-2">
                  <Activity className="h-4 w-4" />
                  <span>Drill-Down</span>
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="table" className="flex items-center space-x-2">
              <Eye className="h-4 w-4" />
              <span>Dados</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="chart" className="space-y-4">
            {loading ? (
              <Card>
                <CardContent className="flex items-center justify-center h-64">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-8 w-8 animate-spin" />
                    <span>Carregando timeline...</span>
                  </div>
                </CardContent>
              </Card>
            ) : portfolioData?.monthlySeries ? (
              <PortfolioChart
                monthlyData={portfolioData.monthlySeries}
                dailyData={portfolioData.dailySeries}
                isLoading={loading}
              />
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center h-64">
                  <div className="text-center">
                    <p className="text-muted-foreground mb-2">Nenhum dado disponível</p>
                    <p className="text-sm text-muted-foreground">
                      Adicione alguns eventos para ver a evolução do seu patrimônio
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Gráfico Avançado Premium */}
          {isPremium && (
            <TabsContent value="advanced" className="space-y-4">
              {loading ? (
                <Card>
                  <CardContent className="flex items-center justify-center h-64">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="h-8 w-8 animate-spin" />
                      <span>Carregando gráfico avançado...</span>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <AdvancedPortfolioChart
                  monthlyData={portfolioData?.monthlySeries || []}
                  dailyData={portfolioData?.dailySeries}
                  assetBreakdown={assetBreakdownData}
                  isLoading={loading}
                  showAssetBreakdown={filters.showAssetBreakdown}
                  granularity={filters.granularity}
                />
              )}
            </TabsContent>
          )}

          {/* Analytics Premium */}
          {isPremium && (
            <TabsContent value="analytics" className="space-y-4">
              <PremiumAnalytics
                performanceData={performanceAnalysis}
                benchmarkData={benchmarkData}
                isLoading={loading}
                period={{ from: getDateRange().from, to: getDateRange().to }}
              />
            </TabsContent>
          )}

          {/* Drill-Down Premium */}
          {isPremium && (
            <TabsContent value="drill-down" className="space-y-4">
              {view === 'drill-down' && selectedAssetForDrillDown ? (
                <AssetDrillDown
                  assetId={selectedAssetForDrillDown}
                  assetSymbol={getSelectedAssetInfo()?.symbol || undefined}
                  assetClass={getSelectedAssetInfo()?.class || undefined}
                  dailyPositions={assetDailyPositions}
                  accounts={accounts}
                  onLoadAccountData={handleLoadAccountAssetData}
                  onBack={() => setView('advanced')}
                  isLoading={loading}
                />
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center h-64">
                    <div className="text-center space-y-4">
                      <Activity className="h-12 w-12 mx-auto text-muted-foreground" />
                      <div>
                        <h3 className="font-semibold mb-2">Análise Individual de Ativos</h3>
                        <p className="text-muted-foreground mb-4">
                          Selecione um ativo no gráfico avançado para ver análise detalhada
                        </p>
                      </div>
                      <Button onClick={() => setView('advanced')}>
                        Ir para Gráfico Avançado
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}

          {/* TradingView Professional */}
          {isPremium && (
            <TabsContent value="tradingview" className="space-y-4">
              <TradingViewChart
                portfolioData={portfolioData || {}}
                theme="dark"
                height={600}
                isPremium={isPremium}
              />
            </TabsContent>
          )}
          
          <TabsContent value="table" className="space-y-4">
            <Card>
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
                            <tr key={index} className="border-b">
                              <td className="p-2">
                                {new Date(item.date).toLocaleDateString('pt-BR', 
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
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum dado disponível para o período selecionado
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Upgrade para Premium */}
        {!isPremium && (
          <Card className="border-gradient-to-r from-yellow-200 to-orange-200 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950 dark:to-orange-950">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Crown className="h-6 w-6 text-yellow-600" />
                    <h3 className="font-bold text-lg text-yellow-800 dark:text-yellow-200">
                      Desbloqueie o Poder Completo da Timeline
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center space-x-2 text-yellow-700 dark:text-yellow-300">
                      <Target className="h-4 w-4" />
                      <span>Analytics Premium com métricas avançadas</span>
                    </div>
                    <div className="flex items-center space-x-2 text-yellow-700 dark:text-yellow-300">
                      <Activity className="h-4 w-4" />
                      <span>Drill-down individual por ativo</span>
                    </div>
                    <div className="flex items-center space-x-2 text-yellow-700 dark:text-yellow-300">
                      <BarChart3 className="h-4 w-4" />
                      <span>Dados diários granulares</span>
                    </div>
                    <div className="flex items-center space-x-2 text-yellow-700 dark:text-yellow-300">
                      <PieChart className="h-4 w-4" />
                      <span>Análise de risco e volatilidade</span>
                    </div>
                    <div className="flex items-center space-x-2 text-yellow-700 dark:text-yellow-300">
                      <Filter className="h-4 w-4" />
                      <span>Filtros avançados por conta/ativo</span>
                    </div>
                    <div className="flex items-center space-x-2 text-yellow-700 dark:text-yellow-300">
                      <TrendingUp className="h-4 w-4" />
                      <span>Comparação com benchmarks</span>
                    </div>
                  </div>
                </div>
                <div className="text-center">
                  <Button className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white border-0">
                    <Crown className="h-4 w-4 mr-2" />
                    Fazer Upgrade
                  </Button>
                  <p className="text-xs text-muted-foreground mt-2">
                    Análise profissional completa
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
