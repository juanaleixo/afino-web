"use client"

import * as React from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { StatusBadge } from "@/components/ui/status-badge"
import { AssetBadge } from "@/components/ui/asset-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Plus,
  MoreVertical,
  Calendar,
  DollarSign,
  TrendingUp,
  ArrowUpCircle,
  ArrowDownCircle,
  ShoppingCart,
  Edit3,
  Home,
  Trash2,
  Filter
} from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"
import { getAssetDisplayLabel } from "@/lib/utils/assets"
import { formatCurrency, formatDate } from "@/lib/utils/format"

interface TransactionEvent {
  id: string
  user_id: string
  asset_symbol?: string
  asset_id?: string
  account_id?: string
  kind: string
  units_delta?: number
  price_override?: number
  price_close?: number
  tstamp: string
  created_at: string
  global_assets?: {
    symbol: string
    class: string
    label_ptbr?: string
  }
  custom_assets?: {
    id: string
    label: string
    class: string
  }
  accounts?: {
    label: string
  }
}

const eventTypeLabels: Record<string, { label: string; icon: React.ComponentType<any>; color: string }> = {
  'deposit': { label: 'Entrada', icon: ArrowDownCircle, color: 'text-green-600' },
  'withdraw': { label: 'Saída', icon: ArrowUpCircle, color: 'text-red-600' },
  'buy': { label: 'Compra', icon: ShoppingCart, color: 'text-blue-600' },
  'position_add': { label: 'Posição', icon: Home, color: 'text-purple-600' },
  'valuation': { label: 'Avaliação', icon: DollarSign, color: 'text-yellow-600' },
}

export default function TransactionsPage() {
  const { user } = useAuth()
  const [transactions, setTransactions] = React.useState<TransactionEvent[]>([])
  const [loading, setLoading] = React.useState(true)
  const [deleting, setDeleting] = React.useState<string | null>(null)

  const loadTransactions = React.useCallback(async () => {
    if (!user?.id) return

    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          global_assets (symbol, class, label_ptbr),
          custom_assets (id, label, class),
          accounts (label)
        `)
        .eq('user_id', user.id)
        .order('tstamp', { ascending: false })
        .limit(100)

      if (error) throw error

      setTransactions(data || [])
    } catch (error) {
      console.error('Erro ao carregar transações:', error)
      toast.error('Erro ao carregar transações')
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  React.useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  const handleDeleteTransaction = async (transactionId: string) => {
    if (!confirm('Tem certeza que deseja deletar esta transação?')) return

    try {
      setDeleting(transactionId)
      
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', transactionId)
        .eq('user_id', user?.id)

      if (error) throw error

      toast.success('Transação deletada com sucesso')
      loadTransactions()
    } catch (error) {
      console.error('Erro ao deletar transação:', error)
      toast.error('Erro ao deletar transação')
    } finally {
      setDeleting(null)
    }
  }

  const getAssetInfo = (transaction: TransactionEvent) => {
    if (transaction.global_assets) {
      return {
        symbol: transaction.global_assets.symbol,
        label: transaction.global_assets.label_ptbr || transaction.global_assets.symbol,
        class: transaction.global_assets.class,
        isCustom: false
      }
    } else if (transaction.custom_assets) {
      return {
        symbol: transaction.custom_assets.label,
        label: transaction.custom_assets.label,
        class: transaction.custom_assets.class,
        isCustom: true
      }
    } else {
      return {
        symbol: transaction.asset_symbol || transaction.asset_id || 'N/A',
        label: transaction.asset_symbol || transaction.asset_id || 'N/A',
        class: 'stock',
        isCustom: false
      }
    }
  }

  const formatValue = (transaction: TransactionEvent) => {
    if (transaction.units_delta !== null && transaction.units_delta !== undefined) {
      return formatCurrency(Math.abs(transaction.units_delta))
    } else if (transaction.price_override) {
      return formatCurrency(transaction.price_override)
    } else if (transaction.price_close) {
      return formatCurrency(transaction.price_close)
    }
    return '-'
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="container mx-auto px-4 py-6 max-w-7xl">
          <LoadingState message="Carregando transações..." />
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Transações</h1>
            <p className="text-muted-foreground">
              Histórico de movimentações do seu portfólio
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>
            <Link href="/dashboard/patrimony/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Transação
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Transações</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{transactions.length}</div>
              <p className="text-xs text-muted-foreground">
                Últimos 100 registros
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Este Mês</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {transactions.filter(t => {
                  const transactionDate = new Date(t.tstamp)
                  const now = new Date()
                  return transactionDate.getMonth() === now.getMonth() && 
                         transactionDate.getFullYear() === now.getFullYear()
                }).length}
              </div>
              <p className="text-xs text-muted-foreground">
                Transações registradas
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Compras</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {transactions.filter(t => t.kind === 'buy').length}
              </div>
              <p className="text-xs text-muted-foreground">
                Aquisições de ativos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor Movimentado</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(
                  transactions.reduce((sum, t) => {
                    const value = Math.abs(t.units_delta || 0) * (t.price_close || 1)
                    return sum + (isNaN(value) ? 0 : value)
                  }, 0)
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Volume total
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Transactions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Transações</CardTitle>
            <CardDescription>
              Lista completa das suas movimentações financeiras
            </CardDescription>
          </CardHeader>
          <CardContent>
            {transactions.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-muted-foreground mb-4">
                  <TrendingUp className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium">Nenhuma transação encontrada</h3>
                  <p>Comece registrando sua primeira movimentação</p>
                </div>
                <Link href="/dashboard/patrimony/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeira Transação
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Ativo</TableHead>
                      <TableHead>Conta</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((transaction) => {
                      const assetInfo = getAssetInfo(transaction)
                      const eventType = eventTypeLabels[transaction.kind] || eventTypeLabels['position_add']
                      const IconComponent = eventType?.icon || eventTypeLabels['position_add']?.icon || ArrowDownCircle

                      return (
                        <TableRow key={transaction.id}>
                          <TableCell>
                            <div className="text-sm">
                              {formatDate(transaction.tstamp)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {new Date(transaction.tstamp).toLocaleTimeString('pt-BR', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <IconComponent className={`h-4 w-4 ${eventType?.color || eventTypeLabels['position_add']?.color || 'text-gray-600'}`} />
                              <StatusBadge variant="neutral" size="sm">
                                {eventType?.label || eventTypeLabels['position_add']?.label || 'N/A'}
                              </StatusBadge>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <AssetBadge assetClass={assetInfo.class as any} size="sm" showLabel={false} />
                              <div>
                                <div className="font-medium">{assetInfo.label}</div>
                                {assetInfo.isCustom && (
                                  <Badge variant="outline" className="text-xs">
                                    PERSONALIZADO
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {transaction.accounts?.label || 'Sem conta'}
                          </TableCell>
                          <TableCell>
                            <div className="font-medium">
                              {formatValue(transaction)}
                            </div>
                            {transaction.price_close && transaction.units_delta && (
                              <div className="text-xs text-muted-foreground">
                                {Math.abs(transaction.units_delta).toFixed(4)} x {formatCurrency(transaction.price_close)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                  <MoreVertical className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem>
                                  <Edit3 className="h-4 w-4 mr-2" />
                                  Editar
                                </DropdownMenuItem>
                                <DropdownMenuItem 
                                  className="text-red-600"
                                  onClick={() => handleDeleteTransaction(transaction.id)}
                                  disabled={deleting === transaction.id}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  {deleting === transaction.id ? 'Deletando...' : 'Deletar'}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ProtectedRoute>
  )
}