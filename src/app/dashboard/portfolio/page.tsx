"use client"

import { useState, useEffect, useCallback } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { useAuth } from "@/lib/auth"
import { PortfolioService } from "@/lib/portfolio"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { TrendingUp, DollarSign, PieChart, Loader2, ArrowLeft, Crown, Calendar } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import PortfolioChart from "@/components/PortfolioChart"

export default function PortfolioPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [portfolioData, setPortfolioData] = useState<any>(null)
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0])
  const [dateRange, setDateRange] = useState({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 30 dias atrás
    to: new Date().toISOString().split('T')[0]
  })

  const loadPortfolio = useCallback(async () => {
    if (!user?.id || !dateRange.from || !dateRange.to || !selectedDate) return

    try {
      setLoading(true)
      
      const portfolioService = new PortfolioService(user.id)
      const data = await portfolioService.getPortfolioData(
        { from: dateRange.from, to: dateRange.to }, 
        selectedDate
      )
      setPortfolioData(data)
      
    } catch (error) {
      console.error('Erro ao carregar portfólio:', error)
      toast.error('Erro ao carregar portfólio')
    } finally {
      setLoading(false)
    }
  }, [user?.id, dateRange.from, dateRange.to, selectedDate])

  useEffect(() => {
    loadPortfolio()
  }, [loadPortfolio])

  const getAssetClassLabel = (assetClass: string) => {
    switch (assetClass) {
      case 'stock':
        return 'Ação'
      case 'bond':
        return 'Título'
      case 'fund':
        return 'Fundo'
      case 'crypto':
        return 'Cripto'
      case 'currency':
        return 'Moeda'
      default:
        return assetClass
    }
  }

  const getAssetClassColor = (assetClass: string) => {
    switch (assetClass) {
      case 'stock':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'bond':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'fund':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
      case 'crypto':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
      case 'currency':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }

  const calculateTotalValue = () => {
    if (!portfolioData?.holdingsAt) return 0
    return portfolioData.holdingsAt.reduce((total: number, holding: any) => total + holding.value, 0)
  }

  const totalValue = calculateTotalValue()

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span>Carregando portfólio...</span>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
              </Link>
              <div className="flex items-center space-x-2">
                <PieChart className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">Portfólio</h1>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">

          {/* Seletor de Data */}
          <div className="mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5" />
                  <span>Data de Referência</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-4">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="px-3 py-2 border rounded-md"
                  />
                  <span className="text-sm text-muted-foreground">
                    Dados em {selectedDate ? new Date(selectedDate).toLocaleDateString('pt-BR') : 'Data não selecionada'}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Cards de resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {formatCurrency(totalValue)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Valor em {selectedDate ? new Date(selectedDate).toLocaleDateString('pt-BR') : 'Data não selecionada'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ativos</CardTitle>
                <PieChart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {portfolioData?.holdingsAt?.length || 0}
                </div>
                <p className="text-xs text-muted-foreground">
                  {portfolioData?.holdingsAt?.length > 0 ? 'Ativos diferentes' : 'Nenhum ativo'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Performance</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-muted-foreground">--</div>
                <p className="text-xs text-muted-foreground">
                  {portfolioData?.dailySeries ? 'Dados diários disponíveis' : 'Apenas dados mensais'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Gráfico do Portfólio */}
          {portfolioData?.monthlySeries && (
            <div className="mb-8">
              <PortfolioChart
                monthlyData={portfolioData.monthlySeries}
                dailyData={portfolioData.dailySeries}
                isLoading={loading}
                isPremium={!!portfolioData.dailySeries}
              />
            </div>
          )}

          {/* Aviso Premium */}
          {!portfolioData?.dailySeries && (
            <Card className="mb-6 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
              <CardContent className="pt-6">
                <div className="flex items-center space-x-2">
                  <Crown className="h-5 w-5 text-orange-600" />
                  <div>
                    <p className="text-sm font-medium text-orange-800 dark:text-orange-200">
                      Funcionalidade Premium
                    </p>
                    <p className="text-xs text-orange-600 dark:text-orange-300">
                      Atualize para o plano Premium para acessar dados diários e detalhamento por conta.
                    </p>
                  </div>
                  <Button size="sm" variant="outline" className="ml-auto">
                    <Link href="/pricing">Ver Planos</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Tabela de holdings */}
          <Card>
            <CardHeader>
              <CardTitle>Seus Investimentos</CardTitle>
              <CardDescription>
                Detalhes de cada ativo no seu portfólio em {selectedDate ? new Date(selectedDate).toLocaleDateString('pt-BR') : 'Data não selecionada'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!portfolioData?.holdingsAt || portfolioData.holdingsAt.length === 0 ? (
                <div className="text-center py-8">
                  <PieChart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Portfólio vazio</h3>
                  <p className="text-muted-foreground mb-4">
                    Você ainda não tem investimentos registrados para esta data.
                  </p>
                  <Button>
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Adicionar Primeiro Investimento
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ativo</TableHead>
                      <TableHead>Quantidade</TableHead>
                      <TableHead>Valor Unitário</TableHead>
                      <TableHead>Valor Total</TableHead>
                      <TableHead>% do Portfólio</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portfolioData.holdingsAt.map((holding: any) => {
                      const unitPrice = holding.value / holding.units
                      const portfolioPercentage = totalValue > 0 ? (holding.value / totalValue) * 100 : 0

                      return (
                        <TableRow key={holding.asset_id}>
                          <TableCell className="font-medium">
                            {holding.asset_id}
                          </TableCell>
                          <TableCell>
                            {holding.units.toLocaleString('pt-BR')}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(unitPrice)}
                          </TableCell>
                          <TableCell>
                            {formatCurrency(holding.value)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center space-x-2">
                              <Progress value={portfolioPercentage} className="w-16" />
                              <span className="text-sm">{portfolioPercentage.toFixed(1)}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </ProtectedRoute>
  )
} 