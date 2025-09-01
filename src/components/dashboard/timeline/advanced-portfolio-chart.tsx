"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TrendingUp, BarChart3, PieChart, Layers, Eye, EyeOff, ArrowUp, ArrowDown } from 'lucide-react'
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
  ReferenceArea,
} from 'recharts'
import { useState, useMemo, useCallback } from 'react'

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

  // Estados para funcionalidade de drag
  const [refAreaLeft, setRefAreaLeft] = useState<string>('')
  const [refAreaRight, setRefAreaRight] = useState<string>('')
  const [isDragging, setIsDragging] = useState(false)
  const [selectionData, setSelectionData] = useState<{
    startValue: number
    endValue: number
    startDate: string
    endDate: string
    percentage: number
    isPositive: boolean
  } | null>(null)

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

  // Função para calcular dados de seleção em tempo real
  const calculateSelectionData = useCallback((leftDate: string, rightDate: string) => {
    if (!leftDate || !rightDate || leftDate === rightDate) return null
    
    const leftIndex = chartData.findIndex(d => d.date === leftDate)
    const rightIndex = chartData.findIndex(d => d.date === rightDate)
    
    if (leftIndex !== -1 && rightIndex !== -1 && leftIndex !== rightIndex) {
      const startIndex = Math.min(leftIndex, rightIndex)
      const endIndex = Math.max(leftIndex, rightIndex)
      
      const startPoint = chartData[startIndex]
      const endPoint = chartData[endIndex]
      
      if (startPoint && endPoint) {
        const startValue = startPoint.total_value
        const endValue = endPoint.total_value
        const percentage = startValue > 0 ? ((endValue - startValue) / startValue) * 100 : 0
        
        return {
          startValue,
          endValue,
          startDate: startPoint.date,
          endDate: endPoint.date,
          percentage,
          isPositive: percentage >= 0
        }
      }
    }
    return null
  }, [chartData])

  const handleMouseDown = useCallback((e: any) => {
    if (e && e.activeLabel) {
      setRefAreaLeft(e.activeLabel)
      setRefAreaRight(e.activeLabel)
      setIsDragging(true)
      setSelectionData(null)
    }
  }, [])

  const handleMouseMove = useCallback((e: any) => {
    if (isDragging && refAreaLeft && e && e.activeLabel) {
      setRefAreaRight(e.activeLabel)
      
      // Calcular e mostrar dados em tempo real durante o drag
      const realTimeData = calculateSelectionData(refAreaLeft, e.activeLabel)
      if (realTimeData) {
        setSelectionData(realTimeData)
      }
    }
  }, [isDragging, refAreaLeft, calculateSelectionData])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    
    // Manter os dados finais se houver uma seleção válida
    if (!selectionData && refAreaLeft && refAreaRight) {
      const finalData = calculateSelectionData(refAreaLeft, refAreaRight)
      if (finalData) {
        setSelectionData(finalData)
      }
    }
    
    // Limpar estados de referência apenas se não há seleção válida
    if (!selectionData) {
      setRefAreaLeft('')
      setRefAreaRight('')
    }
  }, [refAreaLeft, refAreaRight, selectionData, calculateSelectionData])

  const clearSelection = useCallback(() => {
    setSelectionData(null)
    setRefAreaLeft('')
    setRefAreaRight('')
    setIsDragging(false)
  }, [])

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
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-sm text-muted-foreground">
                Valor atual: <span className="font-semibold text-foreground">{currencyFormatter.format(latestValue)}</span>
              </div>
              
              {selectionData && (
                <div className={`transition-all duration-200 ${isDragging ? 'scale-105' : 'scale-100'}`}>
                  <div className={`flex items-center gap-3 border rounded-lg px-4 py-2 shadow-sm ${
                    isDragging 
                      ? 'bg-primary/10 border-primary/30 shadow-primary/20' 
                      : 'bg-card border-border shadow-sm'
                  }`}>
                    <div className="flex items-center gap-2">
                      {selectionData.isPositive ? (
                        <ArrowUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <ArrowDown className="h-4 w-4 text-red-600" />
                      )}
                      <span className={`font-semibold transition-colors ${
                        selectionData.isPositive ? "text-green-600" : "text-red-600"
                      }`}>
                        {selectionData.isPositive ? '+' : ''}{selectionData.percentage.toFixed(2)}%
                      </span>
                    </div>
                    
                    <div className="text-xs text-muted-foreground border-l pl-3">
                      <div>{new Date(selectionData.startDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</div>
                      <div className="text-center text-[10px] text-muted-foreground/60">→</div>
                      <div>{new Date(selectionData.endDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}</div>
                    </div>
                    
                    {!isDragging && (
                      <button 
                        onClick={clearSelection}
                        className="text-muted-foreground hover:text-foreground transition-colors ml-2 p-1 rounded hover:bg-muted"
                        title="Limpar seleção"
                      >
                        ✕
                      </button>
                    )}
                    
                    {isDragging && (
                      <div className="text-xs text-primary font-medium ml-2">
                        Arrastando...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                {granularity === 'daily' ? 'Dados diários' : 'Dados mensais'} • {chartData.length} pontos
              </div>
              
              {!selectionData && (
                <div className="text-xs text-muted-foreground bg-muted/30 rounded-lg px-3 py-2 border-l-2 border-primary/30">
                  💡 Clique e arraste sobre o gráfico para comparar períodos
                </div>
              )}
            </div>

            {/* Gráfico */}
            <div className="relative">
              <div className="w-full h-96 rounded-lg border bg-gradient-to-br from-card/50 to-card overflow-hidden">
              <ResponsiveContainer width="100%" height="100%">
                {false ? (
                  <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                    <CartesianGrid 
                      strokeDasharray="2 4" 
                      stroke="hsl(var(--muted-foreground))" 
                      strokeOpacity={0.2}
                    />
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => new Date(v).toLocaleDateString('pt-BR', { 
                        month: 'short', 
                        day: granularity === 'daily' ? 'numeric' : undefined,
                        year: '2-digit' 
                      })}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis
                      tickFormatter={(v) => currencyFormatter.format(v).replace('R$', 'R$').replace(',00', '')}
                      width={80}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        return [currencyFormatter.format(value), 'Valor Total']
                      }}
                      labelFormatter={(label: string) => new Date(label).toLocaleDateString('pt-BR')}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))', 
                        borderRadius: '8px',
                        color: 'hsl(var(--popover-foreground))'
                      }}
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
                  <LineChart 
                    data={chartData} 
                    margin={{ top: 20, right: 20, left: 10, bottom: 20 }}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    style={{ cursor: refAreaLeft ? 'crosshair' : 'default' }}
                  >
                    <CartesianGrid 
                      strokeDasharray="2 4" 
                      stroke="hsl(var(--muted-foreground))" 
                      strokeOpacity={0.2}
                    />
                    
                    <XAxis
                      dataKey="date"
                      tickFormatter={(v) => new Date(v).toLocaleDateString('pt-BR', { 
                        month: 'short', 
                        day: granularity === 'daily' ? 'numeric' : undefined,
                        year: '2-digit' 
                      })}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    
                    <YAxis
                      tickFormatter={(v) => currencyFormatter.format(v).replace('R$', 'R$').replace(',00', '')}
                      width={80}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    
                    <Tooltip
                      formatter={(value: number) => [currencyFormatter.format(value), 'Patrimônio']}
                      labelFormatter={(label: string) => new Date(label).toLocaleDateString('pt-BR')}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))', 
                        borderRadius: '8px', 
                        boxShadow: '0 4px 12px hsl(var(--shadow) / 0.15)',
                        color: 'hsl(var(--popover-foreground))'
                      }}
                      cursor={{ stroke: 'hsl(var(--primary))', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    
                    {refAreaLeft && refAreaRight && (
                      <ReferenceArea
                        x1={refAreaLeft}
                        x2={refAreaRight}
                        strokeOpacity={0.6}
                        fillOpacity={0.1}
                        fill="hsl(var(--primary))"
                        stroke="hsl(var(--primary))"
                        strokeWidth={1}
                        strokeDasharray="2 2"
                      />
                    )}
                    
                    <Line
                      type="monotone"
                      dataKey="total_value"
                      stroke="hsl(var(--primary))"
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ 
                        r: 5, 
                        stroke: 'hsl(var(--primary))', 
                        strokeWidth: 2,
                        fill: 'hsl(var(--background))'
                      }}
                      connectNulls={false}
                      isAnimationActive={false}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}