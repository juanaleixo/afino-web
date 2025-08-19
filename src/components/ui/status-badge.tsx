import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1 font-medium",
  {
    variants: {
      variant: {
        success: "status-positive",
        warning: "bg-warning/10 text-warning",
        info: "bg-info/10 text-info",
        error: "status-negative",
        neutral: "status-neutral",
      },
      size: {
        default: "text-xs px-2 py-1",
        sm: "text-xs px-1.5 py-0.5",
        lg: "text-sm px-3 py-1.5",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "default",
    },
  }
)

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  icon?: React.ReactNode
}

const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ className, variant, size, icon, children, ...props }, ref) => {
    return (
      <span
        className={cn(statusBadgeVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      >
        {icon && <span className="w-3 h-3">{icon}</span>}
        {children}
      </span>
    )
  }
)
StatusBadge.displayName = "StatusBadge"

export { StatusBadge, statusBadgeVariants }