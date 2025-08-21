import { supabase } from './supabase'

// Types for the daily snapshot system
export interface DailySnapshot {
  id: string
  user_id: string
  date: string // YYYY-MM-DD in America/Sao_Paulo timezone
  total_portfolio_value: number
  cash_balance: number
  assets_value: number
  created_at: string
  updated_at: string
}

export interface AssetSnapshot {
  asset_id: string
  symbol: string
  asset_class: string
  quantity: number
  price: number
  value: number
}

export interface SnapshotSummary {
  date: string
  total_value: number
  cash_balance: number
  assets_value: number
  asset_breakdown: AssetSnapshot[]
}

export interface EventForSnapshot {
  id: string
  user_id: string
  asset_id: string
  tstamp: string
  kind: 'deposit' | 'withdraw' | 'buy' | 'position_add' | 'valuation'
  units_delta?: number
  price_override?: number
  price_close?: number
  global_assets?: {
    symbol: string
    class: string
  }
}

export interface AssetPosition {
  asset_id: string
  symbol: string
  asset_class: string
  quantity: number
  last_price: number
}

// Timezone utilities for Brazil
const SAO_PAULO_TZ = 'America/Sao_Paulo'

export function toSaoPauloDate(date: Date): string {
  return new Intl.DateTimeFormat('sv-SE', { 
    timeZone: SAO_PAULO_TZ 
  }).format(date)
}

export function getSaoPauloToday(): string {
  return toSaoPauloDate(new Date())
}

export function getSaoPauloDayEnd(dateStr: string): Date {
  // Create date at 23:59:59 in São Paulo timezone
  const date = new Date(`${dateStr}T23:59:59-03:00`)
  return date
}

export function getSaoPauloDayStart(dateStr: string): Date {
  // Create date at 00:00:00 in São Paulo timezone
  const date = new Date(`${dateStr}T00:00:00-03:00`)
  return date
}

// Pure function to calculate positions from events up to a specific date
export function calculatePositionsAtDate(
  events: EventForSnapshot[],
  targetDate: string
): AssetPosition[] {
  const dayEnd = getSaoPauloDayEnd(targetDate)
  
  // Filter events up to the target date (inclusive)
  const relevantEvents = events.filter(event => {
    const eventDate = new Date(event.tstamp)
    return eventDate <= dayEnd
  })

  // Group events by asset
  const positionMap = new Map<string, AssetPosition>()

  for (const event of relevantEvents) {
    const assetId = event.asset_id
    const symbol = event.global_assets?.symbol || 'UNKNOWN'
    const assetClass = event.global_assets?.class || 'unknown'

    if (!positionMap.has(assetId)) {
      positionMap.set(assetId, {
        asset_id: assetId,
        symbol,
        asset_class: assetClass,
        quantity: 0,
        last_price: 1 // Default price for currency
      })
    }

    const position = positionMap.get(assetId)!

    switch (event.kind) {
      case 'deposit':
        position.quantity += event.units_delta || 0
        break
      case 'withdraw':
        position.quantity += event.units_delta || 0 // units_delta already negative
        break
      case 'buy':
        position.quantity += event.units_delta || 0
        if (event.price_close) {
          position.last_price = event.price_close
        }
        break
      case 'position_add':
        position.quantity += event.units_delta || 0
        if (event.price_override) {
          position.last_price = event.price_override
        }
        break
      case 'valuation':
        if (event.price_override) {
          position.last_price = event.price_override
        }
        break
    }
  }

  return Array.from(positionMap.values()).filter(pos => pos.quantity !== 0)
}

// Pure function to calculate daily snapshot from positions
export function calculateDailySnapshot(
  positions: AssetPosition[],
  date: string,
  userId: string
): SnapshotSummary {
  let cashBalance = 0
  let assetsValue = 0
  const assetBreakdown: AssetSnapshot[] = []

  for (const position of positions) {
    const value = position.quantity * position.last_price

    if (position.asset_class === 'currency') {
      cashBalance += value
    } else {
      assetsValue += value
      assetBreakdown.push({
        asset_id: position.asset_id,
        symbol: position.symbol,
        asset_class: position.asset_class,
        quantity: position.quantity,
        price: position.last_price,
        value
      })
    }
  }

  const totalValue = cashBalance + assetsValue

  return {
    date,
    total_value: totalValue,
    cash_balance: cashBalance,
    assets_value: assetsValue,
    asset_breakdown: assetBreakdown
  }
}

// Cache management
class SnapshotCache {
  private cache = new Map<string, SnapshotSummary>()
  private maxSize = 1000

  private getCacheKey(userId: string, date: string): string {
    return `${userId}:${date}`
  }

