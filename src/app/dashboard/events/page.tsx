"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { LoadingState } from "@/components/ui/loading-state"
import { StatusBadge } from "@/components/ui/status-badge"
import { AssetBadge } from "@/components/ui/asset-badge"
import { DataFilters } from "@/components/ui/data-filters"
import { EventTableRow } from "@/components/dashboard/event-table-row"
import { useDebounce } from "@/hooks/useDebounce"

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
import { Plus, Calendar, TrendingUp, TrendingDown, Trash2, Activity } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

export default function EventsPage() {
  const { user } = useAuth()
  const [events, setEvents] = useState<EventWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterClass, setFilterClass] = useState<'all'|'currency'|'noncurrency'>('all')
  const [filterKind, setFilterKind] = useState<EventWithRelations['kind'] | 'all'>('all')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
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
    let filtered = events
    
    // Busca por texto (usando debounced value)
    if (debouncedSearchTerm) {
      filtered = filtered.filter(event => 
        event.global_assets?.symbol.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        event.accounts?.label.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        event.kind.toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      )
    }
    
    // Filtro por classe de ativo
    const byClassFilter = filtered.filter(e => {
      const sym = e.global_assets?.symbol?.toUpperCase?.()
      const isCash = e.global_assets?.class === 'currency' || sym === 'BRL' || sym === 'CASH'
      if (filterClass === 'all') return true
      return filterClass === 'currency' ? isCash : !isCash
    })
    
    // Filtro por tipo de evento
    const byKindFilter = byClassFilter.filter(e => {
      return filterKind === 'all' ? true : e.kind === filterKind
    })
    
    return byKindFilter.sort((a, b) => new Date(b.tstamp).getTime() - new Date(a.tstamp).getTime())
  }, [events, debouncedSearchTerm, filterClass, filterKind])

  // Contar filtros ativos
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (filterClass !== 'all') count++
    if (filterKind !== 'all') count++
    return count
  }, [filterClass, filterKind])

  // Limpar filtros
  const clearFilters = () => {
    setSearchTerm("")
    setFilterClass('all')
    setFilterKind('all')
  }

  // Opções de filtro
  const filterOptions = [
    {
      key: 'class',
      label: 'Tipo de Ativo',
      value: filterClass,
      onValueChange: (value: string) => setFilterClass(value as any),
      options: [
        { label: 'Todos', value: 'all' },
        { label: 'Dinheiro/Caixa', value: 'currency' },
        { label: 'Investimentos', value: 'noncurrency' },
      ],
    },
    {
      key: 'kind',
      label: 'Tipo de Evento',
      value: filterKind,
      onValueChange: (value: string) => setFilterKind(value as any),
      options: [
        { label: 'Todos', value: 'all' },
        { label: 'Depósito', value: 'deposit' },
        { label: 'Saque', value: 'withdraw' },
        { label: 'Compra', value: 'buy' },
        { label: 'Venda', value: 'sell' },
        { label: 'Transferência', value: 'transfer' },
        { label: 'Avaliação', value: 'valuation' },
      ],
    },
  ]

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
      <DashboardLayout
        title="Eventos"
        description="Histórico de transações financeiras"
        icon={<Activity className="h-6 w-6" />}
        backHref="/dashboard"
        breadcrumbs={[
          { label: "Painel", href: "/dashboard" },
          { label: "Eventos" },
        ]}
      >
        <LoadingState variant="page" message="Carregando eventos..." />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title="Eventos"
      description="Histórico de transações e movimentações financeiras"
      icon={<Activity className="h-6 w-6" />}
      backHref="/dashboard"
      breadcrumbs={[
        { label: "Painel", href: "/dashboard" },
        { label: "Eventos" },
      ]}
      actions={
        <div className="flex items-center gap-2">
          {cashAssetId && (
            <Button asChild variant="secondary">
              <Link href={`/dashboard/events/new?kind=deposit&asset_id=${cashAssetId}`}>
                <Plus className="h-4 w-4 mr-2" /> Depósito
              </Link>
            </Button>
          )}
          <Button asChild>
            <Link href="/dashboard/events/new">
              <Plus className="h-4 w-4 mr-2" /> Novo Evento
            </Link>
          </Button>
        </div>
      }
    >

        {/* Summary cards */}
        <div className="stats-grid mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Eventos</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{events.length}</div>
              <p className="text-xs text-muted-foreground">
                {filteredEvents.length !== events.length && `${filteredEvents.length} filtrados`}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Saldo de Caixa</CardTitle>
              <StatusBadge variant="success" size="sm">Hoje</StatusBadge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {cashToday !== null ? formatBRL(cashToday) : '—'}
              </div>
              <p className="text-xs text-muted-foreground">
                Disponível em caixa
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Valor do Portfólio</CardTitle>
              <StatusBadge variant="info" size="sm">Hoje</StatusBadge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {portfolioToday !== null ? formatBRL(portfolioToday || 0) : '—'}
              </div>
              <p className="text-xs text-muted-foreground">
                Total investido
              </p>
            </CardContent>
          </Card>
        </div>

        <DataFilters
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchPlaceholder="Buscar por ativo, conta ou tipo..."
          filters={filterOptions}
          activeFiltersCount={activeFiltersCount}
          onClearFilters={clearFilters}
          isFilterOpen={isFilterOpen}
          onFilterToggle={() => setIsFilterOpen(!isFilterOpen)}
        />

        <Card>
          <CardHeader>
            <CardTitle>Histórico de Eventos</CardTitle>
            <CardDescription>
              {filteredEvents.length} de {events.length} eventos
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                    <EventTableRow
                      key={event.id}
                      event={event}
                      onDelete={deleteEvent}
                      isDeleting={deletingEventId === event.id}
                      getEventIcon={getEventIcon}
                      getEventLabel={getEventLabel}
                      isCashAsset={isCashAsset}
                      getAssetDisplay={getAssetDisplay}
                      getDisplayPrice={getDisplayPrice}
                      formatBRL={formatBRL}
                    />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
    </DashboardLayout>
  )
} 
