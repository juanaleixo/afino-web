import * as React from "react"
import { Button, ButtonProps } from "./button"
import { cn } from "@/lib/utils"

interface AnimatedButtonProps extends Omit<ButtonProps, 'variant'> {
  variant?: ButtonProps["variant"] | "gradient" | "glow"
  animated?: boolean
  shimmer?: boolean
}

const AnimatedButton = React.forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  ({ className, variant = "default", animated = true, shimmer = false, children, ...props }, ref) => {
    const baseClasses = animated ? "transition-all duration-300 transform hover:scale-105 hover:-translate-y-0.5" : ""
    
    const variantClasses = {
      gradient: "btn-gradient shadow-lg hover:shadow-xl",
      glow: "relative overflow-hidden hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.5)]"
    }

    const isCustomVariant = variant === "gradient" || variant === "glow"
    const buttonVariant = isCustomVariant ? "default" : variant

    return (
      <Button
        ref={ref}
        variant={buttonVariant}
        className={cn(
          baseClasses,
          isCustomVariant && variantClasses[variant as keyof typeof variantClasses],
          shimmer && "relative overflow-hidden",
          className
        )}
        {...props}
      >
        {shimmer && (
          <div className="absolute inset-0 -top-[2px] bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer-wave" />
        )}
        <span className="relative z-10 flex items-center">
          {children}
        </span>
      </Button>
    )
  }
)

AnimatedButton.displayName = "AnimatedButton"

export { AnimatedButton }