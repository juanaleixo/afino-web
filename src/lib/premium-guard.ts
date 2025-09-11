import { supabase } from './supabase'

/**
 * Centralized Premium Access Control
 * 
 * This module provides a single source of truth for premium feature access.
 * All premium checks should go through this system to avoid discrepancies.
 */

export class PremiumGuard {
  private static userPremiumStatus = new Map<string, boolean>()
  private static lastChecked = new Map<string, number>()
  private static readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Check if user has premium access using api_user_context (cached for performance)
   */
  static async isPremium(userId: string): Promise<boolean> {
    const now = Date.now()
    const lastCheck = this.lastChecked.get(userId) || 0
    const cached = this.userPremiumStatus.get(userId)

    // Use cache if available and not expired
    if (cached !== undefined && (now - lastCheck) < this.CACHE_TTL) {
      return cached
    }

    try {
      // Use api_user_context as single source of truth
      const { data, error } = await supabase.rpc('api_user_context')
      
      if (error) {
        throw error
      }

      const isPremium = data?.is_premium || false
      
      // Update cache
      this.userPremiumStatus.set(userId, isPremium)
      this.lastChecked.set(userId, now)
      
      return isPremium
    } catch (error) {
      console.warn('Error checking premium status, defaulting to free:', error)
      
      // Cache failure as free to avoid repeated calls
      this.userPremiumStatus.set(userId, false)
      this.lastChecked.set(userId, now)
      
      return false
    }
  }

  /**
   * Execute premium function with graceful fallback
   */
  static async withPremium<T>(
    userId: string,
    premiumFn: () => Promise<T>,
    fallbackFn: () => Promise<T>,
    feature?: string
  ): Promise<T> {
    const isPremium = await this.isPremium(userId)
    
    if (isPremium) {
      try {
        return await premiumFn()
      } catch (error) {
        // Log premium function failure but continue with fallback
        console.warn(`Premium feature "${feature || 'unknown'}" failed, using fallback:`, error)
        return await fallbackFn()
      }
    }
    
    return await fallbackFn()
  }

  /**
   * Execute premium function or return default value
   */
  static async withPremiumOrDefault<T>(
    userId: string,
    premiumFn: () => Promise<T>,
    defaultValue: T,
    feature?: string
  ): Promise<T> {
    return this.withPremium(
      userId,
      premiumFn,
      async () => defaultValue,
      feature
    )
  }

  /**
   * Clear premium status cache for user (useful after subscription changes)
   */
  static clearCache(userId: string): void {
    this.userPremiumStatus.delete(userId)
    this.lastChecked.delete(userId)
  }

  /**
   * Clear all premium caches
   */
  static clearAllCaches(): void {
    this.userPremiumStatus.clear()
    this.lastChecked.clear()
  }

  /**
   * Check if feature requires premium and throw appropriate error
   */
  static async requirePremium(userId: string, feature: string): Promise<void> {
    const isPremium = await this.isPremium(userId)
    if (!isPremium) {
      throw new Error(`Funcionalidade ${feature} requer plano premium`)
    }
  }

  /**
   * Get premium features list for user using api_user_context
   */
  static async getFeatures(userId: string): Promise<{
    dailyData: boolean
    customPeriods: boolean
    advancedFilters: boolean
    projections: boolean
    multipleAccounts: boolean
    apiAccess: boolean
  }> {
    try {
      // Use api_user_context as single source of truth
      const { data, error } = await supabase.rpc('api_user_context')
      
      if (error) {
        throw error
      }

      return data?.features || {
        dailyData: false,
        customPeriods: false,
        advancedFilters: false,
        projections: false,
        multipleAccounts: false,
        apiAccess: false
      }
    } catch (error) {
      console.warn('Error getting features, defaulting to free features:', error)
      return {
        dailyData: false,
        customPeriods: false,
        advancedFilters: false,
        projections: false,
        multipleAccounts: false,
        apiAccess: false
      }
    }
  }
}

/**
 * Hook-style interface for use in React components
 */
export interface PremiumStatus {
  isPremium: boolean
  features: {
    dailyData: boolean
    customPeriods: boolean
    advancedFilters: boolean
    projections: boolean
    multipleAccounts: boolean
    apiAccess: boolean
  }
}

/**
 * Get premium status for use in components
 */
export async function getPremiumStatus(userId: string): Promise<PremiumStatus> {
  const [isPremium, features] = await Promise.all([
    PremiumGuard.isPremium(userId),
    PremiumGuard.getFeatures(userId)
  ])

  return { isPremium, features }
}