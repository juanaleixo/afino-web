import * as React from "react"
import { TableCell, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { AssetBadge } from "@/components/ui/asset-badge"
import { Trash2 } from "lucide-react"

interface EventWithRelations {
  id: string
  user_id: string
  asset_id: string
  account_id?: string
  tstamp: string
  kind: 'deposit' | 'withdraw' | 'buy' | 'valuation'
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

interface EventTableRowProps {
  event: EventWithRelations
  onDelete: (eventId: string) => void
  isDeleting: boolean
  getEventIcon: (kind: EventWithRelations['kind']) => React.ReactNode
  getEventLabel: (kind: EventWithRelations['kind']) => string
  isCashAsset: (event: EventWithRelations) => boolean
  getAssetDisplay: (event: EventWithRelations) => string
  getDisplayPrice: (event: EventWithRelations) => string
  formatBRL: (value: number) => string
}

const EventTableRow = React.memo<EventTableRowProps>(({
  event,
  onDelete,
  isDeleting,
  getEventIcon,
  getEventLabel,
  isCashAsset,
  getAssetDisplay,
  getDisplayPrice,
  formatBRL,
}) => {
  return (
    <TableRow key={event.id}>
      <TableCell>
        {new Date(event.tstamp).toLocaleDateString('pt-BR')}
      </TableCell>
      <TableCell>
        <div className="flex items-center space-x-2">
          {getEventIcon(event.kind)}
          <StatusBadge 
            variant={
              event.kind === 'buy' || event.kind === 'deposit' ? 'success' :
              event.kind === 'withdraw' ? 'error' : 'neutral'
            }
            size="sm"
          >
            {getEventLabel(event.kind)}
          </StatusBadge>
        </div>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <AssetBadge 
            assetClass={isCashAsset(event) ? 'currency' : (event.global_assets?.class as any || 'default')}
            size="sm"
          />
          <span>{getAssetDisplay(event)}</span>
        </div>
      </TableCell>
      <TableCell>
        {event.accounts?.label || 'N/D'}
      </TableCell>
      <TableCell>
        {event.units_delta ? (
          <StatusBadge 
            variant={event.units_delta > 0 ? 'success' : 'error'}
            size="sm"
          >
            {event.units_delta > 0 ? '+' : ''}{event.units_delta}
          </StatusBadge>
        ) : 'N/D'}
      </TableCell>
      <TableCell>
        {getDisplayPrice(event)}
      </TableCell>
      <TableCell>
        {(() => {
          // Para ativos de caixa (BRL), o units_delta já representa o impacto no caixa
          if (isCashAsset(event) && typeof event.units_delta === 'number') {
            const val = event.units_delta
            return (
              <StatusBadge 
                variant={val >= 0 ? 'success' : 'error'}
                size="sm"
              >
                {formatBRL(val)}
              </StatusBadge>
            )
          }
          
          // Para compras, calcular o impacto no caixa
          if (event.kind === 'buy' && typeof event.units_delta === 'number' && typeof event.price_close === 'number') {
            // Compra: Saída de caixa (negativo) - você gasta dinheiro para comprar o ativo
            const cashImpact = -Math.abs(event.units_delta) * event.price_close  // Sempre negativo para compras
            
            return (
              <StatusBadge 
                variant={cashImpact >= 0 ? 'success' : 'error'}
                size="sm"
              >
                {formatBRL(cashImpact)}
              </StatusBadge>
            )
          }
          
          return '—'
        })()}
      </TableCell>
      <TableCell className="text-right">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(event.id)}
          disabled={isDeleting}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  )
})

EventTableRow.displayName = "EventTableRow"

export { EventTableRow }