import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { 
  TrendingUp, 
  Bitcoin, 
  DollarSign, 
  FileText, 
  Building, 
  Package,
  Car,
  PiggyBank,
  Banknote
} from "lucide-react"

const assetBadgeVariants = cva(
  "inline-flex items-center gap-1.5 font-medium rounded-md px-2 py-1",
  {
    variants: {
      assetClass: {
        stock: "asset-stock",
        crypto: "asset-crypto", 
        currency: "asset-currency",
        cash: "asset-currency",
        bond: "asset-bond",
        fund: "asset-fund",
        reit: "asset-reit",
        "real-estate": "asset-real-estate",
        real_estate: "asset-real-estate",
        commodity: "asset-commodity",
        vehicle: "asset-vehicle",
        unknown: "asset-stock", // Use stock styling as fallback
        etf: "asset-fund", // Use fund styling for ETFs
        default: "bg-muted text-muted-foreground",
      },
      size: {
        default: "text-xs",
        sm: "text-xs px-1.5 py-0.5",
        lg: "text-sm px-3 py-1.5",
      },
    },
    defaultVariants: {
      assetClass: "default",
      size: "default",
    },
  }
)

const assetIcons = {
  stock: TrendingUp,
  crypto: Bitcoin,
  currency: DollarSign,
  cash: Banknote,
  bond: FileText,
  fund: PiggyBank,
  reit: Building,
  "real-estate": Building,
  real_estate: Building,
  commodity: Package,
  vehicle: Car,
  unknown: TrendingUp,
  etf: PiggyBank,
}

const assetLabels = {
  stock: "Ação",
  crypto: "Cripto",
  currency: "Caixa",
  cash: "Dinheiro",
  bond: "Título",
  fund: "Fundo",
  reit: "REIT",
  "real-estate": "Imóvel",
  real_estate: "Imóvel", 
  commodity: "Commodity",
  vehicle: "Veículo",
  unknown: "Ativo",
  etf: "ETF",
}

export interface AssetBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof assetBadgeVariants> {
  symbol?: string
  showIcon?: boolean
  showLabel?: boolean
}

const AssetBadge = React.forwardRef<HTMLSpanElement, AssetBadgeProps>(
  ({ className, assetClass, size, symbol, showIcon = true, showLabel = true, children, ...props }, ref) => {
    const IconComponent = assetClass && assetClass !== "default" ? assetIcons[assetClass] : null
    const label = assetClass && assetClass !== "default" ? assetLabels[assetClass] : "Desconhecido"

    return (
      <span
        className={cn(assetBadgeVariants({ assetClass, size }), className)}
        ref={ref}
        {...props}
      >
        {showIcon && IconComponent && <IconComponent className="w-3 h-3" />}
        {showLabel ? label : symbol}
        {children}
      </span>
    )
  }
)
AssetBadge.displayName = "AssetBadge"

export { AssetBadge, assetBadgeVariants }
