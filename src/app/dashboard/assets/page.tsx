"use client"

import { useState, useEffect, useCallback } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { useAuth } from "@/lib/auth"
import { supabase, Asset } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, TrendingUp, DollarSign, Loader2, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

export default function AssetsPage() {
  const { user } = useAuth()
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)

  const loadAssets = useCallback(async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('global_assets')
        .select('*')
        .order('symbol', { ascending: true })

      if (error) throw error
      setAssets(data || [])
    } catch (error) {
      console.error('Erro ao carregar ativos:', error)
      toast.error('Erro ao carregar ativos')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadAssets()
  }, [loadAssets])

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

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span>Carregando ativos...</span>
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
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar
                  </Button>
                </Link>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-6 w-6 text-primary" />
                  <h1 className="text-2xl font-bold">Ativos</h1>
                </div>
              </div>
              
              <Button asChild>
                <Link href="/dashboard/assets/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Ativo
                </Link>
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">

        <Card>
          <CardHeader>
            <CardTitle>Lista de Ativos</CardTitle>
            <CardDescription>
              Todos os ativos disponíveis para investimento
            </CardDescription>
          </CardHeader>
          <CardContent>
            {assets.length === 0 ? (
              <div className="text-center py-8">
                <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum ativo encontrado</h3>
                <p className="text-muted-foreground mb-4">
                  Você ainda não tem ativos cadastrados.
                </p>
                <Button asChild>
                  <Link href="/dashboard/assets/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Primeiro Ativo
                  </Link>
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Símbolo</TableHead>
                    <TableHead>Classe</TableHead>
                    <TableHead>Moeda</TableHead>
                    <TableHead>Preço Manual</TableHead>
                    <TableHead>Conector</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {assets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell className="font-medium">
                        {asset.symbol}
                      </TableCell>
                      <TableCell>
                        <Badge className={getAssetClassColor(asset.class)}>
                          {getAssetClassLabel(asset.class)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {asset.currency}
                      </TableCell>
                      <TableCell>
                        {asset.manual_price ? (
                          <span className="flex items-center">
                            <DollarSign className="h-4 w-4 mr-1" />
                            {asset.manual_price.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">--</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {asset.connector || 'Manual'}
                      </TableCell>
                      <TableCell>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm">
                            Editar
                          </Button>
                          <Button variant="outline" size="sm">
                            Ver Detalhes
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
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