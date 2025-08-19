import * as React from "react"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, Filter, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useDebounce } from "@/hooks/useDebounce"

interface FilterOption {
  label: string
  value: string
}

interface DataFiltersProps extends React.HTMLAttributes<HTMLDivElement> {
  searchValue?: string
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  searchDebounceMs?: number
  filters?: Array<{
    key: string
    label: string
    value: string
    options: FilterOption[]
    onValueChange: (value: string) => void
  }>
  activeFiltersCount?: number
  onClearFilters?: () => void
  showFilterToggle?: boolean
  isFilterOpen?: boolean
  onFilterToggle?: () => void
}

const DataFilters = React.forwardRef<HTMLDivElement, DataFiltersProps>(
  ({
    className,
    searchValue = "",
    onSearchChange,
    searchPlaceholder = "Buscar...",
    searchDebounceMs = 300,
    filters = [],
    activeFiltersCount = 0,
    onClearFilters,
    showFilterToggle = true,
    isFilterOpen = false,
    onFilterToggle,
    ...props
  }, ref) => {
    const [internalSearchValue, setInternalSearchValue] = useState(searchValue)
    const debouncedSearchValue = useDebounce(internalSearchValue, searchDebounceMs)

    useEffect(() => {
      if (debouncedSearchValue !== searchValue) {
        onSearchChange?.(debouncedSearchValue)
      }
    }, [debouncedSearchValue, onSearchChange])

    useEffect(() => {
      setInternalSearchValue(searchValue)
    }, [searchValue])
    return (
      <div className={cn("space-y-4", className)} ref={ref} {...props}>
        {/* Search and Filter Toggle */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder={searchPlaceholder}
              value={internalSearchValue}
              onChange={(e) => setInternalSearchValue(e.target.value)}
              className="pl-10"
            />
          </div>
          
          {showFilterToggle && (
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={onFilterToggle}
              >
                <Filter className="h-4 w-4 mr-2" />
                Filtros
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center">
                    {activeFiltersCount}
                  </Badge>
                )}
              </Button>
              
              {activeFiltersCount > 0 && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={onClearFilters}
                >
                  <X className="h-4 w-4 mr-2" />
                  Limpar
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Filter Panel */}
        {isFilterOpen && filters.length > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filters.map((filter) => (
                  <div key={filter.key} className="space-y-2">
                    <label className="text-sm font-medium">{filter.label}</label>
                    <Select value={filter.value} onValueChange={filter.onValueChange}>
                      <SelectTrigger>
                        <SelectValue placeholder={`Selecione ${filter.label.toLowerCase()}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {filter.options.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }
)
DataFilters.displayName = "DataFilters"

export { DataFilters }