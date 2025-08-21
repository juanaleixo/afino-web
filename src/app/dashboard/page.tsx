"use client"

import { useState, useEffect } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { useAuth } from "@/lib/auth"
import { useUserPlan } from "@/hooks/use-user-plan"
import { PortfolioService } from "@/lib/portfolio"
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
  Users
} from "lucide-react"
import MiniChart from "@/components/ui/mini-chart"
import PortfolioChart from "@/components/PortfolioChart"
import Link from "next/link"
import Image from "next/image"
import { toast } from "sonner"
import PlanStatus from "@/components/PlanStatus"
import ThemeSwitch from "@/components/ThemeSwitch"

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

  useEffect(() => {
    if (!user?.id) return

    const loadDashboardStats = async (userId: string) => {
      try {
        setLoadingStats(true)
        const portfolioService = new PortfolioService(userId)
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
        const portfolioService = new PortfolioService(userId)
        
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
      const portfolioService = new PortfolioService(userId)
      await portfolioService.initialize()
      
      // Aggressive cache for 30 minutes
      const cacheKey = `timeline-preview-${userId}-${Math.floor(Date.now() / (30 * 60 * 1000))}`
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
        
        const [dailyData, holdingsData, performanceData] = await Promise.all([
          portfolioService.getDailySeries(from, to),
          portfolioService.getHoldingsAt(to),
          portfolioService.getAssetPerformanceAnalysis(from, to).catch(() => [])
        ])
        
        timelineData = {
          series: dailyData,
          holdings: holdingsData,
          performance: performanceData,
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
          period: { from, to, label: '12 meses' },
          isPremium: false
        }
      }
      
      // Cache for 30 minutes
      sessionStorage.setItem(cacheKey, JSON.stringify(timelineData))
      setTimelinePreviewData(timelineData)
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

  const menuItems = [
    {
      title: "Timeline",
      description: "Análise completa do seu patrimônio ao longo do tempo",
      icon: BarChart3,
      href: "/dashboard/timeline",
      badge: "success",
      isPrimary: true,
    },
    {
      title: "Contas",
      description: "Gerencie suas contas bancárias",
      icon: Wallet,
      href: "/dashboard/accounts",
      badge: "primary",
    },
    {
      title: "Ativos",
      description: "Cadastro de ações, cripto e outros",
      icon: TrendingUp,
      href: "/dashboard/assets",
      badge: "secondary",
    },
    {
      title: "Eventos",
      description: "Transações e movimentações",
      icon: Activity,
      href: "/dashboard/events",
      badge: "info",
    },
  ]

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card">
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
                  <h1 className="text-2xl font-bold">Afino</h1>
                  <p className="text-sm text-muted-foreground">Hub Financeiro Inteligente</p>
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
          {/* Welcome Section */}
          <div className="page-header">
            <h2 className="page-title">Timeline do Seu Patrimônio</h2>
            <p className="page-description">
              Acompanhe a evolução completa dos seus investimentos e tome decisões baseadas em dados reais.
            </p>
          </div>

          {/* Quick Stats */}
          <div className="stats-grid">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Patrimônio Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
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
                      <StatusBadge variant="success" size="sm">
                        <ArrowUp className="h-3 w-3" />
                        +0,0%
                      </StatusBadge>
                      <span className="text-xs text-muted-foreground">
                        {portfolioStats ? `${portfolioStats.totalAssets} posições` : 'Sem dados'}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tipos de Ativo</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loadingStats ? (
                  <LoadingState variant="inline" size="sm" message="Carregando..." />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {portfolioStats?.totalAssets || 0}
                    </div>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <AssetBadge assetClass="stock" size="sm" showLabel={false} />
                      <AssetBadge assetClass="crypto" size="sm" showLabel={false} />
                      <AssetBadge assetClass="currency" size="sm" showLabel={false} />
                      <span className="text-xs text-muted-foreground">
                        {portfolioStats?.totalAssets > 0 ? 'Diversificado' : 'Sem ativos'}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Últimas Atividades</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3</div>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge variant="info" size="sm">
                    Hoje
                  </StatusBadge>
                  <span className="text-xs text-muted-foreground">
                    transações
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Performance {isPremium ? '30 dias' : 'Últimos meses'}
                </CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loadingMiniTimeline ? (
                  <LoadingState variant="inline" size="sm" message="Carregando..." />
                ) : (
                  <>
                    <div className={`text-2xl font-bold ${calculate30DayPerformance().isPositive ? 'text-green-600' : 'text-red-600'}`}>
                      {calculate30DayPerformance().isPositive ? '+' : ''}{calculate30DayPerformance().percentage.toFixed(1)}%
                    </div>
                    <div className="flex items-center gap-2 mt-1 mb-3">
                      <StatusBadge variant={calculate30DayPerformance().isPositive ? "success" : "error"} size="sm">
                        {calculate30DayPerformance().isPositive ? 
                          <ArrowUp className="h-3 w-3" /> : 
                          <ArrowDown className="h-3 w-3" />
                        }
                        {isPremium ? '30 dias' : 'período'}
                      </StatusBadge>
                      <span className="text-xs text-muted-foreground">
                        evolução
                      </span>
                    </div>
                    <MiniChart 
                      data={miniTimelineData} 
                      color={calculate30DayPerformance().isPositive ? '#16a34a' : '#dc2626'}
                      height={50}
                    />
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
                <h2 className="text-2xl font-bold">Timeline do Patrimônio</h2>
                <p className="text-muted-foreground">
                  {timelinePreviewData?.period?.label || (isPremium ? 'Últimos 6 meses' : 'Últimos 12 meses')} • 
                  {timelinePreviewData?.isPremium ? ' Dados diários' : ' Dados mensais'}
                </p>
              </div>
              <Link href="/dashboard/timeline">
                <Button className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Ver Análise Completa
                </Button>
              </Link>
            </div>

            {/* Main Timeline Chart */}
            <Card>
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

            {/* Quick Menu */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ações Rápidas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                  {menuItems.slice(1).map((item) => (
                    <Link key={item.href} href={item.href}>
                      <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                        <item.icon className="h-5 w-5 text-primary" />
                        <div>
                          <div className="font-medium text-sm">{item.title}</div>
                          <div className="text-xs text-muted-foreground">{item.description}</div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

        </main>
      </div>
    </ProtectedRoute>
  )
} 
