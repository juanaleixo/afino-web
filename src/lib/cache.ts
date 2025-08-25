// Enhanced cache system with smart invalidation and TTL management
interface CacheItem<T> {
  data: T
  timestamp: number
  expiresAt: number
  tags?: string[]
}

interface CacheOptions {
  ttl?: number
  tags?: string[]
}

class EnhancedCache {
  private cache = new Map<string, CacheItem<unknown>>()
  private tagIndex = new Map<string, Set<string>>() // tag -> keys mapping
  private defaultTtl = 5 * 60 * 1000 // 5 minutes
  
  // TTL presets for different data types
  static readonly TTL = {
    SHORT: 30 * 1000,         // 30 seconds
    MEDIUM: 5 * 60 * 1000,    // 5 minutes
    LONG: 15 * 60 * 1000,     // 15 minutes
    HOUR: 60 * 60 * 1000,     // 1 hour
    DAY: 24 * 60 * 60 * 1000, // 1 day
  } as const

  set<T>(key: string, data: T, options: CacheOptions = {}): void {
    const now = Date.now()
    const ttl = options.ttl || this.defaultTtl
    const tags = options.tags || []
    
    // Remove from old tags if key exists
    const oldItem = this.cache.get(key)
    if (oldItem?.tags) {
      this.removeFromTags(key, oldItem.tags)
    }
    
    // Add to cache
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
      tags
    })
    
    // Update tag index
    this.addToTags(key, tags)
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key)
    
    if (!item) {
      return null
    }

    if (Date.now() > item.expiresAt) {
      this.delete(key)
      return null
    }

    return item.data as T
  }

  delete(key: string): void {
    const item = this.cache.get(key)
    if (item?.tags) {
      this.removeFromTags(key, item.tags)
    }
    this.cache.delete(key)
  }

  // Invalidate all cache entries with a specific tag
  invalidateTag(tag: string): void {
    const keys = this.tagIndex.get(tag)
    if (keys) {
      keys.forEach(key => this.delete(key))
      this.tagIndex.delete(tag)
    }
  }

  // Invalidate multiple tags at once
  invalidateTags(tags: string[]): void {
    tags.forEach(tag => this.invalidateTag(tag))
  }

  // Clear all expired entries
  cleanup(): void {
    const now = Date.now()
    const expiredKeys: string[] = []
    
    this.cache.forEach((item, key) => {
      if (now > item.expiresAt) {
        expiredKeys.push(key)
      }
    })
    
    expiredKeys.forEach(key => this.delete(key))
  }

  clear(): void {
    this.cache.clear()
    this.tagIndex.clear()
  }

  // Get cache statistics
  getStats(): {
    size: number
    tags: number
    memoryUsage: number
  } {
    return {
      size: this.cache.size,
      tags: this.tagIndex.size,
      memoryUsage: this.estimateMemoryUsage()
    }
  }

  // Helper methods
  private addToTags(key: string, tags: string[]): void {
    tags.forEach(tag => {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set())
      }
      this.tagIndex.get(tag)!.add(key)
    })
  }

  private removeFromTags(key: string, tags: string[]): void {
    tags.forEach(tag => {
      const keys = this.tagIndex.get(tag)
      if (keys) {
        keys.delete(key)
        if (keys.size === 0) {
          this.tagIndex.delete(tag)
        }
      }
    })
  }

  private estimateMemoryUsage(): number {
    // Rough estimation of memory usage in bytes
    let size = 0
    this.cache.forEach((item, key) => {
      size += key.length * 2 // Unicode chars
      size += JSON.stringify(item.data).length * 2
      size += 32 // Overhead for metadata
    })
    return size
  }

  // Helper to create cache key
  static key(prefix: string, ...parts: (string | number | undefined)[]): string {
    const validParts = parts.filter(p => p !== undefined)
    return `${prefix}:${validParts.join(':')}`
  }
}

// Cache tags for different data types
export const CacheTags = {
  USER: (userId: string) => `user:${userId}`,
  PORTFOLIO: (userId: string) => `portfolio:${userId}`,
  HOLDINGS: (userId: string) => `holdings:${userId}`,
  ASSETS: 'assets',
  ACCOUNTS: (userId: string) => `accounts:${userId}`,
  EVENTS: (userId: string) => `events:${userId}`,
} as const

// Global enhanced cache instance
export const cache = new EnhancedCache()

// Track ongoing calls to prevent duplicate requests
const ongoingCalls = new Map<string, Promise<unknown>>()

// Enhanced cached wrapper with tags support
export function withCache<T extends unknown[], R>(
  fn: (...args: T) => Promise<R>,
  keyGenerator: (...args: T) => string,
  options: CacheOptions = {}
) {
  return async (...args: T): Promise<R> => {
    const key = keyGenerator(...args)
    
    // Check cache first
    const cached = cache.get<R>(key)
    if (cached !== null) {
      console.log(`[Cache] Hit: ${key}`)
      return cached
    }

    // Check if there's an ongoing call for this key
    if (ongoingCalls.has(key)) {
      console.log(`[Cache] Waiting for ongoing: ${key}`)
      return await ongoingCalls.get(key)! as Promise<R>
    }

    console.log(`[Cache] Miss: ${key}`)
    
    // Create promise and track it
    const promise = (async () => {
      try {
        const result = await fn(...args)
        cache.set(key, result, options)
        console.log(`[Cache] Stored: ${key}`)
        return result
      } catch (error) {
        console.warn(`[Cache] Error for ${key}:`, error)
        throw error
      } finally {
        ongoingCalls.delete(key)
      }
    })()
    
    ongoingCalls.set(key, promise)
    return await promise
  }
}

// Automatic cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    cache.cleanup()
    const stats = cache.getStats()
    console.log('[Cache] Cleanup completed:', stats)
  }, 5 * 60 * 1000)
}