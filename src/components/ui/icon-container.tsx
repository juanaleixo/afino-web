import * as React from "react"
import { cn } from "@/lib/utils"

interface IconContainerProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "primary" | "secondary" | "accent" | "success" | "warning" | "error"
  size?: "sm" | "md" | "lg" | "xl"
  shape?: "rounded" | "circle" | "square"
}

const IconContainer = React.forwardRef<HTMLDivElement, IconContainerProps>(
  ({ className, variant = "default", size = "md", shape = "rounded", children, ...props }, ref) => {
    const variants = {
      default: "bg-muted/50 border border-border",
      primary: "bg-gradient-to-br from-primary/20 to-primary/10 shadow-inner",
      secondary: "bg-gradient-to-br from-secondary/20 to-secondary/10 shadow-inner",
      accent: "bg-gradient-to-br from-accent/20 to-accent/10 shadow-inner",
      success: "bg-gradient-to-br from-green-500/20 to-green-600/10 shadow-inner",
      warning: "bg-gradient-to-br from-yellow-500/20 to-yellow-600/10 shadow-inner",
      error: "bg-gradient-to-br from-red-500/20 to-red-600/10 shadow-inner"
    }

    const sizes = {
      sm: "p-1.5",
      md: "p-2",
      lg: "p-3",
      xl: "p-4"
    }

    const shapes = {
      rounded: "rounded-lg",
      circle: "rounded-full",
      square: "rounded-none"
    }

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center",
          variants[variant],
          sizes[size],
          shapes[shape],
          "transition-all duration-200 hover:scale-105",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)

IconContainer.displayName = "IconContainer"

export { IconContainer }