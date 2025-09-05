"use client"

import { useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCurrency, formatPercentage } from "@/lib/utils/formatters"
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  PieChart, 
  BarChart3,
  Target,
  Zap
} from "lucide-react"
import { Stagger } from "@/components/ui/fade-in"

interface TimelineStatsProps {
  portfolioData: any
  loading: boolean
  period: string
  granularity: 'daily' | 'monthly'
  isPremium: boolean
}

interface PortfolioMetrics {
  totalValue: number
  totalReturn: number
  totalReturnPercent: number
  periodReturn: number
  totalAssets: number
  volatility?: number | undefined
  sharpeRatio?: number | undefined
}

export function TimelineStats({ 
  portfolioData, 
  loading, 
  period,
  granularity,
  isPremium 
}: TimelineStatsProps) {
  
  const metrics = useMemo((): PortfolioMetrics => {
    if (!portfolioData) {
      return {
        totalValue: 0,
        totalReturn: 0,
        totalReturnPercent: 0,
        periodReturn: 0,
        totalAssets: 0
      }
    }

    // Calcular valor total dos holdings
    const holdings = portfolioData.holdingsAt || portfolioData.holdings || []
    const totalValue = holdings.reduce(
      (total: number, holding: any) => total + Number(holding.value || 0), 
      0
    ) || 0

    // Determinar série ativa (diária ou mensal)
    const activeSeries = (isPremium && granularity === 'daily' && portfolioData.dailySeries)
      ? portfolioData.dailySeries 
      : portfolioData.monthlySeries

    if (!activeSeries || activeSeries.length < 2) {
      return {
        totalValue,
        totalReturn: 0,
        totalReturnPercent: 0,
        periodReturn: 0,
        totalAssets: holdings.length || 0
      }
    }

    // Calcular retornos
    const sortedSeries = activeSeries.sort((a: any, b: any) => 
      new Date(a.date || a.month_eom).getTime() - new Date(b.date || b.month_eom).getTime()
    )

    const initial = sortedSeries[0]?.total_value || 0
    const final = sortedSeries[sortedSeries.length - 1]?.total_value || 0
    const totalReturn = final - initial
    const totalReturnPercent = initial > 0 ? (totalReturn / initial) * 100 : 0

    // Retorno do último período
    const prev = sortedSeries[sortedSeries.length - 2]?.total_value || 0
    const current = sortedSeries[sortedSeries.length - 1]?.total_value || 0
    const periodReturn = prev > 0 ? ((current - prev) / prev) * 100 : 0

    // Calcular volatilidade se houver dados suficientes (Premium)
    let volatility: number | undefined
    let sharpeRatio: number | undefined

    if (isPremium && sortedSeries.length > 10) {
      const dailyReturns: number[] = []
      for (let i = 1; i < sortedSeries.length; i++) {
        const prevVal = sortedSeries[i - 1]?.total_value || 0
        const currVal = sortedSeries[i]?.total_value || 0
        if (prevVal > 0) {
          dailyReturns.push((currVal - prevVal) / prevVal)
        }
      }

      if (dailyReturns.length > 0) {
        const avgReturn = dailyReturns.reduce((sum, ret) => sum + ret, 0) / dailyReturns.length
        const variance = dailyReturns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / dailyReturns.length
        volatility = Math.sqrt(variance) * Math.sqrt(252) * 100 // Anualizada
        sharpeRatio = volatility > 0 ? (totalReturnPercent / volatility) : 0
      }
    }

    return {
      totalValue,
      totalReturn,
      totalReturnPercent,
      periodReturn,
      totalAssets: portfolioData.holdingsAt?.length || 0,
      volatility,
      sharpeRatio
    }
  }, [portfolioData, isPremium, granularity])

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="card-hover">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
              <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
            </CardHeader>
            <CardContent>
              <div className="h-8 w-32 bg-gray-200 rounded animate-pulse mb-1" />
              <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const statsCards = [
    {
      title: "Valor Total",
      value: formatCurrency(metrics.totalValue),
      description: "Patrimônio atual",
      icon: DollarSign,
      color: "text-blue-600",
      premium: false
    },
    {
      title: "Retorno Total",
      value: `${metrics.totalReturn >= 0 ? '+' : ''}${formatCurrency(metrics.totalReturn)}`,
      description: `${formatPercentage(metrics.totalReturnPercent)} no período`,
      icon: metrics.totalReturn >= 0 ? TrendingUp : TrendingDown,
      color: metrics.totalReturn >= 0 ? "text-green-600" : "text-red-600",
      premium: false
    },
    {
      title: "Última Variação",
      value: `${formatPercentage(metrics.periodReturn)}`,
      description: `Último ${granularity === 'daily' ? 'dia' : 'mês'}`,
      icon: metrics.periodReturn >= 0 ? TrendingUp : TrendingDown,
      color: metrics.periodReturn >= 0 ? "text-green-600" : "text-red-600",
      premium: false
    },
    {
      title: "Total de Ativos",
      value: metrics.totalAssets.toString(),
      description: "Diferentes ativos",
      icon: PieChart,
      color: "text-purple-600",
      premium: false
    }
  ]

  // Cards premium adicionais
  const premiumCards = []
  if (isPremium && metrics.volatility !== undefined) {
    premiumCards.push({
      title: "Volatilidade",
      value: `${metrics.volatility.toFixed(2)}%`,
      description: "Anualizada",
      icon: Activity,
      color: "text-orange-600",
      premium: true
    })
  }

  if (isPremium && metrics.sharpeRatio !== undefined) {
    premiumCards.push({
      title: "Sharpe Ratio",
      value: metrics.sharpeRatio.toFixed(2),
      description: "Risco vs Retorno",
      icon: Target,
      color: "text-indigo-600",
      premium: true
    })
  }

  const allCards = [...statsCards, ...premiumCards]

  return (
    <Stagger staggerDelay={0.1} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {allCards.map((card, index) => {
        const IconComponent = card.icon
        
        return (
          <Card key={index} className="card-hover">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center space-x-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                {card.premium && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                    <Zap className="h-2 w-2 mr-1" />
                    Premium
                  </Badge>
                )}
              </div>
              <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
                <IconComponent className={`h-4 w-4 ${card.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${card.color}`}>
                {card.value}
              </div>
              <p className={`text-xs ${card.color.includes('green') || card.color.includes('red') 
                ? card.color 
                : 'text-muted-foreground'
              }`}>
                {card.description}
              </p>
            </CardContent>
          </Card>
        )
      })}
    </Stagger>
  )
}