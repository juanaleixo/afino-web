import * as React from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Breadcrumbs } from "@/components/ui/breadcrumbs"
import { ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import ThemeSwitch from "@/components/ThemeSwitch"

interface BreadcrumbItem {
  label: string
  href?: string
}

interface PageHeaderProps extends React.HTMLAttributes<HTMLElement> {
  title: string
  description?: string
  icon?: React.ReactNode
  backHref?: string
  backLabel?: string
  breadcrumbs?: BreadcrumbItem[]
  actions?: React.ReactNode
}

const PageHeader = React.forwardRef<HTMLElement, PageHeaderProps>(
  ({
    className,
    title,
    description,
    icon,
    backHref,
    backLabel = "Voltar",
    breadcrumbs,
    actions,
    ...props
  }, ref) => {
    return (
      <header className={cn("dashboard-nav", className)} ref={ref} {...props}>
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {backHref && (
                <Link href={backHref}>
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    {backLabel}
                  </Button>
                </Link>
              )}
              
              <div className="flex flex-col gap-2">
                {breadcrumbs && (
                  <Breadcrumbs items={breadcrumbs} />
                )}
                
                <div className="flex items-center space-x-2">
                  {icon && <span className="text-primary">{icon}</span>}
                  <h1 className="text-2xl font-bold">{title}</h1>
                </div>
                
                {description && (
                  <p className="text-sm text-muted-foreground">{description}</p>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <ThemeSwitch />
              {actions && actions}
            </div>
          </div>
        </div>
      </header>
    )
  }
)
PageHeader.displayName = "PageHeader"

export { PageHeader }