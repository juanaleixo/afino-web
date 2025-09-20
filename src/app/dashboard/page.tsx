"use client"

import { useState, useRef } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { useAuth } from "@/lib/auth"
import { useDashboard } from "@/lib/hooks/useDashboard"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DashboardSkeleton, StatsSkeleton, ChartSkeleton } from "@/components/ui/dashboard-skeleton"
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
  const {
    data: dashboardData,
    dashboardData: fullData,
    isLoading,
    isLoadingEssential,
    isLoadingDetailed,
    timelineLoading,
    error,
    holdingsError,
    refresh,
    refreshTimeline,
    loadingState,
    isPremium: dashboardIsPremium,
    hasData
  } = useDashboard()

  // Extract data from critical dashboard (with optimized fallbacks)
  const userContext = dashboardData?.user_context || { is_premium: false, last_event_timestamp: null }
  const isPremium = dashboardIsPremium || userContext.is_premium
  const portfolioStats = dashboardData?.portfolio_stats || { total_value: 0, total_assets: 0, performance_6m: null, largest_holding: null, diversification: null }
  const holdingsData = dashboardData?.holdings || []
  const monthlyData = dashboardData?.monthly_series || []
  const dailyData = dashboardData?.daily_series || []

  // All data loading is now handled by useDashboardBundle hook

  const handleSignOut = async () => {
    await signOut()
  }

  const handleRefresh = async () => {
    // Evitar múltiplos cliques durante carregamento
    if (isLoading || isLoadingEssential) return

    try {
      await refresh() // Refresh completo de todas as camadas
      toast.success('Dados atualizados com sucesso')
    } catch (error) {
      console.error('Refresh error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar dados'
      toast.error(`⚠️ ${errorMessage}`)
    }
  }

  const handleTimelineRefresh = async () => {
    // Evitar múltiplos cliques durante carregamento
    if (timelineLoading) return

    try {
      await refreshTimeline() // Refresh apenas da timeline
      toast.success('📈 Gráficos atualizados')
    } catch (error) {
      console.error('Timeline refresh error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Erro ao atualizar gráficos'
      toast.error(`⚠️ ${errorMessage}`)
    }
  }

  const getAssetClassDistribution = () => {
    if (!holdingsData?.length) {
      // Durante carregamento, mostrar baseado no patrimônio total
      return { diversityLabel: fullData?.essential?.total_value > 0 ? 'Carregando...' : 'Sem dados' }
    }

    const numAssets = holdingsData.length

    // Simple diversity calculation based on number of assets
    let diversityLabel = 'Concentrado'
    if (numAssets >= 5) diversityLabel = 'Diversificado'
    else if (numAssets >= 3) diversityLabel = 'Balanceado'

    return { diversityLabel }
  }
  

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
                  disabled={isLoading || isLoadingEssential}
                  className={isLoading ? 'opacity-75' : ''}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                  {isLoading ? 'Atualizando...' : 'Recarregar'}
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

          {/* Holdings Error Banner */}
          {holdingsError && (
            <div className="mb-6">
              <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-900/20">
                <CardContent className="py-3">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    <div className="flex-1">
                      <p className="text-sm text-orange-800 dark:text-orange-200">
                        <strong>Aviso:</strong> {holdingsError}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleRefresh}
                      disabled={isLoading}
                      className="text-orange-700 border-orange-300 hover:bg-orange-100 dark:text-orange-300 dark:border-orange-600 dark:hover:bg-orange-800"
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Tentar Novamente
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

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
                {isLoadingEssential || !hasData ? (
                  <StatsSkeleton />
                ) : (
                  <>
                    <div className="text-2xl font-bold text-foreground">
                      {formatBRL(fullData?.essential?.total_value || 0)}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {timelineLoading || !portfolioStats.performance_6m ? (
                        <StatusBadge variant="neutral" size="sm">
                          <Clock className="h-3 w-3 mr-1" />
                          Carregando...
                        </StatusBadge>
                      ) : portfolioStats.performance_6m.percentage !== 0 ? (
                        <StatusBadge variant={portfolioStats.performance_6m.is_positive ? "success" : "error"} size="sm">
                          {portfolioStats.performance_6m.is_positive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                          {portfolioStats.performance_6m.is_positive ? '+' : ''}{portfolioStats.performance_6m.percentage.toFixed(1)}%
                        </StatusBadge>
                      ) : (
                        <StatusBadge variant="neutral" size="sm">
                          Sem variação
                        </StatusBadge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {isLoadingDetailed || !holdingsData?.length ?
                          (fullData?.essential?.total_value > 0 ? 'Carregando posições...' : 'Sem dados')
                          : `${holdingsData.length} posições`}
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
                {isLoadingDetailed ? (
                  <StatsSkeleton />
                ) : !holdingsData?.length ? (
                  <div className="text-center py-4">
                    <div className="text-2xl font-bold text-muted-foreground">—</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {fullData?.essential?.total_value > 0 ? 'Sem posições' : 'Sem dados'}
                    </div>
                  </div>
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
                {isLoadingDetailed ? (
                  <StatsSkeleton />
                ) : !portfolioStats.largest_holding ? (
                  <div className="text-center py-4">
                    <div className="text-2xl font-bold text-muted-foreground">—</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {fullData?.essential?.total_value > 0 ? 'Sem posições' : 'Sem dados'}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {portfolioStats.largest_holding?.symbol || 'N/A'}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge variant="info" size="sm">
                        {portfolioStats.largest_holding?.percentage?.toFixed(1) || 0}%
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
                {isLoadingDetailed ? (
                  <StatsSkeleton />
                ) : !portfolioStats.diversification ? (
                  <div className="text-center py-4">
                    <div className="text-2xl font-bold text-muted-foreground">—</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {fullData?.essential?.total_value > 0 ? 'Sem posições' : 'Sem dados'}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {portfolioStats.diversification?.score?.toFixed(0) || 0}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge
                        variant={(portfolioStats.diversification?.score ?? 0) > 70 ? "success" : (portfolioStats.diversification?.score ?? 0) > 40 ? "warning" : "neutral"}
                        size="sm"
                      >
                        {portfolioStats.diversification?.label || 'N/A'}
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
                  Último mês •
                  Visualização {isPremium ? 'diária' : 'mensal'}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTimelineRefresh}
                  disabled={timelineLoading}
                  className={timelineLoading ? 'opacity-75' : ''}
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${timelineLoading ? 'animate-spin' : ''}`} />
                  {timelineLoading ? 'Atualizando...' : 'Atualizar'}
                </Button>
                <Link href="/dashboard/timeline">
                  <Button className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    Análise Detalhada
                  </Button>
                </Link>
              </div>
            </div>

            {/* Main Timeline Chart */}
            <Card className="card-hover animate-fade-in-up delay-300">
              <CardContent className="pt-6">
                {timelineLoading || !hasData ? (
                  <ChartSkeleton />
                ) : (isPremium ? dailyData : monthlyData).length > 0 ? (
                  <PortfolioChart
                    monthlyData={monthlyData}
                    dailyData={dailyData}
                    granularity={isPremium ? 'daily' : 'monthly'}
                    isLoading={timelineLoading}
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