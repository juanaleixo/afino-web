/**
 * Skeleton otimizado para carregamento rápido
 * Aparece instantaneamente e simula a interface real
 */

import { cn } from "@/lib/utils"

interface SkeletonProps {
  variant: 'dashboard' | 'timeline' | 'stats' | 'chart'
  className?: string
}

// Skeleton que simula exatamente a interface do dashboard
export function DashboardSkeleton({ variant, className }: SkeletonProps) {
  if (variant === 'dashboard') {
    return (
      <div className={cn("animate-pulse space-y-6", className)}>
        {/* Stats Grid Skeleton */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="h-4 bg-muted rounded w-24"></div>
                <div className="h-6 w-6 bg-muted rounded"></div>
              </div>
              <div className="space-y-2">
                <div className="h-8 bg-muted rounded w-32"></div>
                <div className="h-4 bg-muted rounded w-20"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Chart Section Skeleton */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="h-7 bg-muted rounded w-48 mb-2"></div>
              <div className="h-4 bg-muted rounded w-64"></div>
            </div>
            <div className="h-10 bg-muted rounded w-32"></div>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <div className="h-64 bg-muted rounded flex items-center justify-center">
              <div className="space-y-2 text-center">
                <div className="h-4 bg-muted-foreground/20 rounded w-32 mx-auto"></div>
                <div className="h-3 bg-muted-foreground/20 rounded w-48 mx-auto"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (variant === 'timeline') {
    return (
      <div className={cn("animate-pulse space-y-6", className)}>
        {/* Filters Skeleton */}
        <div className="flex flex-wrap gap-4 p-4 bg-card rounded-lg border">
          <div className="h-10 bg-muted rounded w-24"></div>
          <div className="h-10 bg-muted rounded w-32"></div>
          <div className="h-10 bg-muted rounded w-28"></div>
        </div>

        {/* Stats Row Skeleton */}
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-lg border bg-card p-4">
              <div className="h-4 bg-muted rounded w-20 mb-2"></div>
              <div className="h-6 bg-muted rounded w-24"></div>
            </div>
          ))}
        </div>

        {/* Large Chart Skeleton */}
        <div className="rounded-lg border bg-card p-6">
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </div>
    )
  }

  if (variant === 'stats') {
    return (
      <div className={cn("animate-pulse", className)}>
        <div className="space-y-2">
          <div className="h-6 bg-muted rounded w-24"></div>
          <div className="h-4 bg-muted rounded w-16"></div>
        </div>
      </div>
    )
  }

  if (variant === 'chart') {
    return (
      <div className={cn("animate-pulse h-64 bg-muted rounded flex items-center justify-center", className)}>
        <div className="space-y-4 w-full max-w-md">
          {/* Simula barras de gráfico */}
          <div className="flex items-end justify-between h-32 px-4">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={i}
                className="bg-muted-foreground/20 rounded-t"
                style={{
                  height: `${Math.random() * 80 + 20}%`,
                  width: '6px'
                }}
              ></div>
            ))}
          </div>

          {/* Simula labels */}
          <div className="flex justify-between px-4">
            <div className="h-3 bg-muted-foreground/20 rounded w-8"></div>
            <div className="h-3 bg-muted-foreground/20 rounded w-8"></div>
            <div className="h-3 bg-muted-foreground/20 rounded w-8"></div>
            <div className="h-3 bg-muted-foreground/20 rounded w-8"></div>
          </div>
        </div>
      </div>
    )
  }

  return null
}

// Skeleton específico para cards de stats
export function StatsSkeleton() {
  return <DashboardSkeleton variant="stats" />
}

// Skeleton específico para gráficos
export function ChartSkeleton() {
  return <DashboardSkeleton variant="chart" />
}