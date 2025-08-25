/**
 * Analytics utilities for Afino Finance
 * Tracks user behavior and business metrics
 */

interface AnalyticsEvent {
  name: string
  properties?: Record<string, unknown>
  timestamp?: number
}

interface UserProperties {
  userId?: string
  email?: string
  plan?: 'free' | 'premium' | 'enterprise'
  accountCount?: number
  assetCount?: number
  firstSeen?: string
  lastSeen?: string
}

class Analytics {
  private queue: AnalyticsEvent[] = []
  private isInitialized = false
  private userProperties: UserProperties = {}
  
  // Initialize analytics (call once on app start)
  init(config?: { debug?: boolean }) {
    if (this.isInitialized) return
    
    this.isInitialized = true
    
    // Initialize PostHog or other analytics service
    if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_POSTHOG_API_KEY) {
      // TODO: Initialize PostHog
      // import posthog from 'posthog-js'
      // posthog.init(process.env.NEXT_PUBLIC_POSTHOG_API_KEY)
    }
    
    // Process queued events
    this.flushQueue()
    
    if (config?.debug) {
      console.log('Analytics initialized')
    }
  }
  
  // Track custom events
  track(eventName: string, properties?: Record<string, unknown>) {
    const event: AnalyticsEvent = {
      name: eventName,
      properties: {
        ...properties,
        timestamp: Date.now(),
        environment: process.env.NEXT_PUBLIC_ENVIRONMENT,
      },
      timestamp: Date.now(),
    }
    
    if (!this.isInitialized) {
      this.queue.push(event)
      return
    }
    
    this.sendEvent(event)
  }
  
  // Identify user
  identify(userId: string, traits?: Partial<UserProperties>) {
    this.userProperties = {
      ...this.userProperties,
      userId,
      ...traits,
      lastSeen: new Date().toISOString(),
    }
    
    if (!this.userProperties.firstSeen) {
      this.userProperties.firstSeen = new Date().toISOString()
    }
    
    // Send to analytics service
    if (this.isInitialized && typeof window !== 'undefined') {
      // TODO: Send to PostHog
      // posthog.identify(userId, this.userProperties)
    }
    
    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('User identified:', userId, traits)
    }
  }
  
  // Page view tracking
  page(pageName?: string, properties?: Record<string, unknown>) {
    const url = typeof window !== 'undefined' ? window.location.href : ''
    const title = typeof document !== 'undefined' ? document.title : ''
    
    this.track('page_view', {
      page: pageName || title,
      url,
      referrer: typeof document !== 'undefined' ? document.referrer : '',
      ...properties,
    })
  }
  
  // Track timing events
  timing(category: string, variable: string, value: number) {
    this.track('timing', {
      timing_category: category,
      timing_variable: variable,
      timing_value: value,
    })
  }
  
  // Business metrics
  metrics = {
    // Portfolio events
    portfolioViewed: (timeRange: string, value: number) => {
      this.track('portfolio_viewed', { timeRange, totalValue: value })
    },
    
    // Transaction events
    transactionCreated: (type: string, amount: number, assetId: string) => {
      this.track('transaction_created', { type, amount, assetId })
    },
    
    transactionDeleted: (type: string, transactionId: string) => {
      this.track('transaction_deleted', { type, transactionId })
    },
    
    // Account events
    accountCreated: (currency: string) => {
      this.track('account_created', { currency })
    },
    
    accountUpdated: (accountId: string) => {
      this.track('account_updated', { accountId })
    },
    
    // Asset events
    assetAdded: (assetClass: string, symbol: string) => {
      this.track('asset_added', { assetClass, symbol })
    },
    
    // Feature usage
    featureUsed: (feature: string, details?: Record<string, unknown>) => {
      this.track('feature_used', { feature, ...details })
    },
    
    // Export events
    dataExported: (format: string, recordCount: number) => {
      this.track('data_exported', { format, recordCount })
    },
    
    // Plan events
    planUpgraded: (fromPlan: string, toPlan: string) => {
      this.track('plan_upgraded', { fromPlan, toPlan })
    },
    
    planDowngraded: (fromPlan: string, toPlan: string) => {
      this.track('plan_downgraded', { fromPlan, toPlan })
    },
    
    // Error tracking
    errorOccurred: (error: string, context?: Record<string, unknown>) => {
      this.track('error_occurred', { error, ...context })
    },
  }
  
  // Private methods
  private sendEvent(event: AnalyticsEvent) {
    // Send to analytics service
    if (typeof window !== 'undefined') {
      // TODO: Send to PostHog
      // posthog.capture(event.name, event.properties)
    }
    
    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.log('Analytics event:', event.name, event.properties)
    }
  }
  
  private flushQueue() {
    while (this.queue.length > 0) {
      const event = this.queue.shift()
      if (event) {
        this.sendEvent(event)
      }
    }
  }
}

// Singleton instance
export const analytics = new Analytics()

// React hooks
import { useEffect } from 'react'
import { usePathname } from 'next/navigation'

export function usePageTracking() {
  const pathname = usePathname()
  
  useEffect(() => {
    analytics.page(pathname)
  }, [pathname])
}

export function useAnalytics() {
  return analytics
}

// Performance tracking decorator
export function trackTiming(category: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    
    descriptor.value = async function (...args: any[]) {
      const start = performance.now()
      try {
        const result = await originalMethod.apply(this, args)
        const duration = performance.now() - start
        analytics.timing(category, propertyName, duration)
        return result
      } catch (error) {
        const duration = performance.now() - start
        analytics.timing(category, `${propertyName}_error`, duration)
        throw error
      }
    }
    
    return descriptor
  }
}