"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { AssetBadge } from "@/components/ui/asset-badge"
import { Asset } from "@/lib/supabase"
import { getAssetDisplayLabel, getAssetClassLabel } from "@/lib/utils/assets"

interface AssetSelectorProps {
  assets: Asset[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  showOnlyCustom?: boolean
  excludeCash?: boolean
}

export function AssetSelector({
  assets,
  value,
  onValueChange,
  placeholder = "Selecionar ativo...",
  disabled = false,
  className,
  showOnlyCustom = false,
  excludeCash = false,
}: AssetSelectorProps) {
  const [open, setOpen] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState("")

  // Separar ativos em categorias
  const customAssets = assets.filter(asset => 
    asset.meta && typeof asset.meta === 'object' && 'is_custom' in asset.meta && asset.meta.is_custom
  )
  const globalAssets = assets.filter(asset => 
    !asset.meta || typeof asset.meta !== 'object' || !('is_custom' in asset.meta) || !asset.meta.is_custom
  )

  // Assets a serem mostrados baseado no filtro
  let assetsToShow = showOnlyCustom ? customAssets : assets
  
  // Filtrar cash/currency se solicitado
  if (excludeCash) {
    assetsToShow = assetsToShow.filter(asset => 
      asset.class !== 'cash' && asset.class !== 'currency'
    )
  }

  // Filtrar assets baseado na pesquisa
  const filteredAssets = React.useMemo(() => {
    if (!searchQuery) return assetsToShow

    const query = searchQuery.toLowerCase()
    return assetsToShow.filter(asset => 
      asset.symbol.toLowerCase().includes(query) ||
      (asset.label_ptbr && asset.label_ptbr.toLowerCase().includes(query)) ||
      getAssetClassLabel(asset.class).toLowerCase().includes(query)
    )
  }, [assetsToShow, searchQuery])

  const selectedAsset = assets.find(asset => asset.id === value)


  // Agrupar assets por categoria para exibição
  const groupedAssets = React.useMemo(() => {
    const groups: { [key: string]: Asset[] } = {}
    filteredAssets.forEach(asset => {
      const classLabel = getAssetClassLabel(asset.class)
      if (!groups[classLabel]) {
        groups[classLabel] = []
      }
      groups[classLabel].push(asset)
    })
    return groups
  }, [filteredAssets])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          {selectedAsset ? (
            <div className="flex items-center gap-2">
              <AssetBadge 
                assetClass={selectedAsset.class as any}
                size="sm"
                showLabel={false}
              />
              <span className="truncate">{getAssetDisplayLabel(selectedAsset)}</span>
              {getAssetDisplayLabel(selectedAsset)?.toUpperCase?.() !== selectedAsset.symbol?.toUpperCase?.() && (
                <span className="text-xs text-muted-foreground">({selectedAsset.symbol})</span>
              )}
            </div>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start">
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
          <Input
            placeholder="Buscar ativo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="border-0 px-0 py-1 focus-visible:ring-0 focus-visible:ring-offset-0"
          />
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {Object.keys(groupedAssets).length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              Nenhum ativo encontrado
            </div>
          ) : (
            Object.entries(groupedAssets).map(([classLabel, classAssets]) => (
              <div key={classLabel}>
                <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/50">
                  {classLabel} ({classAssets.length})
                </div>
                {classAssets.map((asset) => (
                  <button
                    key={asset.id}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                      value === asset.id && "bg-accent text-accent-foreground"
                    )}
                    onClick={() => {
                      onValueChange?.(asset.id)
                      setOpen(false)
                      setSearchQuery("")
                    }}
                  >
                    <AssetBadge 
                      assetClass={asset.class as any}
                      size="sm"
                      showLabel={false}
                    />
                    <div className="flex-1 text-left">
                      <div className="font-medium">{getAssetDisplayLabel(asset)}</div>
                      {getAssetDisplayLabel(asset)?.toUpperCase?.() !== asset.symbol?.toUpperCase?.() && (
                        <div className="text-xs text-muted-foreground">{asset.symbol}</div>
                      )}
                    </div>
                    <Check
                      className={cn(
                        "ml-auto h-4 w-4",
                        value === asset.id ? "opacity-100" : "opacity-0"
                      )}
                    />
                  </button>
                ))}
              </div>
            ))
          )}
        </div>
        {!showOnlyCustom && customAssets.length > 0 && (
          <div className="border-t px-3 py-2 text-xs text-muted-foreground">
            💡 Para ver apenas seus ativos customizados, use o filtro na aba Ativos
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}