"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, Calendar, Crown } from 'lucide-react'
import Link from 'next/link'
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

interface PortfolioChartProps {
  monthlyData: Array<{ month_eom: string; total_value: number }>
  dailyData?: Array<{ date: string; total_value: number }> | null
  isLoading?: boolean
  isPremium?: boolean
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

export default function PortfolioChart({
  monthlyData,
  dailyData,
  isLoading = false,
  isPremium = false,
}: PortfolioChartProps) {
  // Normalizar dados para o gráfico
  const chartData: ChartDatum[] = useMemo(() => {
    const base = isPremium && dailyData ? dailyData : monthlyData
    if (!base || base.length === 0) return []
    
    return base.map((d) => ({
      date: 'date' in d ? d.date : d.month_eom,
      value: d.total_value,
    }))
  }, [monthlyData, dailyData, isPremium])

  const latestValue = chartData.at(-1)?.value ?? 0
  const changePct = chartData.length > 1 && chartData.at(-1) && chartData.at(-2)
    ? ((chartData.at(-1)!.value - chartData.at(-2)!.value) / chartData.at(-2)!.value) * 100
    : null

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
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5" />
              <span>Evolução do Patrimônio</span>
            </CardTitle>
            <CardDescription>
              {isPremium && dailyData ? 'Dados diários' : 'Dados mensais'}
            </CardDescription>
          </div>
          <div className="flex items-center space-x-2">
            {!isPremium && (
              <Badge variant="outline" className="text-xs">
                <Crown className="h-3 w-3 mr-1" /> Premium
              </Badge>
            )}
            <Badge variant="secondary" className="text-xs">
              <Calendar className="h-3 w-3 mr-1" /> {chartData.length} períodos
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <span className="ml-2">Carregando gráfico...</span>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Estatísticas */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Valor Atual</p>
                <p className="text-2xl font-bold">{currencyFormatter.format(latestValue)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Variação</p>
                {changePct !== null ? (
                  <p
                    className={`text-lg font-semibold ${changePct >= 0 ? 'text-green-600' : 'text-red-600'}`}
                  >
                    {changePct >= 0 ? '+' : ''}
                    {changePct.toFixed(2)}%
                  </p>
                ) : (
                  <p className="text-lg font-semibold text-muted-foreground">--</p>
                )}
              </div>
            </div>
            
            {/* Gráfico */}
            <div className="w-full h-72">
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
                    contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '0.5rem', color: 'white' }}
                    wrapperStyle={{ outline: 'none' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="value"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Aviso para usuários free */}
            {!isPremium && (
              <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Crown className="h-4 w-4 text-orange-600" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-orange-800">Atualize para Premium</p>
                    <p className="text-xs text-orange-600">
                      Acesse dados diários e análises mais detalhadas do seu portfólio.
                    </p>
                  </div>
                  <Link href="/pricing">
                    <Badge variant="outline" className="text-xs cursor-pointer">
                      Ver Planos
                    </Badge>
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
