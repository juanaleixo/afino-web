"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { EventWithRelations } from "@/lib/types/events"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { LoadingState } from "@/components/ui/loading-state"
import { StatusBadge } from "@/components/ui/status-badge"
import { EventTableRow } from "@/components/dashboard/event-table-row"
import { useDebounce } from "@/hooks/useDebounce"
import { EventsTimeline } from "@/components/dashboard/events-timeline"
import { AdvancedFilters } from "@/components/dashboard/advanced-filters"
import { useUserContextFromProvider } from '@/contexts/UserContextProvider'
import { formatBRL } from "@/lib/utils/formatters"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { enrichEventsWithAssets } from "@/lib/utils/asset-info-helper"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Plus, Calendar, TrendingUp, TrendingDown, Activity, Info, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

// Using shared type from lib/types/events

export default function EventsPage() {
  const { user } = useAuth()
  const [events, setEvents] = useState<EventWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingEventId, setDeletingEventId] = useState<string | null>(null)
  const [eventToDelete, setEventToDelete] = useState<EventWithRelations | null>(null)
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
  const { userContext } = useUserContextFromProvider()
  const isPremium = userContext.is_premium
  
  // Advanced filters state
  const [advancedFilters, setAdvancedFilters] = useState({
    searchTerm: '',
    kind: 'all' as 'all' | 'deposit' | 'withdraw' | 'buy' | 'position_add' | 'valuation',
    assetClass: 'all' as 'all' | 'currency' | 'noncurrency' | 'stock' | 'crypto' | 'fund' | 'commodity' | 'bond' | 'reit' | 'real_estate' | 'vehicle',
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

      // Enrich events with asset information
      const enrichedEvents = await enrichEventsWithAssets(eventsRes.data || [])
      
      setEvents(enrichedEvents || [])
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
      if (!error && data) setCashAssetId(data.symbol)
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
      case 'position_add':
        return <TrendingUp className="h-4 w-4 text-purple-600" />
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
      case 'position_add':
        return 'Adicionar Posição'
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
  
  // Helper function to get event value (valor do evento)
  const getEventValue = (ev: EventWithRelations) => {
    if (typeof ev.units_delta !== 'number') return null
    
    // Para caixa (BRL), units_delta já é em reais
    const isCash = ev.global_assets?.class === 'currency' || ev.global_assets?.symbol?.toUpperCase() === 'BRL'
    if (isCash) {
      return ev.units_delta
    }
    
    // Para outros ativos, calcular valor = quantidade × preço
    let price = 0
    if (ev.kind === 'buy' || ev.kind === 'position_add') {
      price = ev.price_close || 0
    } else if (ev.kind === 'valuation') {
      price = ev.price_override || 0
    }
    
    if (price > 0) {
      return ev.units_delta * price
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
        { label: 'Adicionar Posição', value: 'position_add' },
        { label: 'Avaliação', value: 'valuation' },
      ],
    },
  ]


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
    if (ev.kind === 'buy' && typeof ev.price_close === 'number') return formatBRL(ev.price_close)
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
        const { data: assets, error: e2 } = await supabase.from('global_assets').select('symbol').in('class', ['currency','cash'])
        if (e2) console.warn('global_assets error', e2)
        const currencySymbols = (assets || []).map(a => a.symbol)
        if (currencySymbols.length === 0) {
          setCashToday(0)
          return
        }

        // Buscar última data com posições de caixa até hoje
        const { data: lastRow, error: eLast } = await supabase
          .from('daily_positions_acct')
          .select('date')
          .eq('user_id', user.id)
          .lte('date', today)
          .in('asset_symbol', currencySymbols)
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
          .in('asset_symbol', currencySymbols)
        if (e3) console.warn('daily_positions select error', e3)
        const cash = (dpa || []).reduce((sum, row: any) => sum + (row.value || 0), 0)
        setCashToday(cash)
      } catch (err) {
        console.warn('summary error', err)
      }
    }
    loadSummary()
  }, [user?.id])

  const openDeleteConfirmation = (eventId: string) => {
    const event = events.find(e => e.id === eventId)
    if (event) {
      setEventToDelete(event)
    }
  }

  const confirmDelete = async () => {
    if (!user || !eventToDelete) return

    try {
      setDeletingEventId(eventToDelete.id)
      
      const { error } = await supabase
        .from('events')
        .delete()
        .eq('id', eventToDelete.id)
        .eq('user_id', user.id)

      if (error) throw error
      
      // Atualização otimista: remover do estado imediatamente
      setEvents(prev => prev.filter(e => e.id !== eventToDelete.id))
      
      toast.success('Evento excluído com sucesso!')
      
      // Fechar modal
      setEventToDelete(null)
      
      // Recarregar a lista para garantir consistência e atualizar contadores
      await loadEvents()
    } catch (error) {
      console.error('Erro ao excluir evento:', error)
      toast.error('Erro ao excluir evento')
      // Em caso de erro, recarregar para restaurar estado correto
      loadEvents()
    } finally {
      setDeletingEventId(null)
    }
  }

  const cancelDelete = () => {
    setEventToDelete(null)
  }

  // Função mantida para compatibilidade com componentes existentes
  const deleteEvent = openDeleteConfirmation

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
              <div className="text-2xl font-bold">{filteredEvents.length}</div>
              <p className="text-xs text-muted-foreground">
                {filteredEvents.length !== events.length ? `${filteredEvents.length} de ${events.length} eventos` : 'Total de eventos'}
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
                    <TableHead>
                      <div className="flex items-center gap-1">
                        Valor do Evento
                        <div className="group relative">
                          <Info className="h-3 w-3 text-muted-foreground cursor-help" />
                          <div className="absolute bottom-full left-0 mb-2 hidden group-hover:block z-10">
                            <div className="bg-popover text-popover-foreground text-xs rounded-md p-2 shadow-md border max-w-48">
                              <strong>Cálculo:</strong><br/>
                              💰 Caixa (BRL): Valor direto<br/>
                              📈 Outros ativos: Quantidade × Preço<br/>
                              ✅ Verde: Valores positivos<br/>
                              🔴 Vermelho: Valores negativos
                            </div>
                          </div>
                        </div>
                      </div>
                    </TableHead>
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
                    />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        {/* Modal de confirmação de exclusão */}
        <Dialog open={!!eventToDelete} onOpenChange={cancelDelete}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                Confirmar Exclusão
              </DialogTitle>
              <DialogDescription>
                Esta ação não pode ser desfeita. O evento será permanentemente removido do seu histórico.
              </DialogDescription>
            </DialogHeader>
            
            {eventToDelete && (
              <div className="py-4">
                <div className="bg-muted p-4 rounded-lg space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {eventToDelete.kind === 'buy' ? 'Compra' :
                       eventToDelete.kind === 'deposit' ? 'Depósito' :
                       eventToDelete.kind === 'withdraw' ? 'Saque' :
                       eventToDelete.kind === 'position_add' ? 'Adicionar Posição' :
                       'Avaliação'}
                    </Badge>
                    <span className="font-medium">{eventToDelete.global_assets?.symbol}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(eventToDelete.tstamp).toLocaleString('pt-BR')}
                  </div>
                  {eventToDelete.accounts && (
                    <div className="text-sm">
                      Conta: {eventToDelete.accounts.label}
                    </div>
                  )}
                </div>
                
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-yellow-600 mt-0.5" />
                    <div className="text-sm text-yellow-800">
                      <strong>Impacto:</strong> Os saldos e contadores serão recalculados automaticamente após a exclusão.
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <DialogFooter>
              <Button variant="outline" onClick={cancelDelete} disabled={!!deletingEventId}>
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={confirmDelete}
                disabled={!!deletingEventId}
              >
                {deletingEventId ? 'Excluindo...' : 'Excluir Evento'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    </DashboardLayout>
  )
} 
