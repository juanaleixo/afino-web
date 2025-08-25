import * as React from "react"
import { cn } from "@/lib/utils"

interface GradientTextProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "primary" | "secondary" | "accent" | "rainbow" | "financial"
  animated?: boolean
}

const GradientText = React.forwardRef<HTMLSpanElement, GradientTextProps>(
  ({ className, variant = "primary", animated = false, children, ...props }, ref) => {
    const gradients = {
      primary: "bg-gradient-to-r from-primary via-blue-600 to-purple-600",
      secondary: "bg-gradient-to-r from-secondary via-gray-600 to-slate-600",
      accent: "bg-gradient-to-r from-accent via-teal-600 to-cyan-600",
      rainbow: "bg-gradient-to-r from-red-500 via-yellow-500 via-green-500 via-blue-500 to-purple-500",
      financial: "bg-gradient-to-r from-emerald-600 via-green-600 to-teal-600"
    }

    return (
      <span
        ref={ref}
        className={cn(
          gradients[variant],
          "bg-clip-text text-transparent",
          animated && "animate-pulse",
          className
        )}
        {...props}
      >
        {children}
      </span>
    )
  }
)

GradientText.displayName = "GradientText"

export { GradientText }