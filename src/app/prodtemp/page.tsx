"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  BarChart3, 
  Wallet, 
  TrendingUp, 
  DollarSign,
  PieChart,
  Activity,
  Star,
  CheckCircle,
  Users,
  Zap,
  Shield,
  Clock,
  Calendar,
  Target,
  Sparkles
} from "lucide-react"
import Image from "next/image"
import WaitlistForm from "@/components/WaitlistForm"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart as RechartsPieChart, Pie, Cell, BarChart, Bar } from 'recharts'

export default function ProdTempPage() {
  // Dados mockados para demonstração
  const mockStats = {
    totalValue: 125000,
    totalAssets: 8,
    activeAccounts: 3,
    monthlyReturn: 2.5
  }

  // Dados para gráfico principal - Composição por Ativo
  const assetComposition = [
    { name: "PETR4", value: 45000, percentage: 36.0, type: "Ação", change: 2.1 },
    { name: "VALE3", value: 32000, percentage: 25.6, type: "Ação", change: -0.8 },
    { name: "CDB Banco", value: 28000, percentage: 22.4, type: "Renda Fixa", change: 0.5 },
    { name: "FII HGLG11", value: 20000, percentage: 16.0, type: "FII", change: 1.2 }
  ]

  // Dados para gráfico de evolução
  const portfolioData = [
    { date: 'Jan', value: 100000 },
    { date: 'Fev', value: 105000 },
    { date: 'Mar', value: 110000 },
    { date: 'Abr', value: 108000 },
    { date: 'Mai', value: 115000 },
    { date: 'Jun', value: 120000 },
    { date: 'Jul', value: 118000 },
    { date: 'Ago', value: 122000 },
    { date: 'Set', value: 125000 },
    { date: 'Out', value: 128000 },
    { date: 'Nov', value: 132000 },
    { date: 'Dez', value: 135000 }
  ]

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value)
  }

  const formatPercentage = (value: number) => {
    return `${value > 0 ? '+' : ''}${value.toFixed(1)}%`
  }

  return (
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
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                <Clock className="h-3 w-3 mr-1" />
                Em Breve
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="space-y-8">
          {/* Hero Section */}
          <div className="text-center space-y-6 py-8">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                <Calendar className="h-3 w-3 mr-1" />
                Lançamento em Breve
              </Badge>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold">
              Revolucione suas
              <span className="text-blue-600 block">Finanças</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              O Afino é a plataforma completa para gestão financeira e investimentos. 
              Tudo que você precisa em um só lugar.
            </p>
          </div>

          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Saldo Total</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(mockStats.totalValue)}</div>
                <p className="text-xs text-muted-foreground">{mockStats.totalAssets} ativos</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Contas Ativas</CardTitle>
                <Wallet className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mockStats.activeAccounts}</div>
                <p className="text-xs text-muted-foreground">Contas bancárias</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ativos</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mockStats.totalAssets}</div>
                <p className="text-xs text-muted-foreground">Ativos diferentes</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Rentabilidade</CardTitle>
                <BarChart3 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{formatPercentage(mockStats.monthlyReturn)}</div>
                <p className="text-xs text-muted-foreground">Este mês</p>
              </CardContent>
            </Card>
          </div>

          {/* Main Chart - Asset Composition */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Composição do Portfólio
              </CardTitle>
              <CardDescription>Distribuição percentual dos seus ativos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-2">
                {/* Pie Chart */}
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie
                        data={assetComposition}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={120}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {assetComposition.map((entry, index) => (
                          <Cell 
                            key={`cell-${index}`} 
                            fill={index === 0 ? '#3B82F6' : index === 1 ? '#10B981' : index === 2 ? '#8B5CF6' : '#F59E0B'} 
                          />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value: any, name: any, props: any) => [
                          `${formatCurrency(value)} (${props.payload.percentage}%)`, 
                          props.payload.name
                        ]}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>

                {/* Asset Details */}
                <div className="space-y-4">
                  <h4 className="font-semibold text-lg">Detalhes dos Ativos</h4>
                  {assetComposition.map((asset, index) => (
                    <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div 
                          className="w-4 h-4 rounded-full" 
                          style={{ 
                            backgroundColor: index === 0 ? '#3B82F6' : index === 1 ? '#10B981' : index === 2 ? '#8B5CF6' : '#F59E0B' 
                          }}
                        />
                        <div>
                          <div className="font-medium">{asset.name}</div>
                          <div className="text-sm text-muted-foreground">{asset.type}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(asset.value)}</div>
                        <div className="text-sm text-muted-foreground">{asset.percentage}%</div>
                        <div className={`text-xs ${asset.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatPercentage(asset.change)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Portfolio Evolution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LineChart className="h-5 w-5" />
                Evolução do Patrimônio
              </CardTitle>
              <CardDescription>Histórico de 12 meses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={portfolioData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis 
                      tickFormatter={(value) => formatCurrency(value).replace('R$', '')}
                    />
                    <Tooltip 
                      formatter={(value: any) => [formatCurrency(value), 'Patrimônio']}
                      labelFormatter={(label) => `Mês: ${label}`}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#3B82F6" 
                      strokeWidth={3}
                      fillOpacity={1} 
                      fill="url(#colorValue)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Waitlist Section */}
      <section className="bg-gradient-to-r from-blue-50 to-purple-50 py-16">
        <div className="container mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-2 items-center">
            <div className="space-y-6">
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  <Star className="h-3 w-3 mr-1" />
                  Lista de Espera
                </Badge>
              </div>
              <h2 className="text-3xl font-bold">Seja um dos Primeiros!</h2>
              <p className="text-lg text-muted-foreground">
                O Afino está sendo desenvolvido com muito cuidado e será lançado em breve. 
                Junte-se à nossa lista de espera e seja notificado assim que estivermos prontos.
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Acesso antecipado à plataforma</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Desconto especial para early adopters</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  <span>Feedback direto com a equipe</span>
                </div>
              </div>
            </div>
            <WaitlistForm showStats={true} />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center space-x-4">
              <Image
                src="/icon.svg"
                alt="Afino Finance"
                width={24}
                height={24}
                className="h-6 w-6"
              />
              <span className="text-lg font-semibold">Afino Finance</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 Afino Finance. Em desenvolvimento - Funcionalidades demonstradas com dados simulados.
            </p>
            <p className="text-xs text-muted-foreground">
              Previsão de lançamento: Q1 2024 • São Paulo, Brasil
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
