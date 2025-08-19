import * as React from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { cva, type VariantProps } from "class-variance-authority"

const loadingStateVariants = cva(
  "flex items-center justify-center",
  {
    variants: {
      variant: {
        page: "min-h-screen",
        section: "min-h-[200px]",
        inline: "h-auto",
        card: "py-8",
      },
      size: {
        sm: "gap-1",
        default: "gap-2", 
        lg: "gap-3",
      },
    },
    defaultVariants: {
      variant: "inline",
      size: "default",
    },
  }
)

const loadingSpinnerVariants = cva(
  "animate-spin text-muted-foreground",
  {
    variants: {
      size: {
        sm: "h-4 w-4",
        default: "h-6 w-6",
        lg: "h-8 w-8",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

export interface LoadingStateProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof loadingStateVariants> {
  spinnerSize?: VariantProps<typeof loadingSpinnerVariants>["size"]
  message?: string
}

const LoadingState = React.forwardRef<HTMLDivElement, LoadingStateProps>(
  ({ className, variant, size, spinnerSize, message = "Carregando...", ...props }, ref) => {
    return (
      <div
        className={cn(loadingStateVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      >
        <Loader2 className={loadingSpinnerVariants({ size: spinnerSize || size })} />
        {message && (
          <span className="text-sm text-muted-foreground font-medium">
            {message}
          </span>
        )}
      </div>
    )
  }
)
LoadingState.displayName = "LoadingState"

export { LoadingState, loadingStateVariants }