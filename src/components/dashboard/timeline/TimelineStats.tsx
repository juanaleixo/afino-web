"use client"

import { useMemo } from "react"
import { formatCurrency, formatPercentage } from "@/lib/utils/formatters"
import { parseUTCDate } from "@/lib/utils/date-utils"
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  PieChart, 
  BarChart3,
  Target
} from "lucide-react"
import { StatsCard, StatsCardGrid, type StatsCardProps } from "@/components/ui/stats-card"

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
      parseUTCDate(a.date || a.month_eom).getTime() - parseUTCDate(b.date || b.month_eom).getTime()
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


  const statsCards: StatsCardProps[] = [
    {
      title: "Valor Total",
      value: formatCurrency(metrics.totalValue),
      description: "Patrimônio atual",
      icon: DollarSign,
      trend: 'neutral',
      premium: false
    },
    {
      title: "Retorno Total",
      value: `${metrics.totalReturn >= 0 ? '+' : ''}${formatCurrency(metrics.totalReturn)}`,
      description: `${formatPercentage(metrics.totalReturnPercent)} no período`,
      icon: metrics.totalReturn >= 0 ? TrendingUp : TrendingDown,
      trend: metrics.totalReturn >= 0 ? 'up' : 'down',
      premium: false
    },
    {
      title: "Última Variação",
      value: `${formatPercentage(metrics.periodReturn)}`,
      description: `Último ${granularity === 'daily' ? 'dia' : 'mês'}`,
      icon: metrics.periodReturn >= 0 ? TrendingUp : TrendingDown,
      trend: metrics.periodReturn >= 0 ? 'up' : 'down',
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
  const premiumCards: StatsCardProps[] = []
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
    <StatsCardGrid
      cards={allCards}
      loading={loading}
      columns={{
        default: 1,
        md: 2,
        lg: 4
      }}
    />
  )
}