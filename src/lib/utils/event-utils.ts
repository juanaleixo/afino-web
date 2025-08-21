/**
 * Event Utility Functions
 * Centralized utility functions for event handling
 */

import React from "react"
import { 
  TrendingUp, 
  TrendingDown, 
  ShoppingCart, 
  Plus,
  DollarSign,
  Calendar 
} from "lucide-react"
import { EventKind, EventWithRelations, EVENT_METADATA } from '@/lib/types/events'

/**
 * Get icon component for event kind
 */
export function getEventIcon(kind: EventKind): React.ReactNode {
  switch (kind) {
    case 'deposit':
      return React.createElement(TrendingUp, { className: "h-4 w-4 text-green-600" })
    case 'withdraw':
      return React.createElement(TrendingDown, { className: "h-4 w-4 text-red-600" })
    case 'buy':
      return React.createElement(ShoppingCart, { className: "h-4 w-4 text-blue-600" })
    case 'position_add':
      return React.createElement(Plus, { className: "h-4 w-4 text-purple-600" })
    case 'valuation':
      return React.createElement(DollarSign, { className: "h-4 w-4 text-yellow-600" })
    default:
      return React.createElement(Calendar, { className: "h-4 w-4" })
  }
}

/**
 * Get display label for event kind
 */
export function getEventLabel(kind: EventKind): string {
  return EVENT_METADATA[kind]?.title || kind
}

/**
 * Check if event is for a cash asset (BRL)
 */
export function isCashAsset(event: EventWithRelations): boolean {
  const symbol = event.global_assets?.symbol?.toUpperCase?.()
  return event.global_assets?.class === 'currency' || 
         event.global_assets?.class === 'cash' || 
         symbol === 'BRL' || 
         symbol === 'CASH'
}

/**
 * Get asset display name
 */
export function getAssetDisplay(event: EventWithRelations): string {
  if (isCashAsset(event)) {
    const symbol = event.global_assets?.symbol?.toUpperCase?.()
    return symbol && symbol !== 'BRL' ? `Caixa (${symbol})` : 'Caixa (BRL)'
  }
  return event.global_assets?.symbol || '—'
}

/**
 * Get display price for event
 */
export function getDisplayPrice(event: EventWithRelations, formatBRL: (n: number) => string): string {
  if (isCashAsset(event)) return formatBRL(1)
  
  if (event.kind === 'buy' || event.kind === 'position_add') {
    if (typeof event.price_close === 'number') return formatBRL(event.price_close)
  }
  
  if (event.kind === 'valuation') {
    if (typeof event.price_override === 'number') return formatBRL(event.price_override)
  }
  
  return '—'
}

/**
 * Calculate event value (quantidade × preço or direct value for cash)
 */
export function getEventValue(event: EventWithRelations): number | null {
  if (typeof event.units_delta !== 'number') return null
  
  // Para caixa (BRL), units_delta já é em reais
  if (isCashAsset(event)) {
    return event.units_delta
  }
  
  // Para outros ativos, calcular valor = quantidade × preço
  let price = 0
  if (event.kind === 'buy' || event.kind === 'position_add') {
    price = event.price_close || 0
  } else if (event.kind === 'valuation') {
    price = event.price_override || 0
  }
  
  if (price > 0) {
    return event.units_delta * price
  }
  
  return null
}

/**
 * Format currency in BRL
 */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  }).format(value)
}