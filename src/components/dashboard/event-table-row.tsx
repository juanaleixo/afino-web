import * as React from "react"
import { TableCell, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/ui/status-badge"
import { AssetBadge } from "@/components/ui/asset-badge"
import { Trash2 } from "lucide-react"
import { EventWithRelations } from "@/lib/types/events"
import { 
  getEventIcon,
  getEventLabel,
  isCashAsset,
  getAssetDisplay,
  getDisplayPrice,
  getEventValue,
  formatBRL
} from "@/lib/utils/event-utils"

interface EventTableRowProps {
  event: EventWithRelations
  onDelete: (eventId: string) => void
  isDeleting: boolean
}

const EventTableRow = React.memo<EventTableRowProps>(({
  event,
  onDelete,
  isDeleting,
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
              event.kind === 'buy' || event.kind === 'deposit' || event.kind === 'position_add' ? 'success' :
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
            showLabel={false}
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
        {getDisplayPrice(event, formatBRL)}
      </TableCell>
      <TableCell>
        {(() => {
          const eventValue = getEventValue(event)
          if (eventValue !== null) {
            return (
              <StatusBadge 
                variant={eventValue >= 0 ? 'success' : 'error'}
                size="sm"
              >
                {formatBRL(eventValue)}
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