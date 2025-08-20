"use client"

import { useState, useEffect } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { useAuth } from "@/lib/auth"
import { PortfolioService } from "@/lib/portfolio"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { StatusBadge } from "@/components/ui/status-badge"
import { AssetBadge } from "@/components/ui/asset-badge"
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
  ArrowUp,
  ArrowDown,
  Clock,
  Users
} from "lucide-react"
import Link from "next/link"
import Image from "next/image"
import { toast } from "sonner"
import PlanStatus from "@/components/PlanStatus"
import ThemeSwitch from "@/components/ThemeSwitch"

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
      description: "Gerencie suas contas bancárias",
      icon: Wallet,
      href: "/dashboard/accounts",
      badge: "primary",
    },
    {
      title: "Ativos",
      description: "Cadastro de ações, cripto e outros",
      icon: TrendingUp,
      href: "/dashboard/assets",
      badge: "success",
    },
    {
      title: "Eventos",
      description: "Transações e movimentações",
      icon: Activity,
      href: "/dashboard/events",
      badge: "info",
    },
    {
      title: "Timeline",
      description: "Linha do tempo patrimonial",
      icon: TrendingUp,
      href: "/dashboard/timeline",
      badge: null,
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
                <ThemeSwitch />
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
        <main className="dashboard-page">
          {/* Welcome Section */}
          <div className="page-header">
            <h2 className="page-title">Bem-vindo de volta!</h2>
            <p className="page-description">
              Gerencie suas finanças e acompanhe seus investimentos de forma simples e eficiente.
            </p>
          </div>

          {/* Quick Stats */}
          <div className="stats-grid">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Patrimônio Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loadingStats ? (
                  <LoadingState variant="inline" size="sm" message="Carregando..." />
                ) : (
                  <>
                    <div className="text-2xl font-bold text-foreground">
                      {portfolioStats ? formatCurrency(portfolioStats.totalValue) : 'R$ 0,00'}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge variant="success" size="sm">
                        <ArrowUp className="h-3 w-3" />
                        +0,0%
                      </StatusBadge>
                      <span className="text-xs text-muted-foreground">
                        {portfolioStats ? `${portfolioStats.totalAssets} posições` : 'Sem dados'}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Tipos de Ativo</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {loadingStats ? (
                  <LoadingState variant="inline" size="sm" message="Carregando..." />
                ) : (
                  <>
                    <div className="text-2xl font-bold">
                      {portfolioStats?.totalAssets || 0}
                    </div>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <AssetBadge assetClass="stock" size="sm" showLabel={false} />
                      <AssetBadge assetClass="crypto" size="sm" showLabel={false} />
                      <AssetBadge assetClass="currency" size="sm" showLabel={false} />
                      <span className="text-xs text-muted-foreground">
                        {portfolioStats?.totalAssets > 0 ? 'Diversificado' : 'Sem ativos'}
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Últimas Atividades</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">3</div>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge variant="info" size="sm">
                    Hoje
                  </StatusBadge>
                  <span className="text-xs text-muted-foreground">
                    transações
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Performance</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-success">+2,4%</div>
                <div className="flex items-center gap-2 mt-1">
                  <StatusBadge variant="success" size="sm">
                    <ArrowUp className="h-3 w-3" />
                    30 dias
                  </StatusBadge>
                  <span className="text-xs text-muted-foreground">
                    vs mês anterior
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Menu Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2 mb-8">
            {menuItems.map((item) => (
              <Link key={item.href} href={item.href}>
                <Card className="hover:shadow-lg transition-all hover:scale-[1.02] cursor-pointer">
                  <CardHeader>
                    <div className="flex items-center space-x-4">
                      <div className="p-3 rounded-lg bg-muted">
                        <item.icon className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <CardTitle className="text-lg">{item.title}</CardTitle>
                          <StatusBadge variant={item.badge as any} size="sm">
                            Novo
                          </StatusBadge>
                        </div>
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
                  Novo Evento
                </Link>
              </Button>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
} 
