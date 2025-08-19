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
  showAssetBreakdown?: boolean
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
  showAssetBreakdown = false,
  granularity = 'monthly'
}: AdvancedPortfolioChartProps) {
  const [chartType, setChartType] = useState<'line' | 'area' | 'stacked'>('line')
  const [visibleAssets, setVisibleAssets] = useState<Set<string>>(new Set())
  const [showPercentage, setShowPercentage] = useState(false)

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

  // Processar dados por ativo
  const chartData: ChartDatum[] = useMemo(() => {
    if (!showAssetBreakdown || !assetBreakdown || assetBreakdown.length === 0) {
      return baseData
    }

    // Agrupar por data
    const groupedByDate = assetBreakdown.reduce((acc, item) => {
      if (!acc[item.date]) {
        acc[item.date] = { date: item.date, total_value: 0 }
      }
      acc[item.date].total_value += item.value
      acc[item.date][`asset_${item.asset_id}`] = showPercentage 
        ? item.percentage 
        : item.value
      return acc
    }, {} as Record<string, any>)

    return Object.values(groupedByDate).sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
  }, [baseData, assetBreakdown, showAssetBreakdown, showPercentage])

  // Extrair ativos únicos
  const uniqueAssets = useMemo(() => {
    if (!assetBreakdown) return []
    
    const assets = Array.from(new Set(assetBreakdown.map(item => item.asset_id)))
      .map(assetId => {
        const asset = assetBreakdown.find(item => item.asset_id === assetId)
        return {
          id: assetId,
          symbol: asset?.asset_symbol || assetId,
          class: asset?.asset_class || 'unknown'
        }
      })
    
    return assets
  }, [assetBreakdown])

  // Alternar visibilidade do ativo
  const toggleAssetVisibility = (assetId: string) => {
    const newVisible = new Set(visibleAssets)
    if (newVisible.has(assetId)) {
      newVisible.delete(assetId)
    } else {
      newVisible.add(assetId)
    }
    setVisibleAssets(newVisible)
  }

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
          
          <div className="flex items-center space-x-2">
            {showAssetBreakdown && (
              <>
                <Button
                  variant={showPercentage ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setShowPercentage(!showPercentage)}
                >
                  {showPercentage ? '%' : 'R$'}
                </Button>
                
                <Select value={chartType} onValueChange={(value: any) => setChartType(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="line">
                      <div className="flex items-center space-x-2">
                        <BarChart3 className="h-4 w-4" />
                        <span>Linhas</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="area">
                      <div className="flex items-center space-x-2">
                        <Layers className="h-4 w-4" />
                        <span>Áreas</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="stacked">
                      <div className="flex items-center space-x-2">
                        <PieChart className="h-4 w-4" />
                        <span>Empilhado</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </>
            )}
          </div>
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
            
            {/* Controles de Ativos */}
            {showAssetBreakdown && uniqueAssets.length > 0 && (
              <div className="border rounded-lg p-4 bg-muted/20">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-medium">Ativos Visíveis</h4>
                  <div className="flex space-x-1">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setVisibleAssets(new Set(uniqueAssets.map(a => a.id)))}
                    >
                      Todos
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={() => setVisibleAssets(new Set())}
                    >
                      Limpar
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {uniqueAssets.map((asset, index) => {
                    const isVisible = visibleAssets.has(asset.id)
                    const color = ASSET_COLORS[index % ASSET_COLORS.length]
                    
                    return (
                      <button
                        key={asset.id}
                        onClick={() => toggleAssetVisibility(asset.id)}
                        className={`flex items-center space-x-2 px-3 py-1 rounded-full text-xs transition-all ${
                          isVisible 
                            ? 'bg-primary text-primary-foreground' 
                            : 'bg-background border hover:bg-muted'
                        }`}
                      >
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: color }}
                        />
                        <span>{asset.symbol}</span>
                        {isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Gráfico */}
            <div className="w-full h-96">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'area' || chartType === 'stacked' ? (
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
                      tickFormatter={(v) => showPercentage ? percentFormatter.format(v/100) : currencyFormatter.format(v)}
                      width={100}
                      className="fill-muted-foreground text-xs"
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === 'total_value') return [currencyFormatter.format(value), 'Total']
                        const assetId = name.replace('asset_', '')
                        const asset = uniqueAssets.find(a => a.id === assetId)
                        return [
                          showPercentage ? percentFormatter.format(value/100) : currencyFormatter.format(value),
                          asset?.symbol || assetId
                        ]
                      }}
                      labelFormatter={(label: string) => new Date(label).toLocaleDateString('pt-BR')}
                      contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '0.5rem', color: 'white' }}
                    />
                    <Legend />
                    
                    {!showAssetBreakdown ? (
                      <Area
                        type="monotone"
                        dataKey="total_value"
                        stroke="#3b82f6"
                        fill="#3b82f6"
                        fillOpacity={0.3}
                        strokeWidth={2}
                      />
                    ) : (
                      uniqueAssets.map((asset, index) => {
                        if (!visibleAssets.has(asset.id)) return null
                        const color = ASSET_COLORS[index % ASSET_COLORS.length]
                        
                        return (
                          <Area
                            key={asset.id}
                            type="monotone"
                            dataKey={`asset_${asset.id}`}
                            {...(chartType === 'stacked' && { stackId: "1" })}
                            stroke={color}
                            fill={color}
                            fillOpacity={0.6}
                            strokeWidth={2}
                          />
                        )
                      })
                    )}
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
                      tickFormatter={(v) => showPercentage ? percentFormatter.format(v/100) : currencyFormatter.format(v)}
                      width={100}
                      className="fill-muted-foreground text-xs"
                    />
                    <Tooltip
                      formatter={(value: number, name: string) => {
                        if (name === 'total_value') return [currencyFormatter.format(value), 'Total']
                        const assetId = name.replace('asset_', '')
                        const asset = uniqueAssets.find(a => a.id === assetId)
                        return [
                          showPercentage ? percentFormatter.format(value/100) : currencyFormatter.format(value),
                          asset?.symbol || assetId
                        ]
                      }}
                      labelFormatter={(label: string) => new Date(label).toLocaleDateString('pt-BR')}
                      contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '0.5rem', color: 'white' }}
                    />
                    <Legend />
                    
                    {!showAssetBreakdown ? (
                      <Line
                        type="monotone"
                        dataKey="total_value"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                        activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 2 }}
                      />
                    ) : (
                      uniqueAssets.map((asset, index) => {
                        if (!visibleAssets.has(asset.id)) return null
                        const color = ASSET_COLORS[index % ASSET_COLORS.length]
                        
                        return (
                          <Line
                            key={asset.id}
                            type="monotone"
                            dataKey={`asset_${asset.id}`}
                            stroke={color}
                            strokeWidth={2}
                            dot={{ fill: color, strokeWidth: 2, r: 3 }}
                            activeDot={{ r: 5, stroke: color, strokeWidth: 2 }}
                          />
                        )
                      })
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