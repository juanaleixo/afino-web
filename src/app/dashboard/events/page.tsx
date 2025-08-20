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
import { EventsTimeline } from "@/components/dashboard/events-timeline"
import { AdvancedFilters } from "@/components/dashboard/advanced-filters"
import { useUserPlan } from "@/hooks/useUserPlan"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Plus, Calendar, TrendingUp, TrendingDown, Trash2, Activity } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

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
  const [viewMode, setViewMode] = useState<'timeline' | 'table'>('timeline')
  const [accounts, setAccounts] = useState<Array<{ id: string; label: string }>>([])
  const { isPremium } = useUserPlan()
  
  // Advanced filters state
  const [advancedFilters, setAdvancedFilters] = useState({
    searchTerm: '',
    kind: 'all' as 'all' | 'deposit' | 'withdraw' | 'buy' | 'sell' | 'transfer' | 'valuation',
    assetClass: 'all' as 'all' | 'currency' | 'noncurrency' | 'stock' | 'crypto' | 'fund',
    account: 'all' as string,
    dateFrom: null as Date | null,
    dateTo: null as Date | null,
    amountRange: 'all' as 'all' | 'small' | 'medium' | 'large',
    sortBy: 'date' as 'date' | 'amount' | 'asset',
    sortOrder: 'desc' as 'asc' | 'desc',
    showOnlyPositive: false,
    showOnlyNegative: false
  })

  const loadEvents = useCallback(async () => {
    if (!user) return

    try {
      const [eventsRes, accountsRes] = await Promise.all([
        supabase
          .from('events')
          .select(`
            *,
            global_assets(symbol, class),
            accounts(label)
          `)
          .eq('user_id', user.id)
          .order('tstamp', { ascending: false })
          .limit(200),
        supabase
          .from('accounts')
          .select('id, label')
          .eq('user_id', user.id)
      ])

      if (eventsRes.error) throw eventsRes.error
      if (accountsRes.error) console.warn('Erro ao carregar contas:', accountsRes.error)
      
      setEvents(eventsRes.data || [])
      setAccounts(accountsRes.data || [])
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
        .in('class', ['currency','cash'])
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
    
    // Use advanced filters if available
    const searchTerm = advancedFilters.searchTerm || debouncedSearchTerm
    const kind = advancedFilters.kind !== 'all' ? advancedFilters.kind : filterKind
    const assetClass = advancedFilters.assetClass !== 'all' ? advancedFilters.assetClass : filterClass
    
    // Text search
    if (searchTerm) {
      filtered = filtered.filter(event => 
        event.global_assets?.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.accounts?.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.kind.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    // Asset class filter
    if (assetClass !== 'all') {
      filtered = filtered.filter(e => {
        const sym = e.global_assets?.symbol?.toUpperCase?.()
        const isCash = e.global_assets?.class === 'currency' || e.global_assets?.class === 'cash' || sym === 'BRL' || sym === 'CASH'
        
        if (assetClass === 'currency') return isCash
        if (assetClass === 'noncurrency') return !isCash
        return e.global_assets?.class === assetClass
      })
    }
    
    // Event kind filter
    if (kind !== 'all') {
      filtered = filtered.filter(e => e.kind === kind)
    }
    
    // Premium filters (only if user is premium)
    if (isPremium) {
      // Account filter
      if (advancedFilters.account !== 'all') {
        filtered = filtered.filter(e => e.account_id === advancedFilters.account)
      }
      
      // Date range filter
      if (advancedFilters.dateFrom) {
        filtered = filtered.filter(e => new Date(e.tstamp) >= advancedFilters.dateFrom!)
      }
      if (advancedFilters.dateTo) {
        const endDate = new Date(advancedFilters.dateTo)
        endDate.setHours(23, 59, 59, 999)
        filtered = filtered.filter(e => new Date(e.tstamp) <= endDate)
      }
      
      // Amount range filter
      if (advancedFilters.amountRange !== 'all') {
        filtered = filtered.filter(e => {
          const value = getEventValue(e)
          if (value === null) return true
          
          const absValue = Math.abs(value)
          switch (advancedFilters.amountRange) {
            case 'small': return absValue <= 1000
            case 'medium': return absValue > 1000 && absValue <= 10000
            case 'large': return absValue > 10000
            default: return true
          }
        })
      }
      
      // Value direction filters
      if (advancedFilters.showOnlyPositive) {
        filtered = filtered.filter(e => {
          const value = getEventValue(e)
          return value !== null && value > 0
        })
      }
      if (advancedFilters.showOnlyNegative) {
        filtered = filtered.filter(e => {
          const value = getEventValue(e)
          return value !== null && value < 0
        })
      }
    }
    
    // Sorting
    const sortBy = advancedFilters.sortBy
    const sortOrder = advancedFilters.sortOrder
    
    return filtered.sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'date':
          comparison = new Date(a.tstamp).getTime() - new Date(b.tstamp).getTime()
          break
        case 'amount':
          const valueA = getEventValue(a) || 0
          const valueB = getEventValue(b) || 0
          comparison = Math.abs(valueA) - Math.abs(valueB)
          break
        case 'asset':
          const assetA = a.global_assets?.symbol || ''
          const assetB = b.global_assets?.symbol || ''
          comparison = assetA.localeCompare(assetB)
          break
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })
  }, [events, debouncedSearchTerm, filterClass, filterKind, advancedFilters, isPremium])
  
  // Helper function to get event value
  const getEventValue = (ev: EventWithRelations) => {
    const isCash = ev.global_assets?.class === 'currency' || ev.global_assets?.symbol?.toUpperCase() === 'BRL'
    if (isCash && typeof ev.units_delta === 'number') {
      return ev.units_delta
    }
    if ((ev.kind === 'buy' || ev.kind === 'sell') && typeof ev.units_delta === 'number' && typeof ev.price_close === 'number') {
      return ev.units_delta * ev.price_close
    }
    return null
  }

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
    return ev.global_assets?.class === 'currency' || ev.global_assets?.class === 'cash' || sym === 'BRL' || sym === 'CASH'
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
        const sevenDaysAgo = new Date(Date.now() - 7*24*60*60*1000).toISOString().slice(0,10)

        // 1) Portfólio total: pegar último valor disponível nos últimos 7 dias
        const { data: pd, error: e1 } = await supabase.rpc('api_portfolio_daily', { p_from: sevenDaysAgo, p_to: today })
        if (e1) console.warn('api_portfolio_daily error', e1)
        const lastPortfolio = (pd || []).sort((a:any,b:any)=> (a.date || a.d || '').localeCompare(b.date || b.d || '')).pop()
        setPortfolioToday(lastPortfolio?.total_value ?? 0)

        // 2) Caixa: considerar classes 'currency' e 'cash' e usar a última data disponível ≤ hoje
        const { data: assets, error: e2 } = await supabase.from('global_assets').select('id').in('class', ['currency','cash'])
        if (e2) console.warn('global_assets error', e2)
        const currencyIds = (assets || []).map(a => a.id)
        if (currencyIds.length === 0) {
          setCashToday(0)
          return
        }

        // Buscar última data com posições de caixa até hoje
        const { data: lastRow, error: eLast } = await supabase
          .from('daily_positions_acct')
          .select('date')
          .eq('user_id', user.id)
          .lte('date', today)
          .in('asset_id', currencyIds)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (eLast) console.warn('last cash date error', eLast)
        const lastDate = lastRow?.date
        if (!lastDate) { setCashToday(0); return }

        const { data: dpa, error: e3 } = await supabase
          .from('daily_positions_acct')
          .select('value')
          .eq('user_id', user.id)
          .eq('date', lastDate)
          .eq('is_final', true)
          .in('asset_id', currencyIds)
        if (e3) console.warn('daily_positions select error', e3)
        const cash = (dpa || []).reduce((sum, row: any) => sum + (row.value || 0), 0)
        setCashToday(cash)
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
          <div className="flex items-center border border-border rounded-lg p-1 bg-muted/50">
            <Button
              variant={viewMode === 'timeline' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('timeline')}
            >
              Timeline
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('table')}
            >
              Tabela
            </Button>
          </div>
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

        <AdvancedFilters
          events={events}
          filters={advancedFilters}
          onFiltersChange={(newFilters) => setAdvancedFilters(prev => ({ ...prev, ...newFilters }))}
          onReset={() => setAdvancedFilters({
            searchTerm: '',
            kind: 'all',
            assetClass: 'all',
            account: 'all',
            dateFrom: null,
            dateTo: null,
            amountRange: 'all',
            sortBy: 'date',
            sortOrder: 'desc',
            showOnlyPositive: false,
            showOnlyNegative: false
          })}
          isPremium={isPremium}
          accounts={accounts}
        />

        {events.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
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
            </CardContent>
          </Card>
        ) : viewMode === 'timeline' ? (
          <EventsTimeline
            events={filteredEvents}
            onDeleteEvent={deleteEvent}
            deletingEventId={deletingEventId}
            formatBRL={formatBRL}
            isPremium={isPremium}
          />
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Eventos</CardTitle>
              <CardDescription>
                {filteredEvents.length} de {events.length} eventos
              </CardDescription>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        )}
    </DashboardLayout>
  )
} 
