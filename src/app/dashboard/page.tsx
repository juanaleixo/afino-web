"use client"

import { useState, useEffect } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { useAuth } from "@/lib/auth"
import { useUserPlan } from "@/contexts/UserPlanContext"
import { getPortfolioService } from "@/lib/portfolio"
import { supabase } from "@/lib/supabase"
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
  Edit3
} from "lucide-react"
import MiniChart from "@/components/ui/mini-chart"
import PortfolioChart from "@/components/PortfolioChart"
import Link from "next/link"
import Image from "next/image"
import { toast } from "sonner"
import PlanStatus from "@/components/PlanStatus"
import ThemeSwitch from "@/components/ThemeSwitch"
import { getAssetDisplayLabel } from "@/lib/utils/assets"
import { PatrimonyFAB } from "@/components/ui/patrimony-fab"

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const { isPremium } = useUserPlan()
  const [isLoading, setIsLoading] = useState(false)
  const [portfolioStats, setPortfolioStats] = useState<any>(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [miniTimelineData, setMiniTimelineData] = useState<any[]>([])
  const [loadingMiniTimeline, setLoadingMiniTimeline] = useState(true)
  const [timelinePreviewData, setTimelinePreviewData] = useState<any>(null)
  const [loadingTimelinePreview, setLoadingTimelinePreview] = useState(true)
  const [assetSymbols, setAssetSymbols] = useState<Map<string, string>>(new Map())
  const [loadingSymbols, setLoadingSymbols] = useState(false)

  // Cached version of last event timestamp (for cache invalidation)
  const getLastEventTimestamp = async (userId: string): Promise<string> => {
    const cacheKey = `last_event:${userId}`
    
    // Check cache first
    let cached = null
    try {
      cached = window.sessionStorage?.getItem(cacheKey)
    } catch {}
    
    if (cached) {
      const { timestamp, expires } = JSON.parse(cached)
      if (Date.now() < expires) {
        return timestamp
      }
    }

    try {
      const { data, error } = await supabase
        .from('events')
        .select('created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
      
      let timestamp = Date.now().toString()
      if (!error && data?.length) {
        const lastModified = new Date(data[0]!.created_at).getTime()
        timestamp = Math.floor(lastModified / (5 * 60 * 1000)).toString()
      }
      
      // Cache for 1 minute
      try {
        window.sessionStorage?.setItem(cacheKey, JSON.stringify({
          timestamp,
          expires: Date.now() + 60 * 1000
        }))
      } catch {}
      
      return timestamp
    } catch (error) {
      console.error('Error getting last event timestamp:', error)
      return Date.now().toString()
    }
  }

  // Load asset symbols asynchronously 
  const loadAssetSymbols = async (assetIds: string[]) => {
    try {
      setLoadingSymbols(true)
      const { data, error } = await supabase
        .from('global_assets')
        .select('id, symbol')
        .in('id', assetIds)
      
      if (error) throw error
      
      const symbolMap = new Map<string, string>()
      data?.forEach(asset => {
        symbolMap.set(asset.id, asset.symbol || asset.id)
      })
      
      setAssetSymbols(symbolMap)
    } catch (error) {
      console.error('Error loading asset symbols:', error)
    } finally {
      setLoadingSymbols(false)
    }
  }

  // Load symbols when timeline data is available but symbols are not loaded
  useEffect(() => {
    if (timelinePreviewData?.holdings?.length > 0 && assetSymbols.size === 0) {
      loadAssetSymbols(timelinePreviewData.holdings.map((h: any) => h.asset_id))
    }
  }, [timelinePreviewData, assetSymbols.size])

  useEffect(() => {
    if (!user?.id) return

    const loadDashboardStats = async (userId: string) => {
      try {
        setLoadingStats(true)
        const portfolioService = getPortfolioService(userId)
        const today = new Date().toISOString().split('T')[0]!
        const stats = await portfolioService.getPortfolioStats(today)
        setPortfolioStats(stats)
      } catch (error) {
        console.error('Erro ao carregar estatísticas:', error)
        toast.error('Erro ao carregar dados do dashboard')
      } finally {
        setLoadingStats(false)
      }
    }

    const loadMiniTimeline = async (userId: string) => {
      try {
        setLoadingMiniTimeline(true)
        const portfolioService = getPortfolioService(userId)
        
        // Initialize service to ensure premium status is loaded
        await portfolioService.initialize()
        
        // Cache key for 15 minutes
        const cacheKey = `mini-timeline-${userId}-${Math.floor(Date.now() / (15 * 60 * 1000))}`
        const cached = sessionStorage.getItem(cacheKey)
        
        if (cached) {
          setMiniTimelineData(JSON.parse(cached))
          setLoadingMiniTimeline(false)
          return
        }

        // Get data based on plan type
        const today = new Date()
        let chartData: any[] = []
        
        if (isPremium) {
          // Premium: last 30 days daily data
          const thirtyDaysAgo = new Date(today)
          thirtyDaysAgo.setDate(today.getDate() - 30)
          
          const from = thirtyDaysAgo.toISOString().split('T')[0]!
          const to = today.toISOString().split('T')[0]!
          
          const dailyData = await portfolioService.getDailySeries(from, to)
          chartData = dailyData.map(item => ({
            date: item.date,
            value: item.total_value
          }))
        } else {
          // Free: last 12 months monthly data
          const twelveMonthsAgo = new Date(today)
          twelveMonthsAgo.setMonth(today.getMonth() - 12)
          
          const from = twelveMonthsAgo.toISOString().split('T')[0]!
          const to = today.toISOString().split('T')[0]!
          
          const monthlyData = await portfolioService.getMonthlySeries(from, to)
          chartData = monthlyData.map(item => ({
            date: item.month_eom,
            value: item.total_value
          }))
        }
        
        // Cache for 15 minutes
        sessionStorage.setItem(cacheKey, JSON.stringify(chartData))
        setMiniTimelineData(chartData)
      } catch (error) {
        console.error('Erro ao carregar mini timeline:', error)
        // Silent fail - mini timeline is not critical
      } finally {
        setLoadingMiniTimeline(false)
      }
    }

    loadDashboardStats(user.id as string)
    
    // Only load timeline data after premium status is determined
    if (isPremium !== undefined) {
      loadMiniTimeline(user.id as string)
      loadTimelinePreview(user.id as string)
    }
  }, [user?.id, isPremium])

  const loadTimelinePreview = async (userId: string) => {
    try {
      setLoadingTimelinePreview(true)
      const portfolioService = getPortfolioService(userId)
      await portfolioService.initialize()
      
      // Smart cache with data versioning - checks for updates
      const dataVersion = await getLastEventTimestamp(userId)
      const cacheKey = `timeline-preview-${userId}-v${dataVersion}`
      const cached = sessionStorage.getItem(cacheKey)
      
      if (cached) {
        setTimelinePreviewData(JSON.parse(cached))
        setLoadingTimelinePreview(false)
        return
      }

      const today = new Date()
      let timelineData: any = {}
      
      if (isPremium) {
        // Premium: Rich data with performance analysis
        const sixMonthsAgo = new Date(today)
        sixMonthsAgo.setMonth(today.getMonth() - 6)
        const from = sixMonthsAgo.toISOString().split('T')[0]!
        const to = today.toISOString().split('T')[0]!
        
        // Simplified data loading - just the essentials for preview
        const [dailyData, holdingsData] = await Promise.all([
          portfolioService.getDailySeries(from, to),
          portfolioService.getHoldingsAt(to)
        ])
        
        timelineData = {
          series: dailyData,
          holdings: holdingsData,
          performance: [],
          assets: [],
          period: { from, to, label: '6 meses' },
          isPremium: true
        }
      } else {
        // Free: Monthly data with basic stats
        const twelveMonthsAgo = new Date(today)
        twelveMonthsAgo.setMonth(today.getMonth() - 12)
        const from = twelveMonthsAgo.toISOString().split('T')[0]!
        const to = today.toISOString().split('T')[0]!
        
        const [monthlyData, holdingsData] = await Promise.all([
          portfolioService.getMonthlySeries(from, to),
          portfolioService.getHoldingsAt(to)
        ])
        
        timelineData = {
          series: monthlyData,
          holdings: holdingsData,
          performance: [],
          assets: [],
          period: { from, to, label: '12 meses' },
          isPremium: false
        }
      }
      
      // Cache for 60 minutes
      sessionStorage.setItem(cacheKey, JSON.stringify(timelineData))
      setTimelinePreviewData(timelineData)
      
      // Load asset symbols asynchronously for better UX
      if (timelineData.holdings?.length > 0) {
        loadAssetSymbols(timelineData.holdings.map((h: any) => h.asset_id))
      }
    } catch (error) {
      console.error('Erro ao carregar preview da timeline:', error)
      // Set empty data to avoid loading state forever
      setTimelinePreviewData({ series: [], holdings: [], performance: [] })
    } finally {
      setLoadingTimelinePreview(false)
    }
  }

  const handleSignOut = async () => {
    setIsLoading(true)
    await signOut()
    setIsLoading(false)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const calculate30DayPerformance = () => {
    if (miniTimelineData.length < 2) return { percentage: 0, isPositive: true }
    
    const firstValue = miniTimelineData[0]?.value || 0
    const lastValue = miniTimelineData[miniTimelineData.length - 1]?.value || 0
    
    if (firstValue === 0) return { percentage: 0, isPositive: true }
    
    const percentage = ((lastValue - firstValue) / firstValue) * 100
    return { percentage, isPositive: percentage >= 0 }
  }

  const getLargestHolding = () => {
    if (!timelinePreviewData?.holdings?.length) return { symbol: 'N/A', percentage: 0, loading: false }
    
    const holdings = timelinePreviewData.holdings
    const totalValue = holdings.reduce((sum: number, h: any) => sum + (h.value || 0), 0)
    
    if (totalValue === 0) return { symbol: 'N/A', percentage: 0, loading: false }
    
    const largest = holdings.reduce((max: any, current: any) => 
      (current.value || 0) > (max.value || 0) ? current : max
    )
    
    const percentage = ((largest.value || 0) / totalValue) * 100
    const assetId = largest.asset_id || 'N/A'
    
    // If symbols are loading, show loading state
    if (loadingSymbols) {
      return { symbol: '...', percentage: isNaN(percentage) ? 0 : percentage, loading: true }
    }
    
    // Try to get symbol from loaded symbols, fallback to abbreviated ID
    const symbol = assetSymbols.get(assetId) || 
                  (assetId.length > 8 ? assetId.substring(0, 8).toUpperCase() : assetId)
    
    return { 
      symbol, 
      percentage: isNaN(percentage) ? 0 : percentage,
      loading: false
    }
  }

  const getDiversificationScore = () => {
    if (!timelinePreviewData?.holdings?.length) return { score: 0, label: 'Sem dados' }
    
    const holdings = timelinePreviewData.holdings
    const totalValue = holdings.reduce((sum: number, h: any) => sum + (h.value || 0), 0)

    if (totalValue === 0 || holdings.length === 0) return { score: 0, label: 'Sem dados' }

    // Calculate Herfindahl-Hirschman Index (HHI) for diversification
    const hhi = holdings.reduce((sum: number, holding: any) => {
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
    if (!timelinePreviewData?.holdings?.length) {
      return { diversityLabel: 'Sem dados' }
    }
    
    const holdings = timelinePreviewData.holdings
    const numAssets = holdings.length
    
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
      href: "/dashboard/events",
      badge: "info",
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
                <div className="relative p-2 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 shadow-md">
                  <Image
                    src="/icon.svg"
                    alt="Afino Finance"
                    width={32}
                    height={32}
                    className="h-8 w-8 drop-shadow-sm"
                  />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text text-transparent">Afino</h1>
                  <p className="text-sm text-muted-foreground font-medium">Visualização de Ativos</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <PlanStatus showUpgradeButton={false} />
                <Badge variant="secondary">
                  {user?.email}
                </Badge>
                <ThemeSwitch />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  disabled={isLoading}
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
                {loadingStats ? (
                  <LoadingState variant="inline" size="sm" message="Carregando..." />
                ) : (
                  <>
                    <div className="text-2xl font-bold text-foreground">
                      {portfolioStats ? formatCurrency(portfolioStats.totalValue) : 'R$ 0,00'}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {timelinePreviewData?.series && calculate30DayPerformance().percentage !== 0 ? (
                        <StatusBadge variant={calculate30DayPerformance().isPositive ? "success" : "error"} size="sm">
                          {calculate30DayPerformance().isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                          {calculate30DayPerformance().isPositive ? '+' : ''}{calculate30DayPerformance().percentage.toFixed(1)}%
                        </StatusBadge>
                      ) : (
                        <StatusBadge variant="neutral" size="sm">
                          Sem variação
                        </StatusBadge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {timelinePreviewData?.holdings?.length ? `${timelinePreviewData.holdings.length} posições` : 'Sem dados'}
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
                {loadingStats ? (
                  <LoadingState variant="inline" size="sm" message="Carregando..." />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {timelinePreviewData?.holdings?.length || 0}
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
                {loadingTimelinePreview ? (
                  <LoadingState variant="inline" size="sm" message="Carregando..." />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {getLargestHolding().loading ? (
                        <span className="animate-pulse text-muted-foreground">...</span>
                      ) : (
                        getLargestHolding().symbol
                      )}
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
                {loadingTimelinePreview ? (
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
                  {timelinePreviewData?.period?.label || (isPremium ? 'Últimos 6 meses' : 'Últimos 12 meses')} • 
                  Visualização {timelinePreviewData?.isPremium ? 'diária' : 'mensal'}
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
                {loadingTimelinePreview ? (
                  <div className="h-64 flex items-center justify-center">
                    <LoadingState message="Carregando timeline..." />
                  </div>
                ) : timelinePreviewData?.series?.length > 0 ? (
                  <PortfolioChart
                    monthlyData={timelinePreviewData.isPremium ? [] : timelinePreviewData.series}
                    dailyData={timelinePreviewData.isPremium ? timelinePreviewData.series : []}
                    isLoading={false}
                  />
                ) : (
                  <div className="h-64 flex items-center justify-center">
                    <div className="text-center">
                      <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Nenhum dado disponível</p>
                      <Link href="/dashboard/events/new">
                        <Button variant="outline" className="mt-2">
                          Adicionar Primeiro Evento
                        </Button>
                      </Link>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Quick Analytics */}
            {timelinePreviewData?.performance?.length > 0 && (
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Melhor Ativo</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <div className="text-lg font-bold text-green-600">
                        {timelinePreviewData.performance
                          .sort((a: any, b: any) => b.totalReturnPercent - a.totalReturnPercent)[0]
                          ?.asset_symbol || 'N/A'}
                      </div>
                      <StatusBadge variant="success" size="sm">
                        +{timelinePreviewData.performance
                          .sort((a: any, b: any) => b.totalReturnPercent - a.totalReturnPercent)[0]
                          ?.totalReturnPercent?.toFixed(1) || '0'}%
                      </StatusBadge>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total de Ativos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold">
                      {timelinePreviewData.performance?.length || timelinePreviewData.holdings?.length || 0}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Volatilidade Média</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-bold">
                      {timelinePreviewData.performance?.length > 0
                        ? (timelinePreviewData.performance.reduce((sum: number, p: any) => sum + p.volatility, 0) / timelinePreviewData.performance.length).toFixed(1)
                        : '0.0'}%
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Ações Rápidas */}
            <div className="animate-fade-in-up delay-450">
              <h3 className="text-lg font-semibold mb-4">Ações Rápidas</h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Link href="/dashboard/patrimony/new?operation=add_existing">
                  <Button variant="outline" className="w-full h-auto p-4 flex-col gap-3 border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-colors duration-200 group">
                    <Plus className="h-6 w-6" />
                    <span className="font-medium text-center leading-tight">Adicionar Patrimônio Existente</span>
                  </Button>
                </Link>
                <Link href="/dashboard/patrimony/new?operation=money_in">
                  <Button variant="outline" className="w-full h-auto p-4 flex-col gap-3 border-green-600 text-green-600 hover:bg-green-600 hover:text-white transition-colors duration-200 group">
                    <ArrowDown className="h-6 w-6" />
                    <span className="font-medium text-center leading-tight">Registrar Entrada</span>
                  </Button>
                </Link>
                <Link href="/dashboard/patrimony/new?operation=update_value">
                  <Button variant="outline" className="w-full h-auto p-4 flex-col gap-3 border-blue-600 text-blue-600 hover:bg-blue-600 hover:text-white transition-colors duration-200 group">
                    <Edit3 className="h-6 w-6" />
                    <span className="font-medium text-center leading-tight">Atualizar Valores</span>
                  </Button>
                </Link>
              </div>
            </div>
          </div>

        </main>

        {/* Floating Action Button */}
        <PatrimonyFAB />
      </div>
    </ProtectedRoute>
  )
} 