  get(userId: string, date: string): SnapshotSummary | undefined {
    return this.cache.get(this.getCacheKey(userId, date))
  }

  set(userId: string, date: string, snapshot: SnapshotSummary): void {
    const key = this.getCacheKey(userId, date)
    
    // Simple LRU: if cache is full, delete oldest entry
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value
      if (firstKey) {
        this.cache.delete(firstKey)
      }
    }
    
    this.cache.set(key, snapshot)
  }

  invalidate(userId: string, date?: string): void {
    if (date) {
      this.cache.delete(this.getCacheKey(userId, date))
    } else {
      // Clear all entries for user
      const keysToDelete: string[] = []
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${userId}:`)) {
          keysToDelete.push(key)
        }
      }
      keysToDelete.forEach(key => this.cache.delete(key))
    }
  }

  clear(): void {
    this.cache.clear()
  }
}

// Global cache instance
export const snapshotCache = new SnapshotCache()

// Main aggregation function with cache
export async function getDailySnapshot(
  userId: string, 
  date: string
): Promise<SnapshotSummary> {
  // Check cache first
  const cached = snapshotCache.get(userId, date)
  if (cached) {
    return cached
  }

  // Fetch all user events from database
  const { data: events, error } = await supabase
    .from('events')
    .select(`
      id,
      user_id,
      asset_id,
      tstamp,
      kind,
      units_delta,
      price_override,
      price_close,
      global_assets (
        symbol,
        class
      )
    `)
    .eq('user_id', userId)
    .order('tstamp', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch events: ${error.message}`)
  }

  // Transform the data to match our interface (Supabase returns array, we expect object)
  const transformedEvents = (events || []).map((event: any) => ({
    id: event.id,
    user_id: event.user_id,
    asset_id: event.asset_id,
    tstamp: event.tstamp,
    kind: event.kind,
    units_delta: event.units_delta,
    price_override: event.price_override,
    price_close: event.price_close,
    global_assets: Array.isArray(event.global_assets) && event.global_assets.length > 0 
      ? event.global_assets[0] 
      : event.global_assets || { symbol: 'UNKNOWN', class: 'unknown' }
  })) as EventForSnapshot[]

  // Calculate positions at the target date
  const positions = calculatePositionsAtDate(transformedEvents, date)
  
  // Calculate snapshot
  const snapshot = calculateDailySnapshot(positions, date, userId)
  
  // Cache the result
  snapshotCache.set(userId, date, snapshot)
  
  return snapshot
}

// Backfill function for the last 365 days
export async function backfillDailySnapshots(userId: string): Promise<void> {
  const today = getSaoPauloToday()
  const oneYearAgo = new Date()
  oneYearAgo.setDate(oneYearAgo.getDate() - 365)
  const startDate = toSaoPauloDate(oneYearAgo)

  console.log(`Backfilling snapshots for user ${userId} from ${startDate} to ${today}`)

  // Generate all dates in the range
  const dates: string[] = []
  const current = new Date(startDate)
  const end = new Date(today)

  while (current <= end) {
    dates.push(toSaoPauloDate(current))
    current.setDate(current.getDate() + 1)
  }

  // Process dates in batches to avoid overwhelming the system
  const batchSize = 30
  for (let i = 0; i < dates.length; i += batchSize) {
    const batch = dates.slice(i, i + batchSize)
    
    const promises = batch.map(date => getDailySnapshot(userId, date))
    await Promise.all(promises)
    
    console.log(`Processed batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(dates.length / batchSize)}`)
  }

  console.log(`Backfill completed for user ${userId}`)
}

// Incremental recalculation when new events are added
export async function invalidateSnapshotsFromDate(
  userId: string, 
  fromDate: string
): Promise<void> {
  // Clear cache from the given date onwards
  const today = getSaoPauloToday()
  const current = new Date(fromDate)
  const end = new Date(today)

  while (current <= end) {
    const dateStr = toSaoPauloDate(current)
    snapshotCache.invalidate(userId, dateStr)
    current.setDate(current.getDate() + 1)
  }

  console.log(`Invalidated snapshots for user ${userId} from ${fromDate} onwards`)
}

// Utility function to get snapshot range
export async function getDailySnapshotRange(
  userId: string,
  fromDate: string,
  toDate: string
): Promise<SnapshotSummary[]> {
  const snapshots: SnapshotSummary[] = []
  const current = new Date(fromDate)
  const end = new Date(toDate)

  while (current <= end) {
    const dateStr = toSaoPauloDate(current)
    const snapshot = await getDailySnapshot(userId, dateStr)
    snapshots.push(snapshot)
    current.setDate(current.getDate() + 1)
  }

  return snapshots
}