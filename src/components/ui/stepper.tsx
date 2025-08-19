import * as React from "react"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

interface StepperProps extends React.HTMLAttributes<HTMLDivElement> {
  steps: string[]
  currentStep: number
}

const Stepper = React.forwardRef<HTMLDivElement, StepperProps>(
  ({ className, steps, currentStep, ...props }, ref) => {
    return (
      <div className={cn("flex items-center", className)} ref={ref} {...props}>
        {steps.map((step, index) => (
          <React.Fragment key={index}>
            <div className="flex flex-col items-center gap-2">
              <div
                className={cn(
                  "flex items-center justify-center w-8 h-8 rounded-full border-2 text-sm font-medium",
                  {
                    "bg-primary border-primary text-primary-foreground": index < currentStep,
                    "border-primary text-primary": index === currentStep,
                    "border-muted text-muted-foreground": index > currentStep,
                  }
                )}
              >
                {index < currentStep ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <span>{index + 1}</span>
                )}
              </div>
              <span
                className={cn(
                  "text-xs font-medium text-center max-w-20",
                  {
                    "text-foreground": index <= currentStep,
                    "text-muted-foreground": index > currentStep,
                  }
                )}
              >
                {step}
              </span>
            </div>
            
            {index < steps.length - 1 && (
              <div
                className={cn(
                  "flex-1 h-0.5 mx-4",
                  {
                    "bg-primary": index < currentStep,
                    "bg-muted": index >= currentStep,
                  }
                )}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    )
  }
)
Stepper.displayName = "Stepper"

export { Stepper }