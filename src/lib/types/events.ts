/**
 * Event Types and Interfaces
 * Centralized definitions for event-related types
 */

export type EventKind = 'deposit' | 'withdraw' | 'buy' | 'position_add' | 'valuation'

export interface EventWithRelations {
  id: string
  user_id: string
  asset_id: string
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