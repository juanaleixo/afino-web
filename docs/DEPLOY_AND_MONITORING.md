# Deployment & Operations Guide

## Overview

This guide covers deployment procedures, monitoring, and operational best practices for Afino Finance.

## Table of Contents

1. [Deployment Process](#deployment-process)
2. [Environment Configuration](#environment-configuration)
3. [Monitoring & Observability](#monitoring--observability)
4. [Performance Optimization](#performance-optimization)
5. [Backup & Recovery](#backup--recovery)
6. [Incident Response](#incident-response)

## Deployment Process

### Prerequisites

- Node.js 20.x
- npm 10.x
- Vercel CLI (for manual deploys)
- Access to Supabase project

### Automated Deployment

Deployments are automated via GitHub Actions:

1. **Development** → Push to `develop` branch → Auto-deploy to staging
2. **Production** → Push to `main` branch → Auto-deploy to production

### Manual Deployment

```bash
# Install dependencies
npm ci

# Run tests
npm test

# Build application
npm run build

# Deploy to staging
npm run deploy:preview

# Deploy to production
npm run deploy:production
```

### Rollback Procedure

1. **Via Vercel Dashboard:**
   - Navigate to deployments
   - Find previous stable deployment
   - Click "Promote to Production"

2. **Via Git:**
   ```bash
   # Revert to previous commit
   git revert HEAD
   git push origin main
   ```

## Environment Configuration

### Required Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ... # Server-side only

# Application
NEXT_PUBLIC_APP_URL=https://afino.finance
NEXT_PUBLIC_ENVIRONMENT=production

# Monitoring (optional)
SENTRY_DSN=https://...@sentry.io/...
POSTHOG_API_KEY=phc_...

# Feature Flags
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_PREMIUM_FEATURES=true
```

### Environment-Specific Configs

#### Development
```env
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### Staging
```env
NEXT_PUBLIC_ENVIRONMENT=staging
NEXT_PUBLIC_APP_URL=https://staging.afino.finance
```

#### Production
```env
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_APP_URL=https://afino.finance
```

## Monitoring & Observability

### Key Metrics to Monitor

1. **Application Performance**
   - Response times (p50, p95, p99)
   - Error rates
   - Throughput (requests/second)
   - Web Vitals (LCP, FID, CLS)

2. **Business Metrics**
   - Active users
   - Events created per day
   - Portfolio calculations performed
   - Plan conversion rate

3. **Infrastructure**
   - Database connection pool
   - Cache hit rate
   - CDN cache ratio
   - Build times

### Monitoring Tools

#### 1. Application Monitoring

```typescript
// Install monitoring in _app.tsx or layout.tsx
import * as Sentry from '@sentry/nextjs'
import posthog from 'posthog-js'

// Sentry for error tracking
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_ENVIRONMENT,
  tracesSampleRate: 0.1,
})

// PostHog for analytics
if (typeof window !== 'undefined') {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_API_KEY!, {
    api_host: 'https://app.posthog.com',
  })
}
```

#### 2. Custom Performance Monitoring

```typescript
import { performanceMonitor } from '@/lib/utils/performance'

// Track API calls
const data = await performanceMonitor.trackApiCall('fetchPortfolio', async () => {
  return await supabase.rpc('api_portfolio_daily', { from, to })
})

// Log performance report
performanceMonitor.logReport()
```

#### 3. Database Monitoring

```sql
-- Query performance stats
SELECT 
  query,
  calls,
  mean_exec_time,
  total_exec_time
FROM pg_stat_statements
WHERE query LIKE '%api_%'
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Active connections
SELECT count(*) FROM pg_stat_activity;

-- Cache hit ratio
SELECT 
  sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)) as cache_hit_ratio
FROM pg_statio_user_tables;
```

### Alerts Configuration

Configure alerts for critical metrics:

1. **Error Rate** > 1% → Page team
2. **Response Time p95** > 3s → Warning
3. **Database Connections** > 80% → Scale up
4. **Cache Hit Rate** < 80% → Investigate
5. **Failed Deployments** → Rollback

## Performance Optimization

### Frontend Optimization

1. **Code Splitting**
   ```typescript
   // Dynamic imports for heavy components
   const PortfolioChart = dynamic(() => import('@/components/PortfolioChart'), {
     loading: () => <ChartSkeleton />,
     ssr: false
   })
   ```

2. **Image Optimization**
   ```typescript
   import Image from 'next/image'
   
   <Image
     src="/logo.png"
     alt="Logo"
     width={200}
     height={50}
     priority
   />
   ```

3. **Bundle Analysis**
   ```bash
   # Analyze bundle size
   npm run build
   npx @next/bundle-analyzer
   ```

### Backend Optimization

1. **Database Query Optimization**
   - Use indexes effectively
   - Batch operations when possible
   - Cache frequently accessed data

2. **API Response Caching**
   ```typescript
   // Cache portfolio data
   export const getPortfolioData = withCache(
     async (userId: string, date: string) => {
       return await supabase.rpc('api_portfolio_summary', { p_date: date })
     },
     (userId, date) => `portfolio:${userId}:${date}`,
     { ttl: 5 * 60 * 1000, tags: [CacheTags.PORTFOLIO(userId)] }
   )
   ```

3. **Connection Pooling**
   - Configure Supabase connection pool
   - Use persistent connections
   - Monitor pool exhaustion

## Backup & Recovery

### Database Backups

1. **Automated Backups**
   - Supabase performs daily backups
   - 30-day retention for Pro plan
   - Point-in-time recovery available

2. **Manual Backup**
   ```bash
   # Export database
   pg_dump -h [host] -U postgres -d postgres > backup_$(date +%Y%m%d).sql
   
   # Export specific tables
   pg_dump -h [host] -U postgres -d postgres \
     -t events -t accounts -t daily_positions_acct \
     > data_backup_$(date +%Y%m%d).sql
   ```

3. **Restore Procedure**
   ```bash
   # Restore from backup
   psql -h [host] -U postgres -d postgres < backup_20240101.sql
   ```

### Application State Backup

```typescript
// Export user data
export async function exportUserData(userId: string) {
  const { data: events } = await supabase
    .from('events')
    .select('*')
    .eq('user_id', userId)
    
  const { data: accounts } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId)
    
  return {
    exportDate: new Date().toISOString(),
    userId,
    events,
    accounts,
  }
}
```

## Incident Response

### Incident Levels

1. **P1 - Critical**: Service down, data loss risk
2. **P2 - High**: Major feature broken, significant performance degradation
3. **P3 - Medium**: Minor feature broken, moderate performance impact
4. **P4 - Low**: Cosmetic issues, minor bugs

### Response Procedures

#### P1 Incident Response

1. **Immediate Actions** (0-15 min)
   - Acknowledge incident
   - Assess impact scope
   - Initiate rollback if needed
   - Notify stakeholders

2. **Mitigation** (15-60 min)
   - Implement temporary fix
   - Monitor system stability
   - Communicate status updates

3. **Resolution** (1-4 hours)
   - Deploy permanent fix
   - Verify resolution
   - Document incident

4. **Post-Mortem** (within 48 hours)
   - Root cause analysis
   - Timeline of events
   - Action items to prevent recurrence

### Common Issues & Solutions

#### High Database Load
```sql
-- Kill long-running queries
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'active' 
AND query_start < NOW() - INTERVAL '5 minutes';

-- Reset connection pool
-- Via Supabase dashboard or API
```

#### Memory Leaks
```typescript
// Monitor memory usage
if (process.memoryUsage().heapUsed > 500 * 1024 * 1024) {
  console.warn('High memory usage detected')
  // Clear caches
  cache.clear()
  // Force garbage collection if available
  if (global.gc) global.gc()
}
```

#### API Rate Limiting
```typescript
// Implement exponential backoff
async function retryWithBackoff(fn: () => Promise<any>, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, i) * 1000))
    }
  }
}
```

## Health Checks

### Application Health Endpoint

```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = {
    app: 'ok',
    database: 'unknown',
    cache: 'unknown',
    timestamp: new Date().toISOString()
  }
  
  try {
    // Check database
    await supabase.from('accounts').select('count').limit(1)
    checks.database = 'ok'
  } catch {
    checks.database = 'error'
  }
  
  try {
    // Check cache
    cache.set('health-check', true, { ttl: 1000 })
    if (cache.get('health-check')) {
      checks.cache = 'ok'
    }
  } catch {
    checks.cache = 'error'
  }
  
  const status = Object.values(checks).includes('error') ? 503 : 200
  return Response.json(checks, { status })
}
```

### Monitoring Dashboard

Create a monitoring dashboard with:
- Real-time metrics
- Error logs
- Performance trends
- User activity
- System health status

## Continuous Improvement

1. **Weekly Reviews**
   - Performance metrics analysis
   - Error rate trends
   - User feedback review

2. **Monthly Optimization**
   - Database index review
   - Bundle size optimization
   - Dependency updates

3. **Quarterly Planning**
   - Capacity planning
   - Architecture review
   - Security audit