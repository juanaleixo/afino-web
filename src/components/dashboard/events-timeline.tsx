"use client"

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { StatusBadge } from "@/components/ui/status-badge"
import { AssetBadge } from "@/components/ui/asset-badge"
import { Button } from "@/components/ui/button"
import { 
  Calendar, 
  TrendingUp, 
  TrendingDown, 
  Trash2, 
  Clock,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Filter
} from "lucide-react"
import { format, isToday, isThisWeek, isThisMonth, parseISO, differenceInDays } from "date-fns"
import { ptBR } from "date-fns/locale"

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

interface EventsTimelineProps {
  events: EventWithRelations[]
  onDeleteEvent: (eventId: string) => void
  deletingEventId: string | null
  formatBRL: (value: number) => string
  isPremium: boolean
}

interface TimelineGroupProps {
  title: string
  events: EventWithRelations[]
  isExpanded: boolean
  onToggle: () => void
  onDeleteEvent: (eventId: string) => void
  deletingEventId: string | null
  formatBRL: (value: number) => string
  isPremium: boolean
}

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
      return <ArrowRight className="h-4 w-4 text-blue-600" />
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

const getDisplayPrice = (ev: EventWithRelations, formatBRL: (n: number) => string) => {
  if (isCashAsset(ev)) return formatBRL(1)
  if ((ev.kind === 'buy' || ev.kind === 'sell') && typeof ev.price_close === 'number') return formatBRL(ev.price_close)
  if (ev.kind === 'valuation' && typeof ev.price_override === 'number') return formatBRL(ev.price_override)
  return '—'
}

const getEventValue = (ev: EventWithRelations) => {
  if (isCashAsset(ev) && typeof ev.units_delta === 'number') {
    return ev.units_delta
  }
  if ((ev.kind === 'buy' || ev.kind === 'sell') && typeof ev.units_delta === 'number' && typeof ev.price_close === 'number') {
    return ev.units_delta * ev.price_close
  }
  return null
}

const getRelativeTime = (dateString: string) => {
  const date = parseISO(dateString)
  const days = differenceInDays(new Date(), date)
  
  if (isToday(date)) return 'Hoje'
  if (days === 1) return 'Ontem'
  if (days <= 7) return `${days} dias atrás`
  if (days <= 30) return `${Math.floor(days / 7)} semanas atrás`
  if (days <= 365) return `${Math.floor(days / 30)} meses atrás`
  return `${Math.floor(days / 365)} anos atrás`
}

