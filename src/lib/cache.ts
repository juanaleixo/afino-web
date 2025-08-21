// Cache system for reducing duplicate API calls
interface CacheItem<T> {
  data: T
  timestamp: number
  expiresAt: number
}

class Cache {
  private cache = new Map<string, CacheItem<any>>()
  private defaultTtl = 5 * 60 * 1000 // 5 minutes

  set<T>(key: string, data: T, ttl?: number): void {
    const now = Date.now()
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + (ttl || this.defaultTtl)
    })
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key)
    
    if (!item) {
      return null
    }

    if (Date.now() > item.expiresAt) {
      this.cache.delete(key)
      return null
    }

    return item.data as T
  }

  clear(): void {
    this.cache.clear()
  }

  delete(key: string): void {
    this.cache.delete(key)
  }

  // Helper to create cache key
  static key(prefix: string, ...parts: string[]): string {
    return `${prefix}:${parts.join(':')}`
  }
}

// Global cache instance
export const cache = new Cache()

// Track ongoing calls to prevent duplicate requests
const ongoingCalls = new Map<string, Promise<any>>()

// Cached wrapper for async functions
export function withCache<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  keyGenerator: (...args: T) => string,
  ttl?: number
) {
  return async (...args: T): Promise<R> => {
    const key = keyGenerator(...args)
    
    // Check cache first
    const cached = cache.get<R>(key)
    if (cached !== null) {
      console.log(`Cache hit for key: ${key}`)
      return cached
    }

    // Check if there's an ongoing call for this key
    if (ongoingCalls.has(key)) {
      console.log(`Waiting for ongoing call: ${key}`)
      return await ongoingCalls.get(key)!
    }

    console.log(`Cache miss for key: ${key}`)
    
    // Create promise and track it
    const promise = (async () => {
      try {
        const result = await fn(...args)
        cache.set(key, result, ttl)
        console.log(`Cached result for key: ${key}`)
        return result
      } catch (error) {
        console.warn(`Function failed for key: ${key}`, error)
        throw error
      } finally {
        ongoingCalls.delete(key)
      }
    })()
    
    ongoingCalls.set(key, promise)
    return await promise
  }
}