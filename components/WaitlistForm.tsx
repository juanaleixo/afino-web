"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Mail, CheckCircle, AlertCircle, Loader2, Users, TrendingUp } from "lucide-react"
import { WaitlistService } from "@/lib/waitlist"
import { toast } from "sonner"

interface WaitlistFormProps {
  showStats?: boolean
  className?: string
}

export default function WaitlistForm({ showStats = true, className = "" }: WaitlistFormProps) {
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [stats, setStats] = useState<{ total: number; recent: number } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!WaitlistService.validateEmail(email)) {
      toast.error("Por favor, insira um email válido")
      return
    }

    setIsLoading(true)
    
    try {
      const result = await WaitlistService.addToWaitlist(email, name)
      
      if (result.success) {
        setIsSuccess(true)
        setEmail("")
        setName("")
        toast.success("Email adicionado com sucesso! Te avisaremos quando estivermos prontos.")
      } else {
        toast.error(result.error || "Erro ao adicionar email")
      }
    } catch (error) {
      toast.error("Erro interno. Tente novamente.")
    } finally {
      setIsLoading(false)
    }
  }

  const loadStats = async () => {
    try {
      const result = await WaitlistService.getWaitlistStats()
      if (!result.error) {
        setStats({ total: result.total, recent: result.recent })
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error)
    }
  }

  // Carregar estatísticas quando o componente montar
  useEffect(() => {
    if (showStats) {
      loadStats()
    }
  }, [showStats])

  if (isSuccess) {
    return (
      <Card className={className}>
        <CardContent className="pt-6">
          <div className="text-center space-y-4">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto" />
            <h3 className="text-lg font-semibold">Email adicionado com sucesso!</h3>
            <p className="text-muted-foreground">
              Você será notificado assim que o Afino estiver disponível.
            </p>
            <Button 
              variant="outline" 
              onClick={() => setIsSuccess(false)}
              className="mt-4"
            >
              Adicionar outro email
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Junte-se à Lista de Espera
        </CardTitle>
        <CardDescription>
          Seja um dos primeiros a experimentar o Afino quando lançarmos!
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome (opcional)</Label>
            <Input
              id="name"
              type="text"
              placeholder="Seu nome"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isLoading}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              placeholder="seu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <Button 
            type="submit" 
            className="w-full" 
            disabled={isLoading || !email}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adicionando...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Entrar na Lista de Espera
              </>
            )}
          </Button>
        </form>

        {showStats && stats && (
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Total na lista:</span>
                <Badge variant="secondary">{stats.total}</Badge>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">Esta semana:</span>
                <Badge variant="secondary">{stats.recent}</Badge>
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-muted-foreground text-center">
          Não enviaremos spam. Apenas notificações sobre o lançamento.
        </div>
      </CardContent>
    </Card>
  )
}
