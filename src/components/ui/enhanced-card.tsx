import * as React from "react"
import { Card } from "./card"
import { cn } from "@/lib/utils"

interface EnhancedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "gradient" | "glass" | "elevated"
  animated?: boolean
  glow?: boolean
}

const EnhancedCard = React.forwardRef<
  HTMLDivElement,
  EnhancedCardProps
>(({ className, variant = "default", animated = false, glow = false, ...props }, ref) => {
  const baseClasses = "card-hover transition-all duration-300"
  
  const variantClasses = {
    default: "bg-card border",
    gradient: "bg-gradient-to-br from-card/50 to-card backdrop-blur-sm border-0 shadow-lg",
    glass: "bg-card/30 backdrop-blur-md border border-white/20 shadow-xl",
    elevated: "bg-card border shadow-2xl hover:shadow-3xl"
  }
  
  const animatedClasses = animated ? "animate-fade-in-up" : ""
  const glowClasses = glow ? "hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.3)]" : ""

  return (
    <Card
      ref={ref}
      className={cn(
        baseClasses,
        variantClasses[variant],
        animatedClasses,
        glowClasses,
        className
      )}
      {...props}
    />
  )
})

EnhancedCard.displayName = "EnhancedCard"

export { EnhancedCard }