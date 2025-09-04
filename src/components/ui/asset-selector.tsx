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
import { Asset, supabase } from "@/lib/supabase"
import { getAssetDisplayLabel, getAssetClassLabel } from "@/lib/utils/assets"
import { isAssetSelected, getAssetFormValue } from "@/lib/utils/asset-helpers"

interface AssetSelectorProps {
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  showOnlyCustom?: boolean
  excludeCash?: boolean
}

export function AssetSelector({
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
  const [searchResults, setSearchResults] = React.useState<Asset[]>([])
  const [customAssets, setCustomAssets] = React.useState<Asset[]>([])
  const [searching, setSearching] = React.useState(false)
  const [hasSearched, setHasSearched] = React.useState(false)
  const [selectedAssetData, setSelectedAssetData] = React.useState<Asset | null>(null)

  // Load custom assets on mount
  React.useEffect(() => {
    const loadCustomAssets = async () => {
      try {
        const { data } = await supabase
          .from('custom_assets')
          .select('*')
          .order('label', { ascending: true })
        
        setCustomAssets(data || [])
      } catch (error) {
        console.error('Error loading custom assets:', error)
      }
    }
    
    loadCustomAssets()
  }, [])

  // Clear stored asset data when value changes externally
  React.useEffect(() => {
    if (!value) {
      setSelectedAssetData(null)
    } else if (selectedAssetData && !isAssetSelected(selectedAssetData, value)) {
      setSelectedAssetData(null)
    }
  }, [value, selectedAssetData])

  // Search assets dynamically
  const searchAssets = React.useCallback(async (query: string) => {
    if (!query || query.length < 2) {
      setSearchResults([])
      setHasSearched(false)
      return
    }
    
    try {
      setSearching(true)
      setHasSearched(false)
      
      let supabaseQuery = supabase.from('global_assets').select('*')
      
      // Apply filters
      if (excludeCash) {
        supabaseQuery = supabaseQuery.not('class', 'in', '("cash","currency")')
      }
      
      // Search by symbol and label - using case insensitive search
      const searchPattern = `%${query.toLowerCase()}%`
      supabaseQuery = supabaseQuery.or(`symbol.ilike.${searchPattern},label_ptbr.ilike.${searchPattern}`)
      
      const { data, error } = await supabaseQuery
        .limit(50)
        .order('symbol', { ascending: true })
      
      if (error) {
        console.error('Supabase query error:', error)
        throw error
      }
      
      console.log('Asset search results for query:', query, 'Results:', data)
      setSearchResults(data || [])
      setHasSearched(true)
    } catch (error) {
      console.error('Error searching assets:', error)
      setSearchResults([])
      setHasSearched(true)
    } finally {
      setSearching(false)
    }
  }, [excludeCash])

  // Debounce search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      searchAssets(searchQuery)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchQuery, searchAssets])

  // Find selected asset - use stored data or search in current lists
  const selectedAsset = React.useMemo(() => {
    if (!value) return undefined
    
    // If we have stored data and it matches the current value, use it
    if (selectedAssetData && isAssetSelected(selectedAssetData, value)) {
      return selectedAssetData
    }
    
    // Otherwise, search in current lists
    const customSelected = customAssets.find(asset => isAssetSelected(asset, value))
    if (customSelected) return customSelected
    
    const searchSelected = searchResults.find(asset => isAssetSelected(asset, value))
    if (searchSelected) return searchSelected
    
    // If not found anywhere, create a minimal display object
    // This happens when an asset was selected but is no longer in current results
    return {
      symbol: value,
      id: value,
      class: 'stock', // Default to stock instead of unknown
      currency: 'BRL',
      label_ptbr: value
    } as Asset
  }, [customAssets, searchResults, value, selectedAssetData])


  // Organize assets for display
  const organizedAssets = React.useMemo(() => {
    if (showOnlyCustom) {
      return { custom: customAssets, global: {}, searching: false }
    }
    
    if (!searchQuery) {
      // No search: show custom assets only
      return { custom: customAssets, global: {}, searching: false }
    } else {
      // With search: show search results grouped by class
      const grouped: { [key: string]: Asset[] } = {}
      searchResults.forEach(asset => {
        const classLabel = getAssetClassLabel(asset.class)
        if (!grouped[classLabel]) {
          grouped[classLabel] = []
        }
        grouped[classLabel].push(asset)
      })
      return { custom: [], global: grouped, searching: true }
    }
  }, [customAssets, searchResults, searchQuery, showOnlyCustom])

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
              {(selectedAsset as any).meta?.is_custom && (
                <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">
                  PERSONALIZADO
                </span>
              )}
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
          {searching ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <div className="text-2xl mb-2">⏳</div>
              <p>Buscando ativos...</p>
            </div>
          ) : searchQuery && hasSearched && Object.keys(organizedAssets.global).length === 0 && organizedAssets.custom.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <div className="text-4xl mb-2">🔍</div>
              <p>Nenhum ativo encontrado</p>
            </div>
          ) : searchQuery && searchQuery.length < 2 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <div className="text-2xl mb-2">✏️</div>
              <p>Digite pelo menos 2 caracteres para buscar</p>
            </div>
          ) : (
            <>
              {/* Meus Ativos Personalizados */}
              {organizedAssets.custom.length > 0 && !organizedAssets.searching && (
                <>
                  <div className="px-3 py-2 text-xs font-medium text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-400 border-b">
                    🏠 Meus Ativos ({organizedAssets.custom.length})
                  </div>
                  {organizedAssets.custom.map((asset) => (
                    <button
                      key={asset.id}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                        isAssetSelected(asset, value || '') && "bg-accent text-accent-foreground"
                      )}
                      onClick={() => {
                        const formValue = getAssetFormValue(asset)
                        onValueChange?.(formValue)
                        setSelectedAssetData(asset)
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
                        <div className="font-medium flex items-center gap-2">
                          {getAssetDisplayLabel(asset)}
                          <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded dark:bg-blue-900 dark:text-blue-300">
                            PERSONALIZADO
                          </span>
                        </div>
                        {getAssetDisplayLabel(asset)?.toUpperCase?.() !== asset.symbol?.toUpperCase?.() && (
                          <div className="text-xs text-muted-foreground">{asset.symbol}</div>
                        )}
                      </div>
                      <Check
                        className={cn(
                          "ml-auto h-4 w-4",
                          isAssetSelected(asset, value || '') ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </button>
                  ))}
                </>
              )}

              {/* Ativos Globais */}
              {Object.keys(organizedAssets.global).length > 0 && (
                <>
                  {organizedAssets.custom.length > 0 && !organizedAssets.searching && (
                    <div className="border-t"></div>
                  )}
                  {!organizedAssets.searching && (
                    <div className="px-3 py-2 text-xs font-medium text-green-600 bg-green-50 dark:bg-green-950 dark:text-green-400 border-b">
                      🌐 Ativos Globais
                    </div>
                  )}
                  
                  {Object.entries(organizedAssets.global).map(([classLabel, classAssets]) => (
                    <div key={classLabel}>
                      <div className="px-3 py-2 text-xs font-medium text-muted-foreground bg-muted/30">
                        {classLabel} ({classAssets.length})
                      </div>
                      {classAssets.map((asset) => (
                        <button
                          key={asset.id || asset.symbol}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
                            isAssetSelected(asset, value || '') && "bg-accent text-accent-foreground"
                          )}
                          onClick={() => {
                            const formValue = getAssetFormValue(asset)
                            onValueChange?.(formValue)
                            setSelectedAssetData(asset)
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
                              isAssetSelected(asset, value || '') ? "opacity-100" : "opacity-0"
                            )}
                          />
                        </button>
                      ))}
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}