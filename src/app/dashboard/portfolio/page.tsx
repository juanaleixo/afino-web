"use client"

import { useState, useEffect, useCallback } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { useAuth } from "@/lib/auth"
import { PortfolioService } from "@/lib/portfolio"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, DollarSign, Loader2, ArrowLeft, Calendar } from "lucide-react"
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

  // Página simplificada: foco na linha do tempo

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
        {/* Cabeçalho */}
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
                <TrendingUp className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">Evolução</h1>
              </div>
            </div>
          </div>
        </header>

        {/* Conteúdo principal */}
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

          {/* Card de resumo simples */}
          <Card className="mb-8">
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

          {/* Linha do tempo do portfólio */}
          {portfolioData?.monthlySeries && (
            <div className="mb-8">
              <PortfolioChart
                monthlyData={portfolioData.monthlySeries}
                dailyData={portfolioData.dailySeries}
                isLoading={loading}
              />
            </div>
          )}
        </main>
      </div>
    </ProtectedRoute>
  )
} 
