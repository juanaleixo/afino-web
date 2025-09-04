/**
 * Event Types and Interfaces
 * Centralized definitions for event-related types
 */

export type EventKind = 'deposit' | 'withdraw' | 'buy' | 'position_add' | 'valuation'

export interface EventWithRelations {
  id: string
  user_id: string
  asset_symbol?: string  // Para global_assets (referencia symbol)
  asset_id?: string      // Para custom_assets (referencia id)
  account_id?: string
  tstamp: string
  kind: EventKind
  units_delta?: number
  price_override?: number
  price_close?: number
  global_assets?: {
    symbol: string
    class: string
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

export interface EventTypeOption {
  kind: EventKind
  title: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  color: string
  forCurrency?: boolean
  forAssets?: boolean
  isNew?: boolean
}

// Helper functions para trabalhar com assets
export function getEventAssetId(event: EventWithRelations): string {
  return event.asset_symbol || event.asset_id || ''
}

export function isGlobalAsset(event: EventWithRelations): boolean {
  return !!event.asset_symbol && !!event.global_assets
}

export function isCustomAsset(event: EventWithRelations): boolean {
  return !!event.asset_id && !!event.custom_assets
}

export function getEventAssetSymbol(event: EventWithRelations): string {
  if (isGlobalAsset(event)) {
    return event.global_assets?.symbol || event.asset_symbol || ''
  }
  if (isCustomAsset(event)) {
    return event.custom_assets?.label || event.asset_id || ''
  }
  return event.asset_symbol || event.asset_id || ''
}

// Event kind display metadata
export const EVENT_METADATA: Record<EventKind, {
  title: string
  description: string
  iconColor: string
}> = {
  deposit: {
    title: 'Depósito',
    description: 'Adicionar dinheiro ou ativos à conta',
    iconColor: 'text-green-600'
  },
  withdraw: {
    title: 'Saque', 
    description: 'Retirar dinheiro ou ativos da conta',
    iconColor: 'text-red-600'
  },
  buy: {
    title: 'Compra',
    description: 'Comprar ativos com preço específico', 
    iconColor: 'text-blue-600'
  },
  position_add: {
    title: 'Adicionar Posição',
    description: 'Registrar ativos que você já possui',
    iconColor: 'text-purple-600'
  },
  valuation: {
    title: 'Avaliação',
    description: 'Definir preço manual do ativo',
    iconColor: 'text-yellow-600'
  }
} as const