"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"

interface EventWithRelations {
  id: string
  user_id: string
  asset_id: string
  account_id?: string
  tstamp: string
  kind: 'deposit' | 'withdraw' | 'buy' | 'sell' | 'transfer' | 'valuation'
  units_delta?: number
  price_override?: number
  price_close?: number
  global_assets?: {
    symbol: string
    class: string
  }
  accounts?: {
    label: string
  }
}
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Calendar, TrendingUp, TrendingDown, Loader2, ArrowLeft, Trash2, Filter, Shuffle } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

export default function EventsPage() {
  const { user } = useAuth()
  const [events, setEvents] = useState<EventWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null)
  const [filterClass, setFilterClass] = useState<'all'|'currency'|'noncurrency'>('all')
  const [filterKind, setFilterKind] = useState<EventWithRelations['kind'] | 'all'>('all')
  const [cashAssetId, setCashAssetId] = useState<string | null>(null)
  const [cashToday, setCashToday] = useState<number | null>(null)
  const [portfolioToday, setPortfolioToday] = useState<number | null>(null)

  const loadEvents = useCallback(async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('events')
        .select(`
          *,
          global_assets(symbol, class),
          accounts(label)
        `)
        .eq('user_id', user.id)
        .order('tstamp', { ascending: false })
        .limit(100)

      if (error) throw error
      setEvents(data || [])
    } catch (error) {
      console.error('Erro ao carregar eventos:', error)
      toast.error('Erro ao carregar eventos')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadEvents()
  }, [loadEvents])

  // Load one currency asset to enable quick cash action
  useEffect(() => {
    const loadCash = async () => {
      if (!user) return
      const { data, error } = await supabase
        .from('global_assets')
        .select('id, class, symbol')
        .eq('class', 'currency')
        .order('symbol', { ascending: true })
        .limit(1)
        .maybeSingle()
      if (!error && data) setCashAssetId(data.id)
    }
    loadCash()
  }, [user?.id])

  const getEventIcon = (kind: string) => {
    switch (kind) {
      case 'deposit':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'withdraw':
        return <TrendingDown className="h-4 w-4 text-red-600" />
      case 'buy':
        return <TrendingUp className="h-4 w-4 text-green-600" />
      case 'sell':
        return <TrendingDown className="h-4 w-4 text-red-600" />
      case 'transfer':
        return <TrendingUp className="h-4 w-4 text-blue-600" />
      case 'valuation':
        return <Calendar className="h-4 w-4 text-purple-600" />
      default:
        return <Calendar className="h-4 w-4" />
    }
  }

  const getEventLabel = (kind: string) => {
    switch (kind) {
      case 'deposit':
        return 'Depósito'
      case 'withdraw':
        return 'Saque'
      case 'buy':
        return 'Compra'
      case 'sell':
        return 'Venda'
      case 'transfer':
        return 'Transferência'
      case 'valuation':
        return 'Avaliação'
      default:
        return kind
    }
  }

  const filteredEvents = useMemo(() => {
    return events.filter(e => {
      const sym = e.global_assets?.symbol?.toUpperCase?.()
      const isCash = e.global_assets?.class === 'currency' || sym === 'BRL' || sym === 'CASH'
      const byClass = filterClass === 'all' ? true : (filterClass === 'currency' ? isCash : !isCash)
      const byKind = filterKind === 'all' ? true : e.kind === filterKind
      return byClass && byKind
    })
  }, [events, filterClass, filterKind])

  const formatBRL = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)

  const isCashAsset = (ev: EventWithRelations) => {
    const sym = ev.global_assets?.symbol?.toUpperCase?.()
    return ev.global_assets?.class === 'currency' || sym === 'BRL' || sym === 'CASH'
  }

  const getAssetDisplay = (ev: EventWithRelations) => {
    if (isCashAsset(ev)) {
      const sym = ev.global_assets?.symbol?.toUpperCase?.()
      return sym && sym !== 'BRL' ? `Caixa (${sym})` : 'Caixa (BRL)'
    }
    return ev.global_assets?.symbol || '—'
  }

  const getDisplayPrice = (ev: EventWithRelations) => {
    if (isCashAsset(ev)) return formatBRL(1)
    if ((ev.kind === 'buy' || ev.kind === 'sell') && typeof ev.price_close === 'number') return formatBRL(ev.price_close)
    if (ev.kind === 'valuation' && typeof ev.price_override === 'number') return formatBRL(ev.price_override)
    return '—'
  }

  // Load summary: cash balance today and portfolio total today
  useEffect(() => {
    const loadSummary = async () => {
      if (!user) return
      try {
        const today = new Date().toISOString().slice(0,10)
        // portfolio total via RPC (RLS-safe)
        const [{ data: pd, error: e1 }, { data: assets, error: e2 }] = await Promise.all([
          supabase.rpc('api_portfolio_daily', { p_from: today, p_to: today }),
          supabase.from('global_assets').select('id').eq('class','currency')
        ])
        if (e1) console.warn('api_portfolio_daily error', e1)
        if (e2) console.warn('global_assets error', e2)
        setPortfolioToday(pd?.[0]?.total_value ?? 0)
        const currencyIds = (assets || []).map(a => a.id)
        if (currencyIds.length > 0) {
          const { data: dpa, error: e3 } = await supabase
            .from('daily_positions_acct')
            .select('value, asset_id, date')
            .eq('user_id', user.id)
            .eq('date', today)
            .eq('is_final', true)
            .in('asset_id', currencyIds)
          if (e3) console.warn('daily_positions select error', e3)
          const cash = (dpa || []).reduce((sum, row: any) => sum + (row.value || 0), 0)
          setCashToday(cash)
        } else {
          setCashToday(0)
        }
      } catch (err) {
        console.warn('summary error', err)
      }
    }
    loadSummary()
  }, [user?.id])

  const deleteEvent = async (eventId: string) => {
    if (!user || !confirm('Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita.')) return

    try {
      setDeletingEventId(eventId)
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId)
        .eq('user_id', user.id)

      if (error) throw error
      
      toast.success('Evento excluído com sucesso!')
      loadEvents() // Recarregar a lista
    } catch (error) {
      console.error('Erro ao excluir evento:', error)
      toast.error('Erro ao excluir evento')
    } finally {
      setDeletingEventId(null)
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span>Carregando eventos...</span>
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
                <nav aria-label="Trilha de navegação" className="text-sm text-muted-foreground">
                  <ol className="flex items-center gap-1">
                    <li>
                      <Link href="/dashboard" className="hover:text-foreground">Painel</Link>
                    </li>
                    <li className="mx-1">/</li>
                    <li className="text-foreground flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      <span className="text-base font-semibold">Eventos</span>
                    </li>
                  </ol>
                </nav>
              </div>
              <div className="flex items-center gap-2">
                {cashAssetId && (
                  <Button asChild variant="secondary">
                    <Link href={`/dashboard/events/new?kind=deposit&asset_id=${cashAssetId}`}>
                      <Plus className="h-4 w-4 mr-2" /> Depósito em Caixa
                    </Link>
                  </Button>
                )}
                <Button asChild>
                  <Link href="/dashboard/events/new">
                    <Plus className="h-4 w-4 mr-2" /> Novo Evento
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">

          <Card>
          <CardHeader>
            <CardTitle>Histórico de Eventos</CardTitle>
            <CardDescription>
              Todos os eventos e transações da sua carteira
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Summary cards */}
            <div className="grid gap-4 md:grid-cols-2 mb-4">
              <div className="rounded-lg border p-4">
                <div className="text-sm text-muted-foreground">Saldo de Caixa (hoje)</div>
                <div className="text-2xl font-semibold">{cashToday !== null ? formatBRL(cashToday) : '—'}</div>
              </div>
              <div className="rounded-lg border p-4">
                <div className="text-sm text-muted-foreground">Valor do Portfólio (hoje)</div>
                <div className="text-2xl font-semibold">{portfolioToday !== null ? formatBRL(portfolioToday || 0) : '—'}</div>
              </div>
            </div>
            {/* Filtros */}
            <div className="flex items-center justify-between gap-2 mb-4">
              <div className="flex items-center gap-2">
                <Button variant={filterClass==='all'?'default':'outline'} size="sm" onClick={()=>setFilterClass('all')}>Todos</Button>
                <Button variant={filterClass==='currency'?'default':'outline'} size="sm" onClick={()=>setFilterClass('currency')}>Caixa</Button>
                <Button variant={filterClass==='noncurrency'?'default':'outline'} size="sm" onClick={()=>setFilterClass('noncurrency')}>Ativos</Button>
              </div>
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <select
                  className="h-9 rounded-md border px-2 text-sm bg-background"
                  value={filterKind}
                  onChange={(e)=>setFilterKind(e.target.value as any)}
                >
                  <option value="all">Todos os tipos</option>
                  <option value="deposit">Depósito</option>
                  <option value="withdraw">Saque</option>
                  <option value="buy">Compra</option>
                  <option value="sell">Venda</option>
                  <option value="transfer">Transferência</option>
                  <option value="valuation">Avaliação</option>
                </select>
              </div>
            </div>
            {events.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Nenhum evento encontrado</h3>
                <p className="text-muted-foreground mb-4">
                  Você ainda não tem eventos registrados.
                </p>
                <Button asChild>
                  <Link href="/dashboard/events/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Primeiro Evento
                  </Link>
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead>Conta</TableHead>
                    <TableHead>Quantidade</TableHead>
                    <TableHead>Preço/Val.</TableHead>
                    <TableHead>Valor do Evento</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredEvents.map((event) => (
                    <TableRow key={event.id}>
                      <TableCell>
                        {new Date(event.tstamp).toLocaleDateString('pt-BR')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          {getEventIcon(event.kind)}
                          <Badge variant="outline">
                            {getEventLabel(event.kind)}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{getAssetDisplay(event)}</span>
                          {isCashAsset(event) && (
                            <Badge variant="secondary">Caixa</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {event.accounts?.label || 'N/D'}
                      </TableCell>
                      <TableCell>
                        {event.units_delta ? (
                          <span className={event.units_delta > 0 ? 'text-green-600' : 'text-red-600'}>
                            {event.units_delta > 0 ? '+' : ''}{event.units_delta}
                          </span>
                        ) : 'N/D'}
                      </TableCell>
                      <TableCell>
                        {getDisplayPrice(event)}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          if (isCashAsset(event) && typeof event.units_delta === 'number') {
                            const val = event.units_delta
                            return (
                              <span className={val >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {formatBRL(val)}
                              </span>
                            )
                          }
                          if ((event.kind === 'buy' || event.kind === 'sell') && typeof event.units_delta === 'number' && typeof event.price_close === 'number') {
                            const val = event.units_delta * event.price_close
                            return (
                              <span className={val >= 0 ? 'text-green-600' : 'text-red-600'}>
                                {formatBRL(val)}
                              </span>
                            )
                          }
                          return '—'
                        })()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteEvent(event.id)}
                          disabled={deletingEventId === event.id}
                        >
                          {deletingEventId === event.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4 text-red-600" />
                          )}
                        </Button>
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
