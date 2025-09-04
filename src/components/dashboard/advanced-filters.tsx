"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { 
  Search, 
  Filter, 
  X, 
  CalendarIcon, 
  Crown,
  TrendingUp,
  TrendingDown,
  AlertCircle
} from "lucide-react"
import { cn } from "@/lib/utils"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { EventWithRelations } from "@/lib/types/events"

interface FilterConfig {
  searchTerm: string
  kind: EventWithRelations['kind'] | 'all'
  assetClass: 'all' | 'currency' | 'noncurrency' | 'stock' | 'crypto' | 'fund' | 'commodity' | 'bond' | 'reit' | 'real_estate' | 'vehicle'
  account: string | 'all'
  dateFrom: Date | null
  dateTo: Date | null
  amountRange: 'all' | 'small' | 'medium' | 'large'
  sortBy: 'date' | 'amount' | 'asset'
  sortOrder: 'asc' | 'desc'
  showOnlyPositive: boolean
  showOnlyNegative: boolean
}

interface AdvancedFiltersProps {
  events: EventWithRelations[]
  filters: FilterConfig
  onFiltersChange: (filters: Partial<FilterConfig>) => void
  onReset: () => void
  isPremium: boolean
  accounts: Array<{ id: string; label: string }>
}

const defaultFilters: FilterConfig = {
  searchTerm: '',
  kind: 'all',
  assetClass: 'all',
  account: 'all',
  dateFrom: null,
  dateTo: null,
  amountRange: 'all',
  sortBy: 'date',
  sortOrder: 'desc',
  showOnlyPositive: false,
  showOnlyNegative: false
}

