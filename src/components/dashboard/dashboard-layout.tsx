import * as React from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { PageHeader } from "./page-header"
import { cn } from "@/lib/utils"

interface BreadcrumbItem {
  label: string
  href?: string
}

interface DashboardLayoutProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  description?: string
  icon?: React.ReactNode
  backHref?: string
  backLabel?: string
  breadcrumbs?: BreadcrumbItem[]
  actions?: React.ReactNode
  children: React.ReactNode
}

const DashboardLayout = React.forwardRef<HTMLDivElement, DashboardLayoutProps>(
  ({
    className,
    title,
    description,
    icon,
    backHref,
    backLabel,
    breadcrumbs,
    actions,
    children,
    ...props
  }, ref) => {
    return (
      <ProtectedRoute>
        <div className={cn("min-h-screen bg-background", className)} ref={ref} {...props}>
          <PageHeader
            title={title}
            description={description}
            icon={icon}
            backHref={backHref}
            backLabel={backLabel}
            breadcrumbs={breadcrumbs}
            actions={actions}
          />
          
          <main className="dashboard-page">
            {children}
          </main>
        </div>
      </ProtectedRoute>
    )
  }
)
DashboardLayout.displayName = "DashboardLayout"

export { DashboardLayout }