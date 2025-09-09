"use client"

import { useState } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { useAuth } from "@/lib/auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Settings, User, Loader2, ArrowLeft, Crown, CreditCard, LogOut } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { SubscriptionStatus } from "@/components/subscription"

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    if (signingOut) return
    
    setSigningOut(true)
    try {
      await signOut()
      toast.success('Logout realizado com sucesso!')
    } catch (error) {
      console.error('Erro ao fazer logout')
      toast.error('Erro ao fazer logout')
      setSigningOut(false)
    }
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
                <Settings className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">Configurações</h1>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">

        <div className="space-y-6">
          {/* Assinatura */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Crown className="h-5 w-5" />
                <span>Assinatura</span>
              </CardTitle>
              <CardDescription>
                Gerencie seu plano e método de pagamento
              </CardDescription>
            </CardHeader>
            <CardContent>
              <SubscriptionStatus />
              <div className="mt-4">
                <Link href="/dashboard/subscription">
                  <Button variant="outline" className="w-full md:w-auto">
                    <CreditCard className="h-4 w-4 mr-2" />
                    Ver Detalhes da Assinatura
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {/* Informações da Conta */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Informações da Conta</span>
              </CardTitle>
              <CardDescription>
                Suas informações básicas de conta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">
                    {user?.email || 'Não disponível'}
                  </p>
                </div>
                <Badge variant="secondary">
                  Verificado
                </Badge>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="font-medium">ID da Conta</p>
                  <p className="text-sm text-muted-foreground font-mono">
                    {user?.id?.substring(0, 8)}...
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="font-medium">Membro desde</p>
                  <p className="text-sm text-muted-foreground">
                    {user?.created_at 
                      ? new Date(user.created_at).toLocaleDateString('pt-BR')
                      : 'Não disponível'
                    }
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Ações da Conta */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Ações da Conta</span>
              </CardTitle>
              <CardDescription>
                Gerencie sua conta e sessão
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <p className="font-medium">Sair da Conta</p>
                  <p className="text-sm text-muted-foreground">
                    Faça logout de forma segura
                  </p>
                </div>
                <Button 
                  variant="outline" 
                  onClick={handleSignOut}
                  disabled={signingOut}
                >
                  {signingOut ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saindo...
                    </>
                  ) : (
                    <>
                      <LogOut className="h-4 w-4 mr-2" />
                      Sair
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        </main>
      </div>
    </ProtectedRoute>
  )
} 