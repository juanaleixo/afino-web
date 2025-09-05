"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Crown, BarChart3, TrendingUp } from 'lucide-react'
import PortfolioChart from '@/components/PortfolioChart'

interface TradingViewChartProps {
  portfolioData: {
    monthlySeries?: Array<{ month_eom: string; total_value: number }>
    dailySeries?: Array<{ date: string; total_value: number }>
  }
  symbol?: string
  theme: 'light' | 'dark'
  height: number
  isPremium: boolean
}

export default function TradingViewChart({
  portfolioData,
  symbol = 'PORTFOLIO',
  theme = 'dark',
  height = 500,
  isPremium
}: TradingViewChartProps) {

  if (!isPremium) {
    return (
      <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Crown className="h-5 w-5 text-yellow-600" />
              <div>
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                  Gráfico Profissional
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Análise técnica avançada com gráfico interativo profissional
                </p>
              </div>
            </div>
            <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white transition-colors">
              <Crown className="h-4 w-4 mr-2" />
              Fazer Upgrade
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <CardTitle>Gráfico Profissional</CardTitle>
            <Badge variant="outline" className="flex items-center space-x-1">
              <Crown className="h-3 w-3" />
              <span>Premium</span>
            </Badge>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div style={{ height: `${height}px` }}>
          <PortfolioChart
            monthlyData={portfolioData.monthlySeries || []}
            dailyData={portfolioData.dailySeries || null}
            isLoading={false}
          />
        </div>
      </CardContent>
    </Card>
  )
}