const TimelineEvent: React.FC<{
  event: EventWithRelations
  onDelete: (eventId: string) => void
  isDeleting: boolean
  formatBRL: (value: number) => string
  showAccountDetails: boolean
}> = ({ event, onDelete, isDeleting, formatBRL, showAccountDetails }) => {
  const eventValue = getEventValue(event)
  
  return (
    <div className="relative flex items-start space-x-4 p-4 hover:bg-muted/50 transition-colors rounded-lg group">
      {/* Timeline line */}
      <div className="absolute left-8 top-16 bottom-0 w-px bg-border"></div>
      
      {/* Event icon */}
      <div className="relative z-10 flex h-8 w-8 items-center justify-center rounded-full bg-background border-2 border-border">
        {getEventIcon(event.kind)}
      </div>
      
      {/* Event content */}
      <div className="flex-1 min-w-0 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusBadge 
              variant={
                event.kind === 'buy' || event.kind === 'deposit' ? 'success' :
                event.kind === 'sell' || event.kind === 'withdraw' ? 'error' :
                event.kind === 'transfer' ? 'info' : 'neutral'
              }
              size="sm"
            >
              {getEventLabel(event.kind)}
            </StatusBadge>
            <div className="flex items-center gap-2">
              <AssetBadge 
                assetClass={isCashAsset(event) ? 'currency' : (event.global_assets?.class as any || 'default')}
                size="sm"
              />
              <span className="font-medium">{getAssetDisplay(event)}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {getRelativeTime(event.tstamp)}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(event.id)}
              disabled={isDeleting}
              className="opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Data:</span>
            <div className="font-medium">
              {format(parseISO(event.tstamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </div>
          </div>
          
          {showAccountDetails && (
            <div>
              <span className="text-muted-foreground">Conta:</span>
              <div className="font-medium">{event.accounts?.label || 'N/D'}</div>
            </div>
          )}
          
          {event.units_delta && (
            <div>
              <span className="text-muted-foreground">Quantidade:</span>
              <StatusBadge 
                variant={event.units_delta > 0 ? 'success' : 'error'}
                size="sm"
              >
                {event.units_delta > 0 ? '+' : ''}{event.units_delta}
              </StatusBadge>
            </div>
          )}
          
          <div>
            <span className="text-muted-foreground">Preço:</span>
            <div className="font-medium">{getDisplayPrice(event, formatBRL)}</div>
          </div>
        </div>
        
        {eventValue !== null && (
          <div className="pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-sm">Valor do evento:</span>
              <StatusBadge 
                variant={eventValue >= 0 ? 'success' : 'error'}
                size="sm"
              >
                {formatBRL(eventValue)}
              </StatusBadge>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const TimelineGroup: React.FC<TimelineGroupProps> = ({
  title,
  events,
  isExpanded,
  onToggle,
  onDeleteEvent,
  deletingEventId,
  formatBRL,
  isPremium
}) => {
  const totalValue = events.reduce((sum, event) => {
    const value = getEventValue(event)
    return sum + (value || 0)
  }, 0)
  
  return (
    <Card className="mb-4">
      <CardHeader 
        className="cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
            <CardTitle className="text-lg">{title}</CardTitle>
            <Badge variant="secondary" className="ml-2">
              {events.length} eventos
            </Badge>
          </div>
          
          {totalValue !== 0 && (
            <StatusBadge 
              variant={totalValue >= 0 ? 'success' : 'error'}
              size="sm"
            >
              {formatBRL(totalValue)}
            </StatusBadge>
          )}
        </div>
      </CardHeader>
      
      {isExpanded && (
        <CardContent className="pt-0">
          <div className="space-y-0">
            {events.map((event, index) => (
              <div key={event.id} className={index === events.length - 1 ? '' : 'border-b border-border/30'}>
                <TimelineEvent
                  event={event}
                  onDelete={onDeleteEvent}
                  isDeleting={deletingEventId === event.id}
                  formatBRL={formatBRL}
                  showAccountDetails={isPremium}
                />
              </div>
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  )
}

export const EventsTimeline: React.FC<EventsTimelineProps> = ({
  events,
  onDeleteEvent,
  deletingEventId,
  formatBRL,
  isPremium
}) => {
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set(['today']))
  
  const toggleGroup = (groupId: string) => {
    const newExpanded = new Set(expandedGroups)
    if (newExpanded.has(groupId)) {
      newExpanded.delete(groupId)
    } else {
      newExpanded.add(groupId)
    }
    setExpandedGroups(newExpanded)
  }
  
  // Group events by time period
  const groupedEvents = React.useMemo(() => {
    const groups: { [key: string]: { title: string; events: EventWithRelations[] } } = {}
    
    events.forEach(event => {
      const eventDate = parseISO(event.tstamp)
      let groupKey: string
      let groupTitle: string
      
      if (isToday(eventDate)) {
        groupKey = 'today'
        groupTitle = 'Hoje'
      } else if (isThisWeek(eventDate)) {
        groupKey = 'thisWeek'
        groupTitle = 'Esta semana'
      } else if (isThisMonth(eventDate)) {
        groupKey = 'thisMonth'
        groupTitle = 'Este mês'
      } else {
        const monthYear = format(eventDate, 'MMMM yyyy', { locale: ptBR })
        groupKey = format(eventDate, 'yyyy-MM')
        groupTitle = monthYear.charAt(0).toUpperCase() + monthYear.slice(1)
      }
      
      if (!groups[groupKey]) {
        groups[groupKey] = { title: groupTitle, events: [] }
      }
      groups[groupKey]!.events.push(event)
    })
    
    // Sort events within each group
    Object.values(groups).forEach(group => {
      group.events.sort((a, b) => new Date(b.tstamp).getTime() - new Date(a.tstamp).getTime())
    })
    
    return groups
  }, [events])
  
  const groupOrder = ['today', 'thisWeek', 'thisMonth']
  const sortedGroups = Object.entries(groupedEvents).sort(([keyA], [keyB]) => {
    const indexA = groupOrder.indexOf(keyA)
    const indexB = groupOrder.indexOf(keyB)
    
    if (indexA !== -1 && indexB !== -1) return indexA - indexB
    if (indexA !== -1) return -1
    if (indexB !== -1) return 1
    
    return keyB.localeCompare(keyA)
  })
  
  if (events.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Timeline vazia</h3>
          <p className="text-muted-foreground">
            Nenhum evento encontrado para exibir na timeline.
          </p>
        </CardContent>
      </Card>
    )
  }
  
  return (
    <div className="space-y-4">
      <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Timeline de Eventos
            {!isPremium && (
              <Badge variant="outline" className="text-xs">
                <Filter className="h-3 w-3 mr-1" />
                Versão Free
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
      </Card>
      
      {sortedGroups.map(([groupKey, group]) => (
        <TimelineGroup
          key={groupKey}
          title={group.title}
          events={group.events}
          isExpanded={expandedGroups.has(groupKey)}
          onToggle={() => toggleGroup(groupKey)}
          onDeleteEvent={onDeleteEvent}
          deletingEventId={deletingEventId}
          formatBRL={formatBRL}
          isPremium={isPremium}
        />
      ))}
    </div>
  )
}