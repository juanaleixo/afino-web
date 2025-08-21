import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Tipos baseados no schema SQL real
export interface User {
  id: string
  email: string
  created_at: string
}

export interface Account {
  id: string
  user_id: string
  label: string
  currency: string
  created_at: string
}

export interface Asset {
  id: string
  symbol: string
  class: string
  manual_price?: number
  currency: string
  meta?: Record<string, unknown>
  created_at: string
  connector?: string
  external_account_id?: string
  label_ptbr?: string
}

export interface Event {
  id: string
  user_id: string
  asset_id: string
  account_id?: string
  tstamp: string
  kind: 'deposit' | 'withdraw' | 'buy' | 'position_add' | 'valuation'
  units_delta?: number
  price_override?: number
  price_close?: number
}

export interface Holding {
  user_id: string
  asset_id: string
  units: number
}

export interface HoldingWithAsset extends Holding {
  asset: Asset
}

export interface PortfolioValueDaily {
  user_id: string
  d: string
  total_value: number
}

export interface PriceDaily {
  user_id: string
  asset_id: string
  d: string
  close: number
}

// Novos tipos para as funções RPC e consultas do Supabase
export interface PortfolioDaily {
  date: string
  total_value: number
}

export interface PortfolioMonthly {
  month_eom: string
  total_value: number
}

export interface HoldingAt {
  asset_id: string
  units: number
  value: number
}

export interface HoldingAccount {
  account_id: string
  asset_id: string
  units: number
  value: number
}

export interface UserProfile {
  user_id: string
  plan: 'free' | 'premium'
} 
