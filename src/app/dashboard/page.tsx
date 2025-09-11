"use client"

import { useState } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { useAuth } from "@/lib/auth"
import { useDashboardBundle } from "@/lib/hooks/useDashboardBundle"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { StatusBadge } from "@/components/ui/status-badge"
import { AssetBadge } from "@/components/ui/asset-badge"
import {
  BarChart3,
  Wallet,
  TrendingUp,
  Settings,
  LogOut,
  Plus,
  DollarSign,
  PieChart,
  Activity,
  ArrowUp,
  ArrowDown,
  Clock,
  Users,
  Edit3,
  RefreshCw,
  Crown
} from "lucide-react"
import MiniChart from "@/components/ui/mini-chart"
import PortfolioChart from "@/components/PortfolioChart"
import Link from "next/link"
import Image from "next/image"
import { toast } from "sonner"
import ThemeSwitch from "@/components/ThemeSwitch"
import { getAssetDisplayLabel } from "@/lib/utils/assets"
import { PatrimonyFAB } from "@/components/ui/patrimony-fab"
import { formatBRL } from "@/lib/utils/formatters"

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const { data: dashboardData, isLoading, timelineLoading, error, refresh } = useDashboardBundle()
  const [refreshing, setRefreshing] = useState(false)

  // Extract data from consolidated bundle (with fallbacks for loading state)
  const userContext = dashboardData?.user_context || { is_premium: false, last_event_timestamp: null }
  const isPremium = userContext.is_premium
  const portfolioStats = dashboardData?.portfolio_stats || { totalValue: 0, total_value: 0, total_assets: 0 }
  const holdingsData = dashboardData?.holdings || []
  const monthlyData = dashboardData?.monthly_series || []
  const dailyData = dashboardData?.daily_series || []

  // All data loading is now handled by useDashboardBundle hook

  const handleSignOut = async () => {
    await signOut()
  }

  const handleRefresh = async () => {
    if (refreshing) return
    
    setRefreshing(true)
    
    try {
      await refresh()
      toast.success('Dados atualizados com sucesso!')
    } catch (error) {
      console.error('Erro ao recarregar:', error)
      toast.error('Erro ao recarregar dados')
    } finally {
      setRefreshing(false)
    }
  }

  const calculate6MonthPerformance = () => {
    // Use consolidated data from bundle
    const timelineData = isPremium ? dailyData : monthlyData
    if (timelineData.length < 2) return { percentage: 0, isPositive: true }
    
    const firstValue = timelineData[0]?.total_value || 0
    const lastValue = timelineData[timelineData.length - 1]?.total_value || 0
    
    if (firstValue === 0) return { percentage: 0, isPositive: true }
    
    const percentage = ((lastValue - firstValue) / firstValue) * 100
    return { percentage, isPositive: percentage >= 0 }
  }

  const getLargestHolding = () => {
    if (!holdingsData?.length) return { symbol: 'N/A', percentage: 0, loading: false }
    
    const totalValue = holdingsData.reduce((sum: number, h: any) => sum + (h.value || 0), 0)
    
    if (totalValue === 0) return { symbol: 'N/A', percentage: 0, loading: false }
    
    const largest = holdingsData.reduce((max: any, current: any) => 
      (current.value || 0) > (max.value || 0) ? current : max
    )
    
    const percentage = ((largest.value || 0) / totalValue) * 100
    
    // Use symbol directly from api_holdings_with_assets data
    const symbol = largest.symbol || largest.asset_id || 'N/A'
    
    return { 
      symbol, 
      percentage: isNaN(percentage) ? 0 : percentage,
      loading: false
    }
  }

  const getDiversificationScore = () => {
    if (!holdingsData?.length) return { score: 0, label: 'Sem dados' }
    
    const totalValue = holdingsData.reduce((sum: number, h: any) => sum + (h.value || 0), 0)

    if (totalValue === 0 || holdingsData.length === 0) return { score: 0, label: 'Sem dados' }

    // Calculate Herfindahl-Hirschman Index (HHI) for diversification
    const hhi = holdingsData.reduce((sum: number, holding: any) => {
      const weight = (holding.value || 0) / totalValue
      if (isNaN(weight)) return sum
      return sum + (weight * weight)
    }, 0)

    // Convert HHI to diversification score (0-100, higher = more diversified)
    const diversificationScore = Math.max(0, 100 - (hhi * 100))

    if (isNaN(diversificationScore)) return { score: 0, label: 'Sem dados' }

    let label = 'Baixa'
    if (diversificationScore > 70) label = 'Alta'
    else if (diversificationScore > 40) label = 'Média'

    return { score: diversificationScore, label }
  }

  const getAssetClassDistribution = () => {
    if (!holdingsData?.length) {
      return { diversityLabel: 'Sem dados' }
    }
    
    const numAssets = holdingsData.length
    
    // Simple diversity calculation based on number of assets
    let diversityLabel = 'Concentrado'
    if (numAssets >= 5) diversityLabel = 'Diversificado'
    else if (numAssets >= 3) diversityLabel = 'Balanceado'
    
    return { diversityLabel }
  }

  const menuItems = [
    {
      title: "Análise Temporal",
      description: "Visualização completa da evolução dos seus ativos",
      icon: BarChart3,
      href: "/dashboard/timeline",
      badge: "success",
      isPrimary: true,
    },
    {
      title: "Contas",
      description: "Gerenciar contas e corretoras",
      icon: Wallet,
      href: "/dashboard/accounts",
      badge: "primary",
    },
    {
      title: "Meus Ativos",
      description: "Ativos customizados do portfólio",
      icon: TrendingUp,
      href: "/dashboard/assets",
      badge: "secondary",
    },
    {
      title: "Transações",
      description: "Eventos e movimentações",
      icon: Activity,
      href: "/dashboard/transactions",
      badge: "info",
    },
    {
      title: "Configurações",
      description: "Gerenciar assinatura, perfil e configurações",
      icon: Settings,
      href: "/dashboard/settings",
      badge: "neutral",
    },
  ]

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        {/* Enhanced Header */}
        <header className="border-b bg-gradient-to-r from-card/95 via-card to-card/95 backdrop-blur-md shadow-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Image
                  src="/icon.svg"
                  alt="Afino Finance"
                  width={32}
                  height={32}
                  className="h-8 w-8"
                />
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">Afino</h1>
                  <p className="text-sm text-muted-foreground font-medium">Visualização de Ativos</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <Badge variant={isPremium ? "default" : "secondary"} className={isPremium ? "bg-yellow-100 text-yellow-800" : ""}>
                  {isPremium && <Crown className="h-3 w-3 mr-1" />}
                  {isPremium ? 'Premium' : 'Free'}
                </Badge>
                <Badge variant="secondary">
                  {user?.email}
                </Badge>
                <ThemeSwitch />
                <Link href="/dashboard/settings">
                  <Button
                    variant="outline"
                    size="sm"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Gerenciar
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshing}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Recarregar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="dashboard-page">

          {/* Enhanced Quick Stats */}
          <div className="stats-grid animate-fade-in-up delay-150">
            <Card className="card-hover">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Patrimônio Total</CardTitle>
                <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
                  <DollarSign className="h-4 w-4 text-primary" />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <LoadingState variant="inline" size="sm" message="Carregando..." />
                ) : (
                  <>
                    <div className="text-2xl font-bold text-foreground">
                      {portfolioStats ? formatBRL(portfolioStats.total_value || 0) : 'R$ 0,00'}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {(isPremium ? dailyData : monthlyData).length > 0 && calculate6MonthPerformance().percentage !== 0 ? (
                        <StatusBadge variant={calculate6MonthPerformance().isPositive ? "success" : "error"} size="sm">
                          {calculate6MonthPerformance().isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                          {calculate6MonthPerformance().isPositive ? '+' : ''}{calculate6MonthPerformance().percentage.toFixed(1)}%
                        </StatusBadge>
                      ) : (
                        <StatusBadge variant="neutral" size="sm">
                          Sem variação
                        </StatusBadge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {holdingsData?.length ? `${holdingsData.length} posições` : 'Sem dados'}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="card-hover">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tipos de Ativo</CardTitle>
                <div className="p-2 rounded-lg bg-gradient-to-br from-secondary/20 to-secondary/10">
                  <TrendingUp className="h-4 w-4 text-secondary-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <LoadingState variant="inline" size="sm" message="Carregando..." />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {holdingsData?.length || 0}
                    </div>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <AssetBadge assetClass="stock" size="sm" showLabel={false} />
                      <AssetBadge assetClass="crypto" size="sm" showLabel={false} />
                      <AssetBadge assetClass="currency" size="sm" showLabel={false} />
                      <span className="text-xs text-muted-foreground">
                        {getAssetClassDistribution().diversityLabel}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="card-hover">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Maior Posição</CardTitle>
                <div className="p-2 rounded-lg bg-gradient-to-br from-info/20 to-info/10">
                  <TrendingUp className="h-4 w-4 text-blue-600" />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <LoadingState variant="inline" size="sm" message="Carregando..." />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {getLargestHolding().symbol}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge variant="info" size="sm">
                        {getLargestHolding().percentage.toFixed(1)}%
                      </StatusBadge>
                      <span className="text-xs text-muted-foreground">
                        do portfólio
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card className="card-hover">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Diversificação</CardTitle>
                <div className="p-2 rounded-lg bg-gradient-to-br from-accent/20 to-accent/10">
                  <PieChart className="h-4 w-4 text-accent-foreground" />
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <LoadingState variant="inline" size="sm" message="Carregando..." />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {getDiversificationScore().score.toFixed(0)}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge 
                        variant={getDiversificationScore().score > 70 ? "success" : getDiversificationScore().score > 40 ? "warning" : "neutral"} 
                        size="sm"
                      >
                        {getDiversificationScore().label}
                      </StatusBadge>
                      <span className="text-xs text-muted-foreground">
                        diversificação
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Timeline Preview - Main Content */}
          <div className="space-y-6 mb-8">
            {/* Timeline Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold">Evolução Temporal</h2>
                <p className="text-muted-foreground">
                  {isPremium ? 'Últimos 6 meses' : 'Últimos 12 meses'} • 
                  Visualização {isPremium ? 'diária' : 'mensal'}
                </p>
              </div>
              <Link href="/dashboard/timeline">
                <Button className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Análise Detalhada
                </Button>
              </Link>
            </div>

            {/* Main Timeline Chart */}
            <Card className="card-hover animate-fade-in-up delay-300">
              <CardContent className="pt-6">
                {timelineLoading ? (
                  <div className="h-64 flex items-center justify-center">
                    <LoadingState message="Carregando gráficos..." />
                  </div>
                ) : (isPremium ? dailyData : monthlyData).length > 0 ? (
                  <PortfolioChart
                    monthlyData={isPremium ? [] : monthlyData}
                    dailyData={isPremium ? dailyData : []}
                    isLoading={false}
                  />
                ) : (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Nenhum dado disponível</p>
                      <Link href="/dashboard/patrimony/new">
                        <Button variant="outline" className="mt-2">
                          Adicionar Primeiro Evento
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Analytics - Hidden for now since performance data is not in bundle yet */}
            {false && (
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total de Ativos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold">
                      {holdingsData?.length || 0}
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

        </main>

        {/* Floating Action Button */}
        <PatrimonyFAB />
      </div>
    </ProtectedRoute>
  )
}