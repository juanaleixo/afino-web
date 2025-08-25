/**
 * Performance monitoring utilities for Afino Finance
 * Tracks key metrics and provides insights for optimization
 */

interface PerformanceMetric {
  name: string
  value: number
  unit: string
  timestamp: number
}

interface PerformanceReport {
  metrics: PerformanceMetric[]
  summary: {
    avgResponseTime: number
    totalRequests: number
    errorRate: number
    cacheHitRate: number
  }
}

// Extend PerformanceEntry for event timing
interface PerformanceEventTiming extends PerformanceEntry {
  processingStart: number
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = []
  private requestCount = 0
  private errorCount = 0
  private cacheHits = 0
  private cacheMisses = 0

  // Track API call performance
  async trackApiCall<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<T> {
    const start = performance.now()
    this.requestCount++

    try {
      const result = await fn()
      const duration = performance.now() - start
      
      this.recordMetric(name, duration, 'ms')
      
      return result
    } catch (error) {
      this.errorCount++
      throw error
    }
  }

  // Track cache performance
  trackCacheHit(hit: boolean): void {
    if (hit) {
      this.cacheHits++
    } else {
      this.cacheMisses++
    }
  }

  // Record a performance metric
  recordMetric(name: string, value: number, unit: string): void {
    this.metrics.push({
      name,
      value,
      unit,
      timestamp: Date.now()
    })

    // Keep only last 1000 metrics to prevent memory issues
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }
  }

  // Get performance report
  getReport(): PerformanceReport {
    const recentMetrics = this.metrics.filter(
      m => m.timestamp > Date.now() - 5 * 60 * 1000 // Last 5 minutes
    )

    const avgResponseTime = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.value, 0) / recentMetrics.length
      : 0

    const cacheTotal = this.cacheHits + this.cacheMisses
    const cacheHitRate = cacheTotal > 0 ? this.cacheHits / cacheTotal : 0

    return {
      metrics: recentMetrics,
      summary: {
        avgResponseTime,
        totalRequests: this.requestCount,
        errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
        cacheHitRate
      }
    }
  }

  // Reset all metrics
  reset(): void {
    this.metrics = []
    this.requestCount = 0
    this.errorCount = 0
    this.cacheHits = 0
    this.cacheMisses = 0
  }

  // Web Vitals tracking
  trackWebVitals(): void {
    if (typeof window === 'undefined') return

    // First Contentful Paint (FCP)
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === 'first-contentful-paint') {
          this.recordMetric('FCP', entry.startTime, 'ms')
        }
      }
    })
    observer.observe({ entryTypes: ['paint'] })

    // Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      if (entries.length > 0) {
        const lastEntry = entries[entries.length - 1]
        this.recordMetric('LCP', lastEntry.startTime, 'ms')
      }
    })
    lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })

    // First Input Delay (FID)
    const fidObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const eventEntry = entry as PerformanceEventTiming
        if (eventEntry.processingStart && eventEntry.startTime) {
          const fid = eventEntry.processingStart - eventEntry.startTime
          this.recordMetric('FID', fid, 'ms')
        }
      }
    })
    fidObserver.observe({ entryTypes: ['first-input'] })

    // Cumulative Layout Shift (CLS)
    let clsValue = 0
    const clsObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!(entry as any).hadRecentInput) {
          clsValue += (entry as any).value
          this.recordMetric('CLS', clsValue, 'score')
        }
      }
    })
    clsObserver.observe({ entryTypes: ['layout-shift'] })
  }

  // Log performance report to console
  logReport(): void {
    const report = this.getReport()
    console.group('📊 Performance Report')
    console.log('Average Response Time:', report.summary.avgResponseTime.toFixed(2), 'ms')
    console.log('Total Requests:', report.summary.totalRequests)
    console.log('Error Rate:', (report.summary.errorRate * 100).toFixed(2), '%')
    console.log('Cache Hit Rate:', (report.summary.cacheHitRate * 100).toFixed(2), '%')
    console.groupEnd()
  }
}

// Global performance monitor instance
export const performanceMonitor = new PerformanceMonitor()

// Auto-log performance every minute in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  setInterval(() => {
    performanceMonitor.logReport()
  }, 60 * 1000)
  
  // Track web vitals
  performanceMonitor.trackWebVitals()
}

// Export tracking decorator for easy use
export function trackPerformance(target: any, propertyName: string, descriptor: PropertyDescriptor) {
  const method = descriptor.value
  
  descriptor.value = async function (...args: any[]) {
    return performanceMonitor.trackApiCall(
      `${target.constructor.name}.${propertyName}`,
      () => method.apply(this, args)
    )
  }
  
  return descriptor
}