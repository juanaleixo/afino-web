'use client'

import { Crown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface PremiumBadgeProps {
  variant?: 'default' | 'outline'
  size?: 'sm' | 'default'
  className?: string
}

export function PremiumBadge({ 
  variant = 'default', 
  size = 'default',
  className 
}: PremiumBadgeProps) {
  return (
    <Badge 
      variant={variant}
      className={cn(
        "bg-gradient-to-r from-yellow-500 to-orange-500 text-white border-0",
        size === 'sm' && "text-xs px-2 py-0.5",
        variant === 'outline' && "bg-transparent border border-yellow-500 text-yellow-700",
        className
      )}
    >
      <Crown className={cn("mr-1", size === 'sm' ? "h-3 w-3" : "h-4 w-4")} />
      Premium
    </Badge>
  )
}