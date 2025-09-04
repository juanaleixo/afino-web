/**
 * Asset Info Helper
 * Provides utility functions to get asset information without relying on foreign keys
 */

import { supabase } from '../supabase'

export interface AssetInfo {
  symbol: string
  class: string
  label_ptbr?: string
  currency?: string
  id?: string
}

/**
 * Get asset info for multiple asset symbols/IDs
 * Handles both global assets (symbols) and custom assets (UUIDs)
 */
export async function getAssetInfoBatch(assetIds: string[]): Promise<Record<string, AssetInfo>> {
  if (!assetIds.length) return {}

  const globalAssets: string[] = []
  const customAssets: string[] = []

  // Separate global assets (symbols) from custom assets (UUIDs)
  assetIds.forEach(id => {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
    if (isUUID) {
      customAssets.push(id)
    } else {
      globalAssets.push(id)
    }
  })

  const result: Record<string, AssetInfo> = {}

  try {
    // Fetch global assets
    if (globalAssets.length > 0) {
      const { data: globalData, error: globalError } = await supabase
        .from('global_assets')
        .select('symbol, class, label_ptbr, currency, id')
        .in('symbol', globalAssets)

      if (globalError) {
        console.warn('Error fetching global assets:', globalError)
      } else if (globalData) {
        globalData.forEach(asset => {
          result[asset.symbol] = {
            symbol: asset.symbol,
            class: asset.class,
            label_ptbr: asset.label_ptbr,
            currency: asset.currency,
            id: asset.id
          }
        })
      }
    }

    // Fetch custom assets
    if (customAssets.length > 0) {
      const { data: customData, error: customError } = await supabase
        .from('custom_assets')
        .select('id, label, class, currency, symbol')
        .in('id', customAssets)

      if (customError) {
        console.warn('Error fetching custom assets:', customError)
      } else if (customData) {
        customData.forEach(asset => {
          result[asset.id] = {
            symbol: asset.symbol || asset.id, // Use symbol if available, otherwise ID
            class: asset.class || 'custom',
            label_ptbr: asset.label,
            currency: asset.currency,
            id: asset.id
          }
        })
      }
    }

    // Add fallback for missing assets
    assetIds.forEach(id => {
      if (!result[id]) {
        result[id] = {
          symbol: id,
          class: 'unknown',
          label_ptbr: id
        }
      }
    })

  } catch (error) {
    console.error('Error in getAssetInfoBatch:', error)
    
    // Fallback: return basic info for all assets
    assetIds.forEach(id => {
      result[id] = {
        symbol: id,
        class: 'unknown',
        label_ptbr: id
      }
    })
  }

  return result
}

/**
 * Get asset info for a single asset
 */
export async function getAssetInfo(assetId: string): Promise<AssetInfo> {
  const batch = await getAssetInfoBatch([assetId])
  return batch[assetId] || {
    symbol: assetId,
    class: 'unknown',
    label_ptbr: assetId
  }
}

/**
 * Enrich events with asset information
 */
export async function enrichEventsWithAssets<T extends { asset_symbol?: string }>(
  events: T[]
): Promise<(T & { global_assets?: AssetInfo })[]> {
  if (!events.length) return []

  const assetIds = events
    .map(e => e.asset_symbol)
    .filter((id): id is string => !!id)
    .filter((id, index, arr) => arr.indexOf(id) === index) // unique

  const assetInfo = await getAssetInfoBatch(assetIds)

  return events.map(event => ({
    ...event,
    global_assets: event.asset_symbol ? assetInfo[event.asset_symbol] : undefined
  }))
}