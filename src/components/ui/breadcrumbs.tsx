import * as React from "react"
import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps extends React.HTMLAttributes<HTMLElement> {
  items: BreadcrumbItem[]
}

const Breadcrumbs = React.forwardRef<HTMLElement, BreadcrumbsProps>(
  ({ className, items, ...props }, ref) => {
    return (
      <nav
        aria-label="Trilha de navegação"
        className={cn("breadcrumb-nav", className)}
        ref={ref}
        {...props}
      >
        <ol className="flex items-center gap-1">
          {items.map((item, index) => (
            <li key={index} className="flex items-center gap-1">
              {index > 0 && <ChevronRight className="h-3.5 w-3.5" />}
              {item.href && index !== items.length - 1 ? (
                <Link
                  href={item.href}
                  className="hover:text-foreground transition-colors"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={
                    index === items.length - 1
                      ? "text-foreground font-medium"
                      : "text-muted-foreground"
                  }
                >
                  {item.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
    )
  }
)
Breadcrumbs.displayName = "Breadcrumbs"

export { Breadcrumbs }