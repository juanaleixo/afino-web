/**
 * Serviço centralizado de cache para sessionStorage
 * Centraliza 50+ linhas de lógica de cache repetida
 */

export interface CacheOptions {
  ttl?: number // Time to live em milliseconds
  version?: string // Para invalidação de versão
}

export interface CacheItem<T> {
  value: T
  expires: number
  version: string
}

export class CacheService {
  private static readonly DEFAULT_TTL = 15 * 60 * 1000 // 15 minutos
  private static readonly DEFAULT_VERSION = '1.0'
  
  static get<T>(key: string): T | null {
    try {
      const item = sessionStorage.getItem(key)
      if (!item) return null
      
      const { value, expires, version }: CacheItem<T> = JSON.parse(item)
      
      if (Date.now() > expires) {
        this.remove(key)
        return null
      }
      
      return value
    } catch (error) {
      console.warn(`Failed to get cache item for key ${key}:`, error)
      return null
    }
  }

  static set<T>(key: string, value: T, options: CacheOptions = {}): void {
    try {
      const expires = Date.now() + (options.ttl ?? this.DEFAULT_TTL)
      const item: CacheItem<T> = {
        value,
        expires,
        version: options.version ?? this.DEFAULT_VERSION
      }
      sessionStorage.setItem(key, JSON.stringify(item))
    } catch (error) {
      console.warn(`Failed to cache item for key ${key}:`, error)
    }
  }

  static remove(key: string): void {
    try {
      sessionStorage.removeItem(key)
    } catch (error) {
      console.warn(`Failed to remove cache item for key ${key}:`, error)
    }
  }

  static invalidate(pattern: string): void {
    try {
      const keysToDelete: string[] = []
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key && key.includes(pattern)) {
          keysToDelete.push(key)
        }
      }
      keysToDelete.forEach(key => this.remove(key))
    } catch (error) {
      console.warn(`Failed to invalidate cache with pattern ${pattern}:`, error)
    }
  }

  static clear(): void {
    try {
      sessionStorage.clear()
    } catch (error) {
      console.warn('Failed to clear cache:', error)
    }
  }

  static generateKey(prefix: string, userId: string, params: Record<string, any> = {}): string {
    const paramString = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join('|')
    return `${prefix}-${userId}${paramString ? `-${paramString}` : ''}`
  }

  static has(key: string): boolean {
    try {
      const item = sessionStorage.getItem(key)
      if (!item) return false
      
      const { expires }: CacheItem<any> = JSON.parse(item)
      
      if (Date.now() > expires) {
        this.remove(key)
        return false
      }
      
      return true
    } catch (error) {
      console.warn(`Failed to check cache existence for key ${key}:`, error)
      return false
    }
  }

  static getWithFallback<T>(key: string, fallbackFn: () => Promise<T>, options: CacheOptions = {}): Promise<T> {
    const cached = this.get<T>(key)
    if (cached !== null) {
      return Promise.resolve(cached)
    }
    
    return fallbackFn().then(value => {
      this.set(key, value, options)
      return value
    })
  }

  static invalidateByPrefix(prefix: string): void {
    this.invalidate(prefix)
  }

  static getSize(): number {
    try {
      let size = 0
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i)
        if (key) {
          const item = sessionStorage.getItem(key)
          if (item) {
            size += key.length + item.length
          }
        }
      }
      return size
    } catch (error) {
      console.warn('Failed to calculate cache size:', error)
      return 0
    }
  }
}