"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { TrendingUp, Activity, Target, Crown, Loader2, LineChart, BarChart3, ArrowLeft } from 'lucide-react'
import { useState, useEffect } from 'react'
import { ResponsiveContainer, LineChart as RechartsLine, Line, XAxis, YAxis, CartesianGrid, Tooltip, Area, AreaChart } from 'recharts'

interface AssetDrillDownProps {
  assetId: string | null
  assetSymbol?: string | undefined
  assetClass?: string | undefined
  dailyPositions: Array<{ date: string; units: number; value: number }>
  accounts: Array<{ id: string; label: string }>
  onLoadAccountData: (accountId: string, assetId: string) => Promise<any>
  onBack: () => void
  isLoading: boolean
}

export default function AssetDrillDown({ 
  assetId, 
  assetSymbol, 
  assetClass,
  dailyPositions, 
  accounts, 
  onLoadAccountData,
  onBack,
  isLoading 
}: AssetDrillDownProps) {
  const [selectedAccount, setSelectedAccount] = useState<string>('')
  const [accountPositions, setAccountPositions] = useState<any[]>([])
  const [loadingAccount, setLoadingAccount] = useState(false)
  const [viewType, setViewType] = useState<'value' | 'units'>('value')

  useEffect(() => {
    if (selectedAccount && assetId) {
      loadAccountData()
    }
  }, [selectedAccount, assetId])

  const loadAccountData = async () => {
    if (!selectedAccount || !assetId) return
    
    setLoadingAccount(true)
    try {
      const data = await onLoadAccountData(selectedAccount, assetId)
      setAccountPositions(data)
    } catch (error) {
      console.error('Erro ao carregar dados da conta:', error)
      setAccountPositions([])
    } finally {
      setLoadingAccount(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value)
  }

  const formatUnits = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4
    }).format(value)
  }

  const calculateStats = (positions: typeof dailyPositions) => {
    if (!positions || positions.length === 0) {
      return { firstValue: 0, lastValue: 0, totalReturn: 0, totalReturnPercent: 0, avgValue: 0 }
    }

    const values = positions.map(p => p.value).filter(v => v > 0)
    const firstValue = values[0] || 0
    const lastValue = values[values.length - 1] || 0
    const totalReturn = lastValue - firstValue
    const totalReturnPercent = firstValue > 0 ? (totalReturn / firstValue) * 100 : 0
    const avgValue = values.reduce((sum, v) => sum + v, 0) / values.length

    return { firstValue, lastValue, totalReturn, totalReturnPercent, avgValue }
  }

  const stats = calculateStats(dailyPositions)
  const accountStats = calculateStats(accountPositions)

  const chartData = dailyPositions.map(pos => ({
    ...pos,
    formattedDate: new Date(pos.date).toLocaleDateString('pt-BR')
  }))

  const accountChartData = accountPositions.map(pos => ({
    ...pos,
    formattedDate: new Date(pos.date).toLocaleDateString('pt-BR')
  }))

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span>Carregando análise do ativo...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!assetId || !dailyPositions.length) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-center">
            <LineChart className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">Selecione um Ativo</h3>
            <p className="text-muted-foreground">
              Escolha um ativo para ver sua evolução detalhada
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div className="flex items-center space-x-2">
                <Crown className="h-6 w-6 text-yellow-500" />
                <CardTitle className="text-xl">{assetSymbol}</CardTitle>
                <Badge variant="outline">{assetClass}</Badge>
                <Badge variant="default">Análise Individual</Badge>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                variant={viewType === 'value' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewType('value')}
              >
                Valor
              </Button>
              <Button 
                variant={viewType === 'units' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setViewType('units')}
              >
                Unidades
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Métricas do Ativo */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Atual</CardTitle>
            <Target className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.lastValue)}
            </div>
            <p className="text-xs text-muted-foreground">
              Posição total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retorno Total</CardTitle>
            <TrendingUp className={`h-4 w-4 ${stats.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`} />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${stats.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.totalReturn >= 0 ? '+' : ''}{formatCurrency(stats.totalReturn)}
            </div>
            <p className={`text-xs ${stats.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {stats.totalReturn >= 0 ? '+' : ''}{stats.totalReturnPercent.toFixed(2)}% no período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Médio</CardTitle>
            <Activity className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {formatCurrency(stats.avgValue)}
            </div>
            <p className="text-xs text-muted-foreground">
              Média do período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pontos de Dados</CardTitle>
            <BarChart3 className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {dailyPositions.length}
            </div>
            <p className="text-xs text-muted-foreground">
              Dias com posição
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico Principal */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Evolução da Posição - {assetSymbol}</span>
            <div className="text-sm text-muted-foreground">
              {chartData.length} pontos de dados
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={400}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid 
                strokeDasharray="2 4" 
                stroke="hsl(var(--muted-foreground))" 
                strokeOpacity={0.2}
              />
              <XAxis 
                dataKey="formattedDate"
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
                formatter={(value: number) => 
                  viewType === 'value' ? formatCurrency(value) : formatUnits(value)
                } 
                labelFormatter={(label) => `Data: ${label}`}
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--popover))', 
                  border: '1px solid hsl(var(--border))', 
                  borderRadius: '8px',
                  color: 'hsl(var(--popover-foreground))'
                }}
              />
              <Area 
                type="monotone" 
                dataKey={viewType} 
                stroke="#8884d8" 
                fillOpacity={1} 
                fill="url(#colorValue)" 
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Análise por Conta */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Análise por Conta</span>
            <div className="flex items-center space-x-2">
              <Select value={selectedAccount} onValueChange={setSelectedAccount}>
                <SelectTrigger className="w-64">
                  <SelectValue placeholder="Selecione uma conta para detalhar" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingAccount ? (
            <div className="flex items-center justify-center h-32">
              <div className="flex items-center space-x-2">
                <Loader2 className="h-6 w-6 animate-spin" />
                <span>Carregando dados da conta...</span>
              </div>
            </div>
          ) : selectedAccount && accountPositions.length > 0 ? (
            <div className="space-y-4">
              {/* Métricas da Conta */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold">
                    {formatCurrency(accountStats.lastValue)}
                  </div>
                  <div className="text-sm text-muted-foreground">Valor Atual</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className={`text-2xl font-bold ${accountStats.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {accountStats.totalReturn >= 0 ? '+' : ''}{formatCurrency(accountStats.totalReturn)}
                  </div>
                  <div className="text-sm text-muted-foreground">Retorno</div>
                </div>
                <div className="text-center p-4 border rounded-lg">
                  <div className="text-2xl font-bold text-purple-600">
                    {accountPositions.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Dias</div>
                </div>
              </div>

              {/* Gráfico da Conta */}
              <ResponsiveContainer width="100%" height={300}>
                <RechartsLine data={accountChartData}>
                  <CartesianGrid 
                    strokeDasharray="2 4" 
                    stroke="hsl(var(--muted-foreground))" 
                    strokeOpacity={0.2}
                  />
                  <XAxis 
                    dataKey="formattedDate"
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
                    formatter={(value: number) => 
                      viewType === 'value' ? formatCurrency(value) : formatUnits(value)
                    }
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      border: '1px solid hsl(var(--border))', 
                      borderRadius: '8px',
                      color: 'hsl(var(--popover-foreground))'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey={viewType} 
                    stroke="#82ca9d" 
                    strokeWidth={2} 
                  />
                </RechartsLine>
              </ResponsiveContainer>
            </div>
          ) : selectedAccount ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum dado encontrado para esta conta no período selecionado
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Selecione uma conta para ver a evolução específica deste ativo
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}