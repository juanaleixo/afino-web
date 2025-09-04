/**
 * Asset Helpers
 * Centralized utilities for managing asset identifiers in the new hybrid system
 * where global_assets use symbol and custom_assets use id
 */

import { Asset } from "@/lib/supabase"

/**
 * Determines if an asset is a custom asset
 */
export function isCustomAsset(asset: Asset): boolean {
  return !!(asset.meta as any)?.is_custom
}

/**
 * Determines if an asset is a global asset
 */
export function isGlobalAsset(asset: Asset): boolean {
  return !isCustomAsset(asset)
}

/**
 * Gets the correct form value for an asset (symbol for global, id for custom)
 */
export function getAssetFormValue(asset: Asset): string {
  if (isCustomAsset(asset)) {
    return asset.id || asset.symbol
  }
  return asset.symbol
}

/**
 * Determines if an asset is selected based on the value
 */
export function isAssetSelected(asset: Asset, selectedValue: string): boolean {
  if (isCustomAsset(asset)) {
    return (asset.id || asset.symbol) === selectedValue
  }
  return asset.symbol === selectedValue
}

/**
 * Gets the correct link value for an asset (for query params)
 */
export function getAssetLinkValue(asset: Asset): string {
  return getAssetFormValue(asset)
}

/**
 * Gets the correct link value from an asset ID and assets map
 */
export function getAssetLinkValueFromMap(assetId: string, assetsMap: Map<string, Asset>): string {
  const asset = assetsMap.get(assetId)
  if (asset) {
    return getAssetLinkValue(asset)
  }
  return assetId // fallback
}

/**
 * Gets the display identifier for an asset (what to show in UI)
 */
export function getAssetDisplayId(asset: Asset): string {
  if (isCustomAsset(asset)) {
    return (asset as any).label || asset.symbol
  }
  return asset.symbol
}

/**
 * Finds an asset in a list by comparing the correct identifier
 */
export function findAssetByValue(assets: Asset[], value: string): Asset | undefined {
  return assets.find(asset => isAssetSelected(asset, value))
}

/**
 * Helper to create asset identifier for events/database
 * Returns object with correct field set
 */
export function createAssetIdentifier(asset: Asset): { asset_symbol?: string; asset_id?: string } {
  if (isCustomAsset(asset)) {
    const id = asset.id || undefined
    return id ? { asset_id: id } : { asset_symbol: asset.symbol }
  }
  return { asset_symbol: asset.symbol }
}

/**
 * Helper to get unified asset identifier (for internal use)
 */
export function getUnifiedAssetId(asset: Asset): string {
  return getAssetFormValue(asset)
}
