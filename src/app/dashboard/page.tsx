"use client"

import { useState, useEffect } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { useAuth } from "@/lib/auth"
import { PortfolioService } from "@/lib/portfolio"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  BarChart3, 
  Wallet, 
  TrendingUp, 
  Settings, 
  LogOut, 
  Plus,
  DollarSign,
  PieChart,
  Activity,
  Loader2
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { toast } from "sonner"
import PlanStatus from "@/components/PlanStatus"

export default function DashboardPage() {
  const { user, signOut } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [portfolioStats, setPortfolioStats] = useState<any>(null)
  const [loadingStats, setLoadingStats] = useState(true)

  useEffect(() => {
    if (!user?.id) return

    const loadDashboardStats = async (userId: string) => {
      try {
        setLoadingStats(true)
        const portfolioService = new PortfolioService(userId)
        const today = new Date().toISOString().split('T')[0]!
        const stats = await portfolioService.getPortfolioStats(today)
        setPortfolioStats(stats)
      } catch (error) {
        console.error('Erro ao carregar estatísticas:', error)
        toast.error('Erro ao carregar dados do dashboard')
      } finally {
        setLoadingStats(false)
      }
    }

    loadDashboardStats(user.id as string)
  }, [user?.id])

  const handleSignOut = async () => {
    setIsLoading(true)
    await signOut()
    setIsLoading(false)
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const menuItems = [
    {
      title: "Contas",
      description: "Gerencie suas contas",
      icon: Wallet,
      href: "/dashboard/accounts",
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      title: "Ativos",
      description: "Cadastro de ativos (ações, cripto, etc.)",
      icon: TrendingUp,
      href: "/dashboard/assets",
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Eventos",
      description: "Movimentações e avaliações",
      icon: Activity,
      href: "/dashboard/events",
      color: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      title: "Evolução",
      description: "Linha do tempo do patrimônio",
      icon: PieChart,
      href: "/dashboard/portfolio",
      color: "text-orange-600",
      bgColor: "bg-orange-50",
    },
  ]

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Image
                  src="/icon.svg"
                  alt="Afino Finance"
                  width={32}
                  height={32}
                  className="h-8 w-8"
                />
                <div>
                  <h1 className="text-2xl font-bold">Afino</h1>
                  <p className="text-sm text-muted-foreground">Hub Financeiro Inteligente</p>
                </div>
              </div>
              
              <div className="flex items-center space-x-4">
                <PlanStatus showUpgradeButton={false} />
                <Badge variant="secondary">
                  {user?.email}
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSignOut}
                  disabled={isLoading}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Sair
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          {/* Welcome Section */}
          <div className="mb-8">
            <h2 className="text-3xl font-bold mb-2">Bem-vindo de volta!</h2>
            <p className="text-muted-foreground">
              Gerencie suas finanças e acompanhe seus investimentos de forma simples e eficiente.
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loadingStats ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-sm">Carregando...</span>
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {portfolioStats ? formatCurrency(portfolioStats.totalValue) : 'R$ 0,00'}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {portfolioStats ? `${portfolioStats.totalAssets} ativos` : 'Sem dados'}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Contas Ativas</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">--</div>
                <p className="text-xs text-muted-foreground">
                  Em desenvolvimento
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ativos</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loadingStats ? (
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span className="text-sm">Carregando...</span>
                  </div>
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {portfolioStats?.totalAssets || 0}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {portfolioStats?.totalAssets > 0 ? 'Ativos diferentes' : 'Nenhum ativo'}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Rentabilidade</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-muted-foreground">--</div>
                <p className="text-xs text-muted-foreground">
                  Em desenvolvimento
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Menu Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center space-x-4">
                      <div className={`p-3 rounded-lg ${item.bgColor}`}>
                        <item.icon className={`h-6 w-6 ${item.color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{item.title}</CardTitle>
                        <CardDescription>{item.description}</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="mt-8">
            <h3 className="text-xl font-semibold mb-4">Ações Rápidas</h3>
            <div className="flex flex-wrap gap-4">
              <Button asChild>
                <Link href="/dashboard/accounts/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Conta
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/assets/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Ativo
                </Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/dashboard/events/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Transação
                </Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
} 
