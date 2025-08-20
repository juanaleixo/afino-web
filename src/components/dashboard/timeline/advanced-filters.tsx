"use client"

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Crown, Filter, Calendar, Building2, TrendingUp, Coins, X } from 'lucide-react'
import { useState } from 'react'

interface AdvancedFiltersProps {
  filters: {
    period: string
    customFrom?: string
    customTo?: string
    accountIds: string[]
    assetClasses: string[]
    selectedAssets: string[]
    showCashOnly: boolean
    showProjections: boolean
    granularity: 'daily' | 'monthly'
    showAssetBreakdown: boolean
    benchmark?: string | undefined
    excludeZeroValues: boolean
  }
  onFiltersChange: (filters: any) => void
  accounts: Array<{ id: string; label: string }>
  assets: Array<{ id: string; symbol: string; class: string; label?: string }>
  isPremium: boolean
  isOpen: boolean
  onToggle: () => void
}

const ASSET_CLASSES = [
  { value: 'currency', label: 'Moeda', icon: '💰' },
  { value: 'stock', label: 'Ações', icon: '📈' },
  { value: 'crypto', label: 'Cripto', icon: '₿' },
  { value: 'fund', label: 'Fundos', icon: '🏦' },
  { value: 'commodity', label: 'Commodities', icon: '🥇' },
]

const BENCHMARKS = [
  { value: 'cdi', label: 'CDI' },
  { value: 'selic', label: 'SELIC' },
  { value: 'ibov', label: 'IBOVESPA' },
  { value: 'sp500', label: 'S&P 500' },
  { value: 'bitcoin', label: 'Bitcoin' },
]

