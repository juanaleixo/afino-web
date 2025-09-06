import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge" 
import { Zap, LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

export interface StatsCardProps {
  title: string
  value: string | number
  description?: string
  icon: LucideIcon
  color?: string
  premium?: boolean
  loading?: boolean
  className?: string
  trend?: 'up' | 'down' | 'neutral'
  change?: string
  changeDescription?: string
}

export function StatsCard({
  title,
  value,
  description,
  icon: IconComponent,
  color = "text-primary",
  premium = false,
  loading = false,
  className,
  trend = 'neutral',
  change,
  changeDescription
}: StatsCardProps) {
  
  if (loading) {
    return (
      <Card className={cn("card-hover", className)}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="h-4 w-4 bg-gray-200 rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-8 w-32 bg-gray-200 rounded animate-pulse mb-1" />
          <div className="h-3 w-20 bg-gray-100 rounded animate-pulse" />
        </CardContent>
      </Card>
    )
  }

  const trendColors = {
    up: 'text-green-600',
    down: 'text-red-600', 
    neutral: color
  }

  const actualColor = trendColors[trend] || color

  return (
    <Card className={cn("card-hover", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center space-x-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          {premium && (
            <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
              <Zap className="h-2 w-2 mr-1" />
              Premium
            </Badge>
          )}
        </div>
        <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10">
          <IconComponent className={cn("h-4 w-4", actualColor)} />
        </div>
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold", actualColor)}>
          {value}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">
            {description}
          </p>
        )}
        {change && (
          <div className="mt-2 flex items-center space-x-2">
            <span className={cn("text-sm font-medium", actualColor)}>
              {change}
            </span>
            {changeDescription && (
              <span className="text-xs text-muted-foreground">
                {changeDescription}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// Componente para grid de cards com animação
export interface StatsCardGridProps {
  cards: StatsCardProps[]
  loading?: boolean
  columns?: {
    default?: number
    sm?: number
    md?: number
    lg?: number
    xl?: number
  }
  className?: string
}

export function StatsCardGrid({
  cards,
  loading = false,
  columns = {
    default: 1,
    md: 2,
    lg: 4
  },
  className
}: StatsCardGridProps) {
  const getGridClass = () => {
    const classes = ['grid', 'gap-4']
    
    if (columns.default) classes.push(`grid-cols-${columns.default}`)
    if (columns.sm) classes.push(`sm:grid-cols-${columns.sm}`)
    if (columns.md) classes.push(`md:grid-cols-${columns.md}`)
    if (columns.lg) classes.push(`lg:grid-cols-${columns.lg}`)
    if (columns.xl) classes.push(`xl:grid-cols-${columns.xl}`)
    
    return classes.join(' ')
  }

  return (
    <div className={cn(getGridClass(), className)}>
      {cards.map((card, index) => (
        <StatsCard
          key={`${card.title}-${index}`}
          {...card}
          loading={loading}
        />
      ))}
    </div>
  )
}