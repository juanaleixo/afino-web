"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Filter, Calendar, Crown, Eye } from "lucide-react"

export interface TimelineFilters {
  period: '1M' | '3M' | '6M' | '1Y' | '2Y' | 'ALL' | 'CUSTOM'
  customFrom?: string
  customTo?: string
  granularity: 'daily' | 'monthly'
  benchmark?: string | undefined
}

interface TimelineFiltersProps {
  filters: TimelineFilters
  onFiltersChange: (filters: Partial<TimelineFilters>) => void
  isPremium: boolean
  loading?: boolean
}

const PERIOD_OPTIONS = [
  { value: '1M', label: '1M', premium: false },
  { value: '3M', label: '3M', premium: false },
  { value: '6M', label: '6M', premium: false },
  { value: '1Y', label: '1Y', premium: false },
  { value: '2Y', label: '2Y', premium: true },
  { value: 'ALL', label: 'Tudo', premium: true }
] as const

export function TimelineFilters({ 
  filters, 
  onFiltersChange, 
  isPremium, 
  loading = false 
}: TimelineFiltersProps) {
  
  const handleFiltersChange = (newFilters: Partial<TimelineFilters>) => {
    onFiltersChange(newFilters)
  }

  const handleGranularityChange = (value: 'daily' | 'monthly') => {
    const newFilters: Partial<TimelineFilters> = { granularity: value }
    
    // Otimização automática para dados diários (reduzir período se necessário)
    if (value === 'daily' && !['1M', '3M'].includes(filters.period)) {
      newFilters.period = '1M'
    }
    
    handleFiltersChange(newFilters)
  }

  const handlePeriodChange = (period: TimelineFilters['period']) => {
    handleFiltersChange({ period })
  }

  return (
    <div className="space-y-4">
      {/* Header com indicador de granularidade */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5" />
          <span className="font-medium">Filtros</span>
        </div>
        <div className="flex items-center space-x-2">
          {!isPremium && (
            <Badge variant="secondary" className="bg-gray-100 text-gray-700">
              <Eye className="h-3 w-3" />
              <span>Plano Básico</span>
            </Badge>
          )}
          <Select 
            value={filters.granularity} 
            onValueChange={handleGranularityChange}
            disabled={loading}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Mensal</SelectItem>
              {isPremium && <SelectItem value="daily">Diário</SelectItem>}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filtros de Período */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <span>Período</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-4">
            {/* Botões de período pré-definidos */}
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">Selecionar:</span>
              <div className="flex flex-wrap gap-1">
                {PERIOD_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    variant={filters.period === option.value ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => handlePeriodChange(option.value)}
                    disabled={loading || (!isPremium && option.premium)}
                  >
                    {option.label}
                    {!isPremium && option.premium && <Crown className="h-3 w-3 ml-1" />}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Campos de data customizada */}
            {filters.period === 'CUSTOM' && (
              <div className="flex items-center space-x-2">
                <input
                  type="date"
                  value={filters.customFrom || ''}
                  onChange={(e) => handleFiltersChange({ customFrom: e.target.value })}
                  className="px-3 py-1 border rounded text-sm"
                  disabled={loading}
                />
                <span className="text-sm">até</span>
                <input
                  type="date"
                  value={filters.customTo || ''}
                  onChange={(e) => handleFiltersChange({ customTo: e.target.value })}
                  className="px-3 py-1 border rounded text-sm"
                  disabled={loading}
                />
              </div>
            )}
            
            {/* Botão período customizado */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleFiltersChange({ period: 'CUSTOM' })}
              disabled={loading || !isPremium}
            >
              <Calendar className="h-4 w-4 mr-1" />
              Personalizado
              {!isPremium && <Crown className="h-3 w-3 ml-1" />}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filtros de Benchmark (Premium) */}
      {isPremium && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                <Crown className="h-3 w-3" />
                Premium
              </Badge>
              <span>Benchmark</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Select 
              value={filters.benchmark && filters.benchmark !== '' ? filters.benchmark : 'none'} 
              onValueChange={(value) => handleFiltersChange({ benchmark: value === 'none' ? undefined : value })}
              disabled={loading}
            >
              <SelectTrigger>
                <SelectValue placeholder="Nenhum benchmark selecionado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                <SelectItem value="cdi">CDI</SelectItem>
                <SelectItem value="ibov">IBOVESPA</SelectItem>
                <SelectItem value="sp500">S&P 500</SelectItem>
                <SelectItem value="btc">Bitcoin</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>
      )}
    </div>
  )
}