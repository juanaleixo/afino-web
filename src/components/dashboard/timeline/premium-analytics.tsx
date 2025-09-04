"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TrendingUp, TrendingDown, Target, Activity, BarChart3, Eye, Crown, Loader2, PieChart, LineChart, Filter } from 'lucide-react'
import { useState, useEffect } from 'react'
import { ResponsiveContainer, LineChart as RechartsLine, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart as RechartsPie, Pie, Cell, BarChart as RechartsBar, Bar } from 'recharts'

interface AssetAnalysis {
  asset_id: string
  asset_symbol: string
  asset_class: string
  firstValue: number
  lastValue: number
  totalReturn: number
  totalReturnPercent: number
  volatility: number
  sharpeRatio: number
  dataPoints: number
  daily_values: Array<{ date: string; value: number }>
}

interface PremiumAnalyticsProps {
  performanceData: AssetAnalysis[]
  benchmarkData?: any
  isLoading: boolean
  period: { from: string; to: string }
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D', '#FFC658', '#8DD1E1']

export default function PremiumAnalytics({ 
  performanceData, 
  benchmarkData, 
  isLoading, 
  period 
}: PremiumAnalyticsProps) {
  const [selectedView, setSelectedView] = useState<'overview' | 'performance' | 'risk' | 'comparison'>('overview')
  const [selectedAsset, setSelectedAsset] = useState<string>('')

  // Auto-select first asset when performance data is available
  useEffect(() => {
    if (performanceData && performanceData.length > 0 && !selectedAsset) {
      setSelectedAsset(performanceData[0]?.asset_id || '')
    }
  }, [performanceData, selectedAsset])

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatPercent = (value: number, decimals = 2) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(decimals)}%`
  }

  const getBestPerformer = () => {
    if (!performanceData || performanceData.length === 0) return null
    return performanceData.reduce((best, current) => 
      current.totalReturnPercent > best.totalReturnPercent ? current : best
    )
  }

  const getWorstPerformer = () => {
    if (!performanceData || performanceData.length === 0) return null
    return performanceData.reduce((worst, current) => 
      current.totalReturnPercent < worst.totalReturnPercent ? current : worst
    )
  }

  const getMostVolatile = () => {
    if (!performanceData || performanceData.length === 0) return null
    return performanceData.reduce((most, current) => 
      current.volatility > most.volatility ? current : most
    )
  }

  const getHighestSharpe = () => {
    if (!performanceData || performanceData.length === 0) return null
    return performanceData.reduce((highest, current) => 
      current.sharpeRatio > highest.sharpeRatio ? current : highest
    )
  }

  // Preparar dados para gráfico de pizza (alocação atual)
  const allocationData = performanceData.map((asset, index) => ({
    name: asset.asset_symbol,
    value: asset.lastValue,
    color: COLORS[index % COLORS.length]
  }))

  // Preparar dados para gráfico de barras (performance) - filtrar ativos com 0% de variação
  const performanceBarData = performanceData
    .filter(asset => asset.totalReturnPercent !== 0)
    .sort((a, b) => b.totalReturnPercent - a.totalReturnPercent)
    .map(asset => ({
      name: asset.asset_symbol,
      performance: asset.totalReturnPercent,
      volatility: asset.volatility,
      sharpe: asset.sharpeRatio
    }))

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span>Carregando análise premium...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!performanceData || performanceData.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">Análise Premium</h3>
            <p className="text-muted-foreground mb-4">
              Ative os dados diários para ver análises avançadas de performance
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const bestPerformer = getBestPerformer()
  const worstPerformer = getWorstPerformer()
  const mostVolatile = getMostVolatile()
  const highestSharpe = getHighestSharpe()
  const totalValue = performanceData.reduce((sum, asset) => sum + asset.lastValue, 0)

  return (
    <div className="space-y-6">
      {/* Header Premium */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Crown className="h-6 w-6 text-yellow-500" />
              <CardTitle>Análise Premium Avançada</CardTitle>
              <Badge variant="default">Dados Diários</Badge>
            </div>
            <div className="text-sm text-muted-foreground">
              Período: {new Date(period.from).toLocaleDateString('pt-BR')} - {new Date(period.to).toLocaleDateString('pt-BR')}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Métricas de Destaque */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Melhor Performance</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {bestPerformer ? formatPercent(bestPerformer.totalReturnPercent) : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {bestPerformer?.asset_symbol || 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pior Performance</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {worstPerformer ? formatPercent(worstPerformer.totalReturnPercent) : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {worstPerformer?.asset_symbol || 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Maior Volatilidade</CardTitle>
            <Activity className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {mostVolatile ? formatPercent(mostVolatile.volatility) : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {mostVolatile?.asset_symbol || 'N/A'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Melhor Sharpe</CardTitle>
            <Target className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {highestSharpe ? highestSharpe.sharpeRatio.toFixed(2) : '-'}
            </div>
            <p className="text-xs text-muted-foreground">
              {highestSharpe?.asset_symbol || 'N/A'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Análise */}
      <Tabs value={selectedView} onValueChange={(value) => setSelectedView(value as any)}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="risk">Análise de Risco</TabsTrigger>
          <TabsTrigger value="comparison">Comparativo</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Alocação Atual */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <PieChart className="h-5 w-5" />
                  <span>Alocação Atual</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsPie>
                    <Pie
                      data={allocationData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {allocationData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number) => [formatCurrency(value), 'Valor']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))', 
                        borderRadius: '8px',
                        color: 'hsl(var(--popover-foreground))',
                        fontSize: '14px'
                      }}
                      labelStyle={{
                        color: 'hsl(var(--popover-foreground))'
                      }}
                      itemStyle={{
                        color: 'hsl(var(--popover-foreground))'
                      }}
                    />
                    <Legend />
                  </RechartsPie>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Performance por Ativo */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <BarChart3 className="h-5 w-5" />
                  <span>Performance por Ativo</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsBar data={performanceBarData}>
                    <CartesianGrid 
                      strokeDasharray="2 4" 
                      stroke="hsl(var(--muted-foreground))" 
                      strokeOpacity={0.2}
                    />
                    <XAxis 
                      dataKey="name" 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis 
                      tickFormatter={(value) => formatPercent(value)}
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <Tooltip 
                      formatter={(value: number) => [formatPercent(value), 'Performance']}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))', 
                        borderRadius: '8px',
                        color: 'hsl(var(--popover-foreground))'
                      }}
                    />
                    <Bar 
                      dataKey="performance" 
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </RechartsBar>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Tabela Detalhada */}
          <Card>
            <CardHeader>
              <CardTitle>Análise Detalhada por Ativo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Ativo</th>
                      <th className="text-left p-2">Classe</th>
                      <th className="text-right p-2">Valor Atual</th>
                      <th className="text-right p-2">Retorno</th>
                      <th className="text-right p-2">Volatilidade</th>
                      <th className="text-right p-2">Sharpe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceData
                      .filter(asset => asset.totalReturnPercent !== 0)
                      .map((asset, index) => (
                      <tr key={asset.asset_id} className="border-b hover:bg-muted/50">
                        <td className="p-2 font-medium">{asset.asset_symbol || asset.asset_id}</td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-xs">
                            {asset.asset_class}
                          </Badge>
                        </td>
                        <td className="p-2 text-right font-mono">
                          {formatCurrency(asset.lastValue)}
                        </td>
                        <td className={`p-2 text-right font-mono ${
                          asset.totalReturnPercent >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {formatPercent(asset.totalReturnPercent)}
                        </td>
                        <td className="p-2 text-right font-mono text-orange-600">
                          {formatPercent(asset.volatility)}
                        </td>
                        <td className="p-2 text-right font-mono text-purple-600">
                          {asset.sharpeRatio.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          <div className="flex items-center space-x-4">
            <Select value={selectedAsset} onValueChange={setSelectedAsset}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Selecione um ativo para análise" />
              </SelectTrigger>
              <SelectContent>
                {performanceData.map(asset => (
                  <SelectItem key={asset.asset_id} value={asset.asset_id}>
                    {asset.asset_symbol || asset.asset_id} - {asset.asset_class}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedAsset && (
            <Card>
              <CardHeader>
                <CardTitle>
                  Evolução - {performanceData.find(a => a.asset_id === selectedAsset)?.asset_symbol || performanceData.find(a => a.asset_id === selectedAsset)?.asset_id}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <RechartsLine data={
                    performanceData.find(a => a.asset_id === selectedAsset)?.daily_values || []
                  }>
                    <CartesianGrid 
                      strokeDasharray="2 4" 
                      stroke="hsl(var(--muted-foreground))" 
                      strokeOpacity={0.2}
                    />
                    <XAxis 
                      dataKey="date"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))', 
                        borderRadius: '8px',
                        color: 'hsl(var(--popover-foreground))'
                      }}
                    />
                    <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={2} />
                  </RechartsLine>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="risk" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Risco vs Retorno</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <RechartsBar data={performanceData}>
                    <CartesianGrid 
                      strokeDasharray="2 4" 
                      stroke="hsl(var(--muted-foreground))" 
                      strokeOpacity={0.2}
                    />
                    <XAxis 
                      dataKey="asset_symbol"
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <YAxis 
                      tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                      axisLine={{ stroke: 'hsl(var(--border))' }}
                      tickLine={{ stroke: 'hsl(var(--border))' }}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => [
                        `${value.toFixed(2)}%`, 
                        name === 'volatility' ? 'Volatilidade' : 'Retorno'
                      ]}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--popover))', 
                        border: '1px solid hsl(var(--border))', 
                        borderRadius: '8px',
                        color: 'hsl(var(--popover-foreground))'
                      }}
                    />
                    <Bar dataKey="volatility" fill="#ff8042" name="Volatilidade %" />
                    <Bar dataKey="totalReturnPercent" fill="#8884d8" name="Retorno %" />
                  </RechartsBar>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Índice Sharpe por Ativo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {performanceData
                    .sort((a, b) => b.sharpeRatio - a.sharpeRatio)
                    .map((asset, index) => (
                      <div key={asset.asset_id} className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">{index + 1}</Badge>
                          <span className="font-medium">{asset.asset_symbol || asset.asset_id}</span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Progress 
                            value={Math.min(Math.max((asset.sharpeRatio + 2) * 25, 0), 100)} 
                            className="w-20" 
                          />
                          <span className="font-mono text-sm w-12 text-right">
                            {asset.sharpeRatio.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="comparison" className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <Crown className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
                <h3 className="font-semibold mb-2">Comparação com Benchmarks</h3>
                <p className="text-muted-foreground">
                  Comparação com CDI, IBOVESPA, S&P 500 e outros índices será implementada aqui
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}