export default function AdvancedFilters({
  filters,
  onFiltersChange,
  accounts,
  assets,
  isPremium,
  isOpen,
  onToggle
}: AdvancedFiltersProps) {
  const [selectedAssetClass, setSelectedAssetClass] = useState<string>('all')

  const handleAssetClassToggle = (assetClass: string) => {
    const newClasses = filters.assetClasses.includes(assetClass)
      ? filters.assetClasses.filter(c => c !== assetClass)
      : [...filters.assetClasses, assetClass]
    
    onFiltersChange({ assetClasses: newClasses })
  }

  const handleAccountToggle = (accountId: string) => {
    const newAccounts = filters.accountIds.includes(accountId)
      ? filters.accountIds.filter(id => id !== accountId)
      : [...filters.accountIds, accountId]
    
    onFiltersChange({ accountIds: newAccounts })
  }

  const handleAssetToggle = (assetId: string) => {
    const newAssets = filters.selectedAssets.includes(assetId)
      ? filters.selectedAssets.filter(id => id !== assetId)
      : [...filters.selectedAssets, assetId]
    
    onFiltersChange({ selectedAssets: newAssets })
  }

  const clearAllFilters = () => {
    onFiltersChange({
      accountIds: [],
      assetClasses: [],
      selectedAssets: [],
      showCashOnly: false,
      showProjections: false,
      benchmark: undefined,
      excludeZeroValues: false
    })
  }

  const filteredAssets = selectedAssetClass && selectedAssetClass !== 'all'
    ? assets.filter(asset => asset.class === selectedAssetClass)
    : assets

  const activeFiltersCount = 
    filters.accountIds.length + 
    filters.assetClasses.length + 
    filters.selectedAssets.length +
    (filters.showCashOnly ? 1 : 0) +
    (filters.showProjections ? 1 : 0) +
    (filters.benchmark ? 1 : 0) +
    (filters.excludeZeroValues ? 1 : 0)

  if (!isPremium) {
    return (
      <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Crown className="h-5 w-5 text-yellow-600" />
              <div>
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                  Filtros Avançados Premium
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Filtre por contas, ativos, classes e muito mais
                </p>
              </div>
            </div>
            <Button variant="outline" className="border-yellow-300 hover:bg-yellow-100">
              <Crown className="h-4 w-4 mr-2" />
              Fazer Upgrade
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5" />
            <CardTitle>Filtros Avançados</CardTitle>
            <Badge variant="outline" className="flex items-center space-x-1">
              <Crown className="h-3 w-3" />
              <span>Premium</span>
            </Badge>
            {activeFiltersCount > 0 && (
              <Badge variant="secondary">
                {activeFiltersCount} {activeFiltersCount === 1 ? 'filtro' : 'filtros'}
              </Badge>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {activeFiltersCount > 0 && (
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearAllFilters}
                className="text-muted-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Limpar
              </Button>
            )}
            <Button 
              variant={isOpen ? 'default' : 'outline'}
              size="sm" 
              onClick={() => {
                console.log('AdvancedFilters: Toggle clicked, current isOpen:', isOpen)
                onToggle()
              }}
            >
              {isOpen ? 'Ocultar' : 'Mostrar'}
            </Button>
          </div>
        </div>
      </CardHeader>
      
      {isOpen && (
        <CardContent className="space-y-6">
          {/* Granularidade */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Granularidade dos Dados</span>
            </Label>
            <div className="flex space-x-2">
              <Button
                variant={filters.granularity === 'monthly' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onFiltersChange({ granularity: 'monthly' })}
              >
                Mensal
              </Button>
              <Button
                variant={filters.granularity === 'daily' ? 'default' : 'outline'}
                size="sm"
                onClick={() => onFiltersChange({ granularity: 'daily' })}
              >
                Diário
              </Button>
            </div>
          </div>

          <Separator />

          {/* Contas */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center space-x-2">
              <Building2 className="h-4 w-4" />
              <span>Filtrar por Contas</span>
              {filters.accountIds.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {filters.accountIds.length}
                </Badge>
              )}
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {accounts.map((account) => (
                <div key={account.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`account-${account.id}`}
                    checked={filters.accountIds.includes(account.id)}
                    onCheckedChange={() => handleAccountToggle(account.id)}
                  />
                  <Label htmlFor={`account-${account.id}`} className="text-sm">
                    {account.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Classes de Ativos */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center space-x-2">
              <Coins className="h-4 w-4" />
              <span>Classes de Ativos</span>
              {filters.assetClasses.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {filters.assetClasses.length}
                </Badge>
              )}
            </Label>
            <div className="flex flex-wrap gap-2">
              {ASSET_CLASSES.map((assetClass) => (
                <Button
                  key={assetClass.value}
                  variant={filters.assetClasses.includes(assetClass.value) ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleAssetClassToggle(assetClass.value)}
                  className="flex items-center space-x-2"
                >
                  <span>{assetClass.icon}</span>
                  <span>{assetClass.label}</span>
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Ativos Específicos */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium flex items-center space-x-2">
                <TrendingUp className="h-4 w-4" />
                <span>Ativos Específicos</span>
                {filters.selectedAssets.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {filters.selectedAssets.length}
                  </Badge>
                )}
              </Label>
              <Select value={selectedAssetClass} onValueChange={setSelectedAssetClass}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Filtrar classe" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as classes</SelectItem>
                  {ASSET_CLASSES.map((assetClass) => (
                    <SelectItem key={assetClass.value} value={assetClass.value}>
                      <div className="flex items-center space-x-2">
                        <span>{assetClass.icon}</span>
                        <span>{assetClass.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="max-h-40 overflow-y-auto border rounded-md p-2">
              <div className="grid grid-cols-2 gap-2">
                {filteredAssets.map((asset) => (
                  <div key={asset.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`asset-${asset.id}`}
                      checked={filters.selectedAssets.includes(asset.id)}
                      onCheckedChange={() => handleAssetToggle(asset.id)}
                    />
                    <Label htmlFor={`asset-${asset.id}`} className="text-sm">
                      {asset.label || asset.symbol}
                    </Label>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Separator />

          {/* Benchmark */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Comparar com Benchmark</Label>
            <Select 
              value={filters.benchmark ?? 'none'} 
              onValueChange={(value) => onFiltersChange({ benchmark: value === 'none' ? undefined : value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um benchmark" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum benchmark</SelectItem>
                {BENCHMARKS.map((benchmark) => (
                  <SelectItem key={benchmark.value} value={benchmark.value}>
                    {benchmark.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Opções Avançadas */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Opções Avançadas</Label>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-breakdown"
                  checked={filters.showAssetBreakdown}
                  onCheckedChange={(checked) => onFiltersChange({ showAssetBreakdown: checked })}
                />
                <Label htmlFor="show-breakdown" className="text-sm">
                  Mostrar breakdown por ativo
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="cash-only"
                  checked={filters.showCashOnly}
                  onCheckedChange={(checked) => onFiltersChange({ showCashOnly: checked })}
                />
                <Label htmlFor="cash-only" className="text-sm">
                  Apenas ativos monetários
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="exclude-zero"
                  checked={filters.excludeZeroValues}
                  onCheckedChange={(checked) => onFiltersChange({ excludeZeroValues: checked })}
                />
                <Label htmlFor="exclude-zero" className="text-sm">
                  Excluir valores zerados
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="show-projections"
                  checked={filters.showProjections}
                  onCheckedChange={(checked) => onFiltersChange({ showProjections: checked })}
                />
                <Label htmlFor="show-projections" className="text-sm">
                  Mostrar projeções futuras
                </Label>
                <Badge variant="outline" className="text-xs">
                  Experimental
                </Badge>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  )
}
