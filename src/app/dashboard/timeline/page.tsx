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
import { TrendingUp, TrendingDown, Calendar, Filter, BarChart3, Eye, Crown, Loader2, DollarSign } from "lucide-react"
import { toast } from "sonner"
import { useUserPlan } from "@/hooks/use-user-plan"
import PortfolioChart from "@/components/PortfolioChart"

interface TimelineFilters {
  period: '1M' | '3M' | '6M' | '1Y' | '2Y' | 'ALL' | 'CUSTOM'
  customFrom?: string
  customTo?: string
  accountIds: string[]
  assetClasses: string[]
  showCashOnly: boolean
  showProjections: boolean
}

export default function TimelinePage() {
  const { user } = useAuth()
  const { isPremium } = useUserPlan()
  const [loading, setLoading] = useState(true)
  const [portfolioData, setPortfolioData] = useState<any>(null)
  const [accounts, setAccounts] = useState<Array<{ id: string; label: string }>>([])
  const [view, setView] = useState<'chart' | 'table'>('chart')
  
  const [filters, setFilters] = useState<TimelineFilters>({
    period: '1Y',
    accountIds: [],
    assetClasses: [],
    showCashOnly: false,
    showProjections: false
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
      
      const portfolioService = new PortfolioService(user.id)
      
      // Carregar dados básicos
      const [monthlyData, dailyData, holdingsData] = await Promise.all([
        portfolioService.getMonthlySeries(from, to),
        isPremium ? portfolioService.getDailySeries(from, to).catch(() => null) : Promise.resolve(null),
        portfolioService.getHoldingsAt(to)
      ])

      setPortfolioData({
        monthlySeries: monthlyData,
        dailySeries: dailyData,
        holdingsAt: holdingsData,
        period: { from, to }
      })
      
    } catch (error) {
      console.error('Erro ao carregar timeline:', error)
      toast.error('Erro ao carregar dados da timeline')
    } finally {
      setLoading(false)
    }
  }, [user?.id, getDateRange, isPremium])

  useEffect(() => {
    loadTimelineData()
  }, [loadTimelineData])

  const handleFiltersChange = (newFilters: Partial<TimelineFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }))
  }

  const calculateTotalValue = () => {
    if (!portfolioData?.holdingsAt) return 0
    return portfolioData.holdingsAt.reduce((total: number, holding: any) => total + holding.value, 0)
  }

  const calculateReturns = () => {
    if (!portfolioData?.monthlySeries || portfolioData.monthlySeries.length < 2) {
      return { totalReturn: 0, totalReturnPercent: 0, monthlyReturn: 0 }
    }
    
    const series = portfolioData.monthlySeries
    const initial = series[0].total_value
    const final = series[series.length - 1].total_value
    const totalReturn = final - initial
    const totalReturnPercent = initial > 0 ? (totalReturn / initial) * 100 : 0
    
    // Retorno mensal (últimos dois pontos)
    if (series.length >= 2) {
      const previousMonth = series[series.length - 2].total_value
      const currentMonth = series[series.length - 1].total_value
      const monthlyReturn = previousMonth > 0 ? ((currentMonth - previousMonth) / previousMonth) * 100 : 0
      return { totalReturn, totalReturnPercent, monthlyReturn }
    }
    
    return { totalReturn, totalReturnPercent, monthlyReturn: 0 }
  }

  const { totalReturn, totalReturnPercent, monthlyReturn } = calculateReturns()
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
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
            <Button
              variant={view === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setView('table')}
            >
              <Eye className="h-4 w-4" />
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Filtros de Período */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Filter className="h-5 w-5" />
              <span>Filtros de Timeline</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-medium">Período:</span>
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
                <TrendingUp className={`h-4 w-4 ${monthlyReturn >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${monthlyReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {monthlyReturn >= 0 ? '+' : ''}{monthlyReturn.toFixed(2)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  Último período
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
                  {portfolioData?.monthlySeries?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {isPremium && portfolioData?.dailySeries ? 'Dados diários' : 'Dados mensais'}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Conteúdo Principal */}
        <Tabs value={view} onValueChange={(value) => setView(value as 'chart' | 'table')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="chart" className="flex items-center space-x-2">
              <BarChart3 className="h-4 w-4" />
              <span>Gráfico</span>
            </TabsTrigger>
            <TabsTrigger value="table" className="flex items-center space-x-2">
              <Eye className="h-4 w-4" />
              <span>Tabela</span>
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
                ) : portfolioData?.monthlySeries ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left p-2">Período</th>
                          <th className="text-right p-2">Valor Total</th>
                          <th className="text-right p-2">Variação</th>
                          {isPremium && <th className="text-right p-2">% Crescimento</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {portfolioData.monthlySeries.map((item: any, index: number) => {
                          const previousValue = index > 0 ? portfolioData.monthlySeries[index - 1].total_value : 0
                          const change = item.total_value - previousValue
                          const percentChange = previousValue > 0 ? (change / previousValue) * 100 : 0
                          
                          return (
                            <tr key={index} className="border-b">
                              <td className="p-2">
                                {new Date(item.month_eom).toLocaleDateString('pt-BR', { 
                                  month: 'long', 
                                  year: 'numeric' 
                                })}
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
          <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                    Desbloqueie mais recursos da Timeline
                  </h3>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                    Com o plano Premium você tem acesso a dados diários, períodos personalizados, filtros avançados por conta e classe de ativo, projeções e muito mais.
                  </p>
                </div>
                <Button variant="outline" className="border-yellow-300 hover:bg-yellow-100">
                  <Crown className="h-4 w-4 mr-2" />
                  Fazer Upgrade
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  )
}
