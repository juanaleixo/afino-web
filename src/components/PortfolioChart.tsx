"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp } from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts'
import { useMemo } from 'react'
import { FadeIn } from '@/components/ui/fade-in'
import { ChartSkeleton } from "@/components/ui/skeleton-loader"
import { useTheme } from "@/hooks/use-theme"

interface PortfolioChartProps {
  monthlyData: Array<{ month_eom: string; total_value: number }>
  dailyData?: Array<{ date: string; total_value: number }> | null
  isLoading?: boolean
}

interface ChartDatum {
  date: string
  value: number
}

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

export default function PortfolioChart({ monthlyData, dailyData, isLoading = false }: PortfolioChartProps) {
  // Normalizar dados para o gráfico
  const chartData: ChartDatum[] = useMemo(() => {
    const base = dailyData && dailyData.length > 0 ? dailyData : monthlyData
    if (!base || base.length === 0) return []
    
    return base.map((d) => ({
      date: 'date' in d ? d.date : d.month_eom,
      value: d.total_value,
    }))
  }, [monthlyData, dailyData])

  const latestValue = chartData.at(-1)?.value ?? 0

  // Se não há dados, mostrar mensagem
  if (chartData.length === 0 && !isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Evolução do Patrimônio</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Nenhum dado disponível para exibir</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <FadeIn>
      <Card className="card-hover">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Evolução do Patrimônio</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <ChartSkeleton />
          ) : (
            <FadeIn delay={200} className="space-y-4">
              <div className="text-sm text-muted-foreground value-change">Valor atual: {currencyFormatter.format(latestValue)}</div>
              {/* Linha do tempo */}
              <div className="w-full h-72 chart-container chart-entering">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => new Date(v).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })}
                      className="fill-muted-foreground text-xs"
                    />
                    <YAxis
                      tickFormatter={(v) => currencyFormatter.format(v)}
                      width={80}
                      className="fill-muted-foreground text-xs"
                    />
                    <Tooltip
                      formatter={(value: number) => currencyFormatter.format(value)}
                      labelFormatter={(label: string) => new Date(label).toLocaleDateString('pt-BR')}
                      contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '0.5rem', color: 'white' }}
                      wrapperStyle={{ outline: 'none' }}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                      activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                      strokeDasharray="5 5"
                      strokeDashoffset="0"
                      style={{
                        animation: 'draw-line 1.5s ease-out forwards'
                      }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </FadeIn>
          )}
        </CardContent>
      </Card>
    </FadeIn>
  )
}