export const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({
  events,
  filters,
  onFiltersChange,
  onReset,
  isPremium,
  accounts
}) => {
  const [isExpanded, setIsExpanded] = React.useState(false)
  
  const activeFiltersCount = React.useMemo(() => {
    let count = 0
    if (filters.searchTerm) count++
    if (filters.kind !== 'all') count++
    if (filters.assetClass !== 'all') count++
    if (filters.account !== 'all') count++
    if (filters.dateFrom || filters.dateTo) count++
    if (filters.amountRange !== 'all') count++
    if (filters.showOnlyPositive || filters.showOnlyNegative) count++
    return count
  }, [filters])
  
  const uniqueAssetClasses = React.useMemo(() => {
    const classes = new Set<string>()
    events.forEach(event => {
      if (event.global_assets?.class) {
        classes.add(event.global_assets.class)
      }
    })
    return Array.from(classes)
  }, [events])
  
  const PremiumBadge = () => (
    <Badge variant="outline" className="text-xs">
      <Crown className="h-3 w-3 mr-1" />
      Premium
    </Badge>
  )
  
  return (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros Avançados
            {!isPremium && <PremiumBadge />}
          </CardTitle>
          <div className="flex items-center gap-2">
            {activeFiltersCount > 0 && (
              <Badge variant="secondary">
                {activeFiltersCount} filtros ativos
              </Badge>
            )}
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {isExpanded ? 'Minimizar' : 'Expandir'}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        {/* Basic filters - always visible */}
        <div className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Buscar por ativo, conta ou descrição..."
              value={filters.searchTerm}
              onChange={(e) => onFiltersChange({ searchTerm: e.target.value })}
              className="pl-10"
            />
          </div>
          
          {/* Basic filters row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Evento</Label>
              <Select 
                value={filters.kind} 
                onValueChange={(value) => onFiltersChange({ kind: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  <SelectItem value="deposit">Depósito</SelectItem>
                  <SelectItem value="withdraw">Saque</SelectItem>
                  <SelectItem value="buy">Compra</SelectItem>
                  <SelectItem value="position_add">Adicionar Posição</SelectItem>
                  <SelectItem value="valuation">Avaliação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Classe de Ativo</Label>
              <Select 
                value={filters.assetClass} 
                onValueChange={(value) => onFiltersChange({ assetClass: value as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as classes</SelectItem>
                  <SelectItem value="currency">Moedas/Caixa</SelectItem>
                  <SelectItem value="noncurrency">Investimentos</SelectItem>
                  {uniqueAssetClasses.map(cls => (
                    <SelectItem key={cls} value={cls}>
                      {cls === 'stock' ? 'Ações' :
                       cls === 'crypto' ? 'Criptomoedas' :
                       cls === 'fund' ? 'Fundos' :
                       cls === 'commodity' ? 'Commodities' :
                       cls === 'bond' ? 'Títulos' :
                       cls === 'reit' ? 'REITs' :
                       cls === 'real_estate' ? 'Imóveis' :
                       cls === 'vehicle' ? 'Veículos' :
                       cls.toUpperCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Ordenação</Label>
              <div className="flex gap-2">
                <Select 
                  value={filters.sortBy} 
                  onValueChange={(value) => onFiltersChange({ sortBy: value as any })}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="date">Data</SelectItem>
                    <SelectItem value="amount">Valor</SelectItem>
                    <SelectItem value="asset">Ativo</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onFiltersChange({ 
                    sortOrder: filters.sortOrder === 'asc' ? 'desc' : 'asc' 
                  })}
                >
                  {filters.sortOrder === 'asc' ? 
                    <TrendingUp className="h-4 w-4" /> : 
                    <TrendingDown className="h-4 w-4" />
                  }
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Premium filters - only visible when expanded and user is premium */}
        {isExpanded && (
          <div className="mt-6 space-y-4">
            <Separator />
            
            {!isPremium ? (
              <Card className="bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-3">
                    <Crown className="h-5 w-5 text-yellow-600 mt-0.5" />
                    <div className="space-y-2">
                      <h3 className="font-semibold text-yellow-800">
                        Filtros Premium Disponíveis
                      </h3>
                      <p className="text-sm text-yellow-700">
                        Desbloqueie filtros avançados por data, conta, valor e muito mais com o plano Premium.
                      </p>
                      <Button size="sm" className="mt-2">
                        <Crown className="h-3 w-3 mr-2" />
                        Atualizar para Premium
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  Filtros Premium Ativados
                </div>
                
                {/* Account filter */}
                <div className="space-y-2">
                  <Label>Conta Específica</Label>
                  <Select 
                    value={filters.account} 
                    onValueChange={(value) => onFiltersChange({ account: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas as contas</SelectItem>
                      {accounts.map(account => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Date range filter */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data Inicial</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filters.dateFrom ? 
                            format(filters.dateFrom, "dd/MM/yyyy", { locale: ptBR }) : 
                            "Selecionar data"
                          }
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={filters.dateFrom || undefined}
                          onSelect={(date) => onFiltersChange({ dateFrom: date || null })}
                          locale={ptBR}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Data Final</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {filters.dateTo ? 
                            format(filters.dateTo, "dd/MM/yyyy", { locale: ptBR }) : 
                            "Selecionar data"
                          }
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={filters.dateTo || undefined}
                          onSelect={(date) => onFiltersChange({ dateTo: date || null })}
                          locale={ptBR}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>
                
                {/* Amount range filter */}
                <div className="space-y-2">
                  <Label>Faixa de Valor</Label>
                  <Select 
                    value={filters.amountRange} 
                    onValueChange={(value) => onFiltersChange({ amountRange: value as any })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os valores</SelectItem>
                      <SelectItem value="small">Até R$ 1.000</SelectItem>
                      <SelectItem value="medium">R$ 1.000 - R$ 10.000</SelectItem>
                      <SelectItem value="large">Acima de R$ 10.000</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {/* Value direction filters */}
                <div className="space-y-2">
                  <Label>Direção do Valor</Label>
                  <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="positive"
                        checked={filters.showOnlyPositive}
                        onCheckedChange={(checked) => onFiltersChange({ 
                          showOnlyPositive: checked,
                          showOnlyNegative: checked ? false : filters.showOnlyNegative 
                        })}
                      />
                      <Label htmlFor="positive" className="text-green-600">
                        Apenas valores positivos
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Switch
                        id="negative"
                        checked={filters.showOnlyNegative}
                        onCheckedChange={(checked) => onFiltersChange({ 
                          showOnlyNegative: checked,
                          showOnlyPositive: checked ? false : filters.showOnlyPositive 
                        })}
                      />
                      <Label htmlFor="negative" className="text-red-600">
                        Apenas valores negativos
                      </Label>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Action buttons */}
            <div className="flex items-center justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={onReset}>
                <X className="h-4 w-4 mr-2" />
                Limpar Filtros
              </Button>
              <Button onClick={() => setIsExpanded(false)}>
                Aplicar Filtros
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
