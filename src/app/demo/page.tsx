"use client"

import Link from "next/link"
import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/ui/status-badge"
import { AssetBadge } from "@/components/ui/asset-badge"
import {
  BarChart3,
  Wallet,
  TrendingUp,
  LogOut,
  Plus,
  DollarSign,
  PieChart,
  Activity,
  ArrowUp,
  ArrowDown,
  RefreshCw
} from "lucide-react"
import PortfolioChart from "@/components/PortfolioChart"
import Image from "next/image"
import { toast } from "sonner"
import ThemeSwitch from "@/components/ThemeSwitch"

export default function DemoPage() {
  const [refreshing, setRefreshing] = useState(false)
  
  // Dados dummy que simulam o dashboard real
  const dummyUser = {
    email: "demo@afino.com.br"
  }
  
  
  // Dados dummy de portfolio stats
  const portfolioStats = {
    totalValue: 125750.50
  }
  
  // Dados dummy de timeline para gráfico (últimos 6 meses com variação realista)
  const generateDummyTimelineData = () => {
    const data = []
    const today = new Date()
    const sixMonthsAgo = new Date(today)
    sixMonthsAgo.setMonth(today.getMonth() - 6)
    
    let currentValue = 95000 // Valor inicial 6 meses atrás
    let currentDate = new Date(sixMonthsAgo)
    
    while (currentDate <= today) {
      // Simular variação realista (-3% a +5% por dia)
      const variation = (Math.random() - 0.4) * 0.08
      currentValue = Math.max(50000, currentValue * (1 + variation))
      
      data.push({
        date: currentDate.toISOString().split('T')[0]!,
        total_value: Math.round(currentValue * 100) / 100
      })
      
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    // Garantir que o último valor seja próximo ao portfolioStats.totalValue
    if (data.length > 0) {
      data[data.length - 1]!.total_value = portfolioStats.totalValue
    }
    
    return data
  }
  
  const timelineData = useMemo(() => generateDummyTimelineData(), [])
  
  // Holdings dummy
  const dummyHoldings = [
    { asset_id: 'ITUB4', value: 35250.50, symbol: 'ITUB4' },
    { asset_id: 'PETR4', value: 28400.00, symbol: 'PETR4' },
    { asset_id: 'VALE3', value: 22100.00, symbol: 'VALE3' },
    { asset_id: 'BBDC4', value: 18500.00, symbol: 'BBDC4' },
    { asset_id: 'WEGE3', value: 15200.00, symbol: 'WEGE3' },
    { asset_id: 'BTC', value: 6300.00, symbol: 'BTC' }
  ]
  
  const timelinePreviewData = {
    series: timelineData,
    holdings: dummyHoldings,
    performance: [
      { asset_symbol: 'ITUB4', totalReturnPercent: 15.3, volatility: 12.5 },
      { asset_symbol: 'WEGE3', totalReturnPercent: 22.1, volatility: 18.2 },
      { asset_symbol: 'PETR4', totalReturnPercent: 8.7, volatility: 25.3 },
      { asset_symbol: 'VALE3', totalReturnPercent: -2.1, volatility: 20.1 },
      { asset_symbol: 'BBDC4', totalReturnPercent: 12.4, volatility: 14.7 },
      { asset_symbol: 'BTC', totalReturnPercent: 45.2, volatility: 65.8 }
    ],
    assets: [],
    period: { from: '2023-07-01', to: '2024-01-15', label: '6 meses' },
    isPremium: true
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const calculate6MonthPerformance = () => {
    if (timelineData.length < 2) return { percentage: 0, isPositive: true }
    
    const firstValue = timelineData[0]?.total_value || 0
    const lastValue = timelineData[timelineData.length - 1]?.total_value || 0
    
    if (firstValue === 0) return { percentage: 0, isPositive: true }
    
    const percentage = ((lastValue - firstValue) / firstValue) * 100
    return { percentage, isPositive: percentage >= 0 }
  }

  const getLargestHolding = () => {
    if (!dummyHoldings.length) return { symbol: 'N/A', percentage: 0, loading: false }
    
    const totalValue = dummyHoldings.reduce((sum, h) => sum + h.value, 0)
    
    if (totalValue === 0) return { symbol: 'N/A', percentage: 0, loading: false }
    
    const largest = dummyHoldings.reduce((max, current) => 
      current.value > max.value ? current : max
    )
    
    const percentage = (largest.value / totalValue) * 100
    
    return { 
      symbol: largest.symbol, 
      percentage,
      loading: false
    }
  }

  const getDiversificationScore = () => {
    const holdings = dummyHoldings
    const totalValue = holdings.reduce((sum, h) => sum + h.value, 0)

    if (totalValue === 0 || holdings.length === 0) return { score: 0, label: 'Sem dados' }

    // Calculate Herfindahl-Hirschman Index (HHI) for diversification
    const hhi = holdings.reduce((sum, holding) => {
      const weight = holding.value / totalValue
      return sum + (weight * weight)
    }, 0)

    // Convert HHI to diversification score (0-100, higher = more diversified)
    const diversificationScore = Math.max(0, 100 - (hhi * 100))

    let label = 'Baixa'
    if (diversificationScore > 70) label = 'Alta'
    else if (diversificationScore > 40) label = 'Média'

    return { score: diversificationScore, label }
  }

  const getAssetClassDistribution = () => {
    const holdings = dummyHoldings
    const numAssets = holdings.length
    
    // Simple diversity calculation based on number of assets
    let diversityLabel = 'Concentrado'
    if (numAssets >= 5) diversityLabel = 'Diversificado'
    else if (numAssets >= 3) diversityLabel = 'Balanceado'
    
    return { diversityLabel }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    
    // Simular loading
    setTimeout(() => {
      setRefreshing(false)
      toast.success('Dados atualizados! (Demo)')
    }, 1500)
  }


  return (
    <div className="min-h-screen bg-background">
      {/* Barra de Demo no topo */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white text-center py-2 text-sm font-medium">
        🎯 Modo Demonstração - Explore a interface com dados simulados
      </div>
      
      {/* Enhanced Header - Igual ao dashboard */}
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
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Premium Demo
              </Badge>
              <Badge variant="secondary">
                {dummyUser.email}
              </Badge>
              <ThemeSwitch />
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={refreshing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Recarregar
              </Button>
              <Link href="/">
                <Button
                  variant="outline"
                  size="sm"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Estrutura idêntica ao dashboard */}
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
              <div className="text-2xl font-bold text-foreground">
                {formatCurrency(portfolioStats.totalValue)}
              </div>
              <div className="flex items-center gap-2 mt-1">
                <StatusBadge variant={calculate6MonthPerformance().isPositive ? "success" : "error"} size="sm">
                  {calculate6MonthPerformance().isPositive ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                  {calculate6MonthPerformance().isPositive ? '+' : ''}{calculate6MonthPerformance().percentage.toFixed(1)}%
                </StatusBadge>
                <span className="text-xs text-muted-foreground">
                  {dummyHoldings.length} posições
                </span>
              </div>
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
              <div className="text-2xl font-bold">
                {dummyHoldings.length}
              </div>
              <div className="flex items-center gap-1 mt-1 flex-wrap">
                <AssetBadge assetClass="stock" size="sm" showLabel={false} />
                <AssetBadge assetClass="crypto" size="sm" showLabel={false} />
                <AssetBadge assetClass="currency" size="sm" showLabel={false} />
                <span className="text-xs text-muted-foreground">
                  {getAssetClassDistribution().diversityLabel}
                </span>
              </div>
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
                {timelinePreviewData.period.label} • 
                Visualização {timelinePreviewData.isPremium ? 'diária' : 'mensal'}
              </p>
            </div>
            <Button className="flex items-center gap-2" onClick={() => toast.info('Funcionalidade disponível no app real!')}>
              <TrendingUp className="h-4 w-4" />
              Análise Detalhada
            </Button>
          </div>

          {/* Main Timeline Chart */}
          <Card className="card-hover animate-fade-in-up delay-300">
            <CardContent className="pt-6">
              <PortfolioChart
                monthlyData={[]}
                dailyData={timelineData}
                isLoading={false}
              />
            </CardContent>
          </Card>

          {/* Quick Analytics */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Melhor Ativo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <div className="text-lg font-bold text-green-600">
                    BTC
                  </div>
                  <StatusBadge variant="success" size="sm">
                    +45.2%
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
                  {dummyHoldings.length}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Volatilidade Média</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold">
                  {(timelinePreviewData.performance.reduce((sum, p) => sum + p.volatility, 0) / timelinePreviewData.performance.length).toFixed(1)}%
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* CTA Section para cadastro */}
        <div className="mb-8">
          <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
            <CardContent className="p-8 text-center">
              <h3 className="text-2xl font-bold mb-4">Pronto para gerenciar seu patrimônio de verdade?</h3>
              <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
                Esta é uma demonstração com dados simulados. Crie sua conta gratuita para 
                começar a acompanhar seus investimentos reais com a mesma interface.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link href="/signup">
                  <Button size="lg" className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Conta Grátis
                  </Button>
                </Link>
                <Link href="/pricing">
                  <Button variant="outline" size="lg" className="w-full sm:w-auto">
                    Ver Planos Premium
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

      </main>

      {/* Floating Action Button - funcional na demo */}
      <div className="fixed bottom-6 right-6 z-50">
        <Button 
          className="h-14 w-14 rounded-full shadow-lg hover:shadow-xl transition-shadow"
          onClick={() => toast.info('Cadastre-se para adicionar patrimônio real!')}
        >
          <Plus className="h-6 w-6" />
        </Button>
      </div>
    </div>
  )
}