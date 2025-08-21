"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TrendingUp, BarChart3, PieChart, Layers, Eye, EyeOff } from 'lucide-react'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Area,
  AreaChart,
  ReferenceLine,
} from 'recharts'
import { useState, useMemo } from 'react'

interface AdvancedPortfolioChartProps {
  monthlyData: Array<{ month_eom: string; total_value: number }>
  dailyData?: Array<{ date: string; total_value: number }> | null
  assetBreakdown?: Array<{
    date: string
    asset_id: string
    asset_symbol: string
    asset_class: string
    value: number
    percentage: number
  }> | null
  isLoading?: boolean
  granularity: 'daily' | 'monthly'
}

interface ChartDatum {
  date: string
  total_value: number
  [assetKey: string]: number | string
}

const ASSET_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // yellow
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#ec4899', // pink
  '#6b7280', // gray
]

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
})

const percentFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 1,
})

export default function AdvancedPortfolioChart({ 
  monthlyData, 
  dailyData, 
  assetBreakdown,
  isLoading = false,
  granularity = 'monthly'
}: AdvancedPortfolioChartProps) {

  // Processar dados base
  const baseData = useMemo(() => {
    const base = granularity === 'daily' && dailyData && dailyData.length > 0 
      ? dailyData 
      : monthlyData
    
    if (!base || base.length === 0) return []
    
    return base.map((d) => ({
      date: 'date' in d ? d.date : d.month_eom,
      total_value: d.total_value,
    }))
  }, [monthlyData, dailyData, granularity])

  // Dados simplificados - breakdown removido
  const chartData: ChartDatum[] = useMemo(() => {
    return baseData
  }, [baseData])

  // Ativos únicos removidos - funcionalidade simplificada
  const uniqueAssets = useMemo(() => {
    return []
  }, [])


  const latestValue = chartData.at(-1)?.total_value ?? 0

  if (chartData.length === 0 && !isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Timeline Avançada</span>
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
          <CardTitle className="flex items-center space-x-2">
            <TrendingUp className="h-5 w-5" />
            <span>Timeline Avançada</span>
            <Badge variant="outline">Premium</Badge>
          </CardTitle>
          
        </div>
      </CardHeader>
      
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            <span className="ml-2">Carregando gráfico avançado...</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Valor atual: {currencyFormatter.format(latestValue)}
              </div>
              <div className="text-sm text-muted-foreground">
                {granularity === 'daily' ? 'Dados diários' : 'Dados mensais'} • {chartData.length} pontos
              </div>
            </div>
            

            {/* Gráfico */}
            <div className="w-full h-96">
              <ResponsiveContainer width="100%" height="100%">
                {false ? (
                  <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => new Date(v).toLocaleDateString('pt-BR', { 
                        month: 'short', 
                        day: granularity === 'daily' ? 'numeric' : undefined,
                        year: '2-digit' 
                      })}
                      className="fill-muted-foreground text-xs"
                    />
                    <YAxis
                      tickFormatter={(v) => currencyFormatter.format(v)}
                      width={100}
                      className="fill-muted-foreground text-xs"
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        return [currencyFormatter.format(value), 'Valor Total']
                      }}
                      labelFormatter={(label: string) => new Date(label).toLocaleDateString('pt-BR')}
                      contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '0.5rem', color: 'white' }}
                    />
                    <Legend />
                    
                    <Area
                      type="monotone"
                      dataKey="total_value"
                      stroke="#3b82f6"
                      fill="#3b82f6"
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                  </AreaChart>
                ) : (
                  <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => new Date(v).toLocaleDateString('pt-BR', { 
                        month: 'short', 
                        day: granularity === 'daily' ? 'numeric' : undefined,
                        year: '2-digit' 
                      })}
                      className="fill-muted-foreground text-xs"
                    />
                    <YAxis
                      tickFormatter={(v) => currencyFormatter.format(v)}
                      width={100}
                      className="fill-muted-foreground text-xs"
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        return [currencyFormatter.format(value), 'Valor Total']
                      }}
                      labelFormatter={(label: string) => new Date(label).toLocaleDateString('pt-BR')}
                      contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '0.5rem', color: 'white' }}
                    />
                    <Legend />
                    
                    {true ? (
                      <Line
                        type="monotone"
                        dataKey="total_value"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                      />
                    ) : (
                      <Line
                        type="monotone"
                        dataKey="total_value"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                      />
                    )}
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}