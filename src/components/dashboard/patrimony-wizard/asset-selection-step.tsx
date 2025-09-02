import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Account, Asset } from "@/lib/supabase"
import { AssetBadge } from "@/components/ui/asset-badge"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Building, Car, Briefcase, Palette, DollarSign, Trash2, MoreVertical } from "lucide-react"
import { OperationType } from "./index"
import { CreateCustomAssetDialog } from "./create-custom-asset-dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

// Categorias de ativos para criação customizada
const assetCategories = [
  {
    type: 'real_estate',
    label: 'Imóvel',
    icon: Building,
    examples: ['Casa', 'Apartamento', 'Terreno', 'Sala comercial'],
    color: 'text-emerald-600 bg-emerald-50'
  },
  {
    type: 'vehicle',
    label: 'Veículo', 
    icon: Car,
    examples: ['Carro', 'Moto', 'Caminhão', 'Barco'],
    color: 'text-indigo-600 bg-indigo-50'
  },
  {
    type: 'bond',
    label: 'Renda Fixa',
    icon: Briefcase,
    examples: ['CDB', 'LCI', 'LCA', 'Tesouro'],
    color: 'text-green-600 bg-green-50'
  },
  {
    type: 'commodity',
    label: 'Outros Bens',
    icon: Palette,
    examples: ['Ouro físico', 'Arte', 'Coleções', 'Jóias'],
    color: 'text-amber-600 bg-amber-50'
  }
]

interface AssetSelectionStepProps {
  form: any
  assets: Asset[]
  customAssets: Asset[]
  accounts: Account[]
  selectedOperation: OperationType
  onNext: () => void
  onBack: () => void
  onReload: () => void
}

export function AssetSelectionStep({ 
  form, 
  assets,
  customAssets,
  accounts, 
  selectedOperation,
  onNext, 
  onBack,
  onReload
}: AssetSelectionStepProps) {
  const [searchQuery, setSearchQuery] = React.useState("")
  const [selectedAssetType, setSelectedAssetType] = React.useState<string>("all")
  const [deleteAsset, setDeleteAsset] = React.useState<{ id: string; name: string } | null>(null)
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = React.useState(false)
  
  const selectedAssetId = form.watch('asset_id')
  const selectedAccountId = form.watch('account_id')
  
  // Combinar assets globais e customizados
  const allAssets = [...assets, ...customAssets]
  const selectedAsset = allAssets.find(a => a.id === selectedAssetId)
  
  // Buscar assets dinamicamente no servidor conforme o usuário digita
  const [searchResults, setSearchResults] = React.useState<Asset[]>([])
  const [searching, setSearching] = React.useState(false)
  const [hasSearched, setHasSearched] = React.useState(false)

  // Função para validar CNPJ (apenas formato)
  const isValidCNPJFormat = (cnpj: string) => {
    const cleaned = cnpj.replace(/\D/g, '')
    return cleaned.length === 14
  }

  // Função para formatar CNPJ
  const formatCNPJ = (cnpj: string) => {
    const cleaned = cnpj.replace(/\D/g, '')
    if (cleaned.length === 14) {
      return `${cleaned.slice(0,2)}.${cleaned.slice(2,5)}.${cleaned.slice(5,8)}/${cleaned.slice(8,12)}-${cleaned.slice(12,14)}`
    }
    return cleaned
  }

  // Função para buscar assets no servidor
  const searchAssets = React.useCallback(async (query: string, assetType: string) => {
    // Para fundos, só buscar se tiver CNPJ completo
    const cleanedQuery = query.replace(/\D/g, '')
    const isCNPJQuery = /^\d+$/.test(cleanedQuery) && cleanedQuery.length >= 8
    
    if (assetType === 'fund' && isCNPJQuery && !isValidCNPJFormat(query)) {
      // CNPJ incompleto para fundos - não buscar ainda
      setSearchResults([])
      setHasSearched(false)
      return
    }
    
    if (!query || (assetType !== 'fund' && query.length < 2) || (assetType === 'fund' && !isCNPJQuery && query.length < 3)) {
      setSearchResults([])
      setHasSearched(false)
      return
    }
    
    try {
      setSearching(true)
      setHasSearched(false)
      
      let supabaseQuery = supabase.from('global_assets').select('*')
      
      // Filtrar por tipo de ativo
      if (assetType === 'stock') {
        supabaseQuery = supabaseQuery.eq('class', 'stock')
      } else if (assetType === 'crypto') {
        supabaseQuery = supabaseQuery.eq('class', 'crypto')
      } else if (assetType === 'fund') {
        supabaseQuery = supabaseQuery.in('class', ['fund', 'etf', 'reit'])
      }
      
      // Lógica de busca baseada no tipo
      if (assetType === 'fund' && isCNPJQuery) {
        // Busca por CNPJ formatado
        const formattedCNPJ = formatCNPJ(query)
        supabaseQuery = supabaseQuery.ilike('symbol', `%${formattedCNPJ}%`)
      } else {
        // Busca normal por symbol e label
        supabaseQuery = supabaseQuery.or(`symbol.ilike.%${query}%,label_ptbr.ilike.%${query}%`)
      }
      
      const { data, error } = await supabaseQuery
        .limit(50)
        .order('symbol', { ascending: true })
      
      if (error) throw error
      
      setSearchResults(data || [])
      setHasSearched(true)
      console.log(`🔍 Server search for "${query}" (type: ${assetType}):`, data?.length || 0, 'results')
    } catch (error) {
      console.error('Erro na busca de assets:', error)
      setSearchResults([])
      setHasSearched(true)
    } finally {
      setSearching(false)
    }
  }, [])

  // Debounce da busca
  React.useEffect(() => {
    const timer = setTimeout(() => {
      searchAssets(searchQuery, selectedAssetType)
    }, 300) // 300ms delay

    return () => clearTimeout(timer)
  }, [searchQuery, selectedAssetType, searchAssets])

  const filteredAssets = searchResults

  // Determinar se precisa de conta baseado na operação
  const requiresAccount = ['money_in', 'money_out', 'purchase'].includes(selectedOperation)
  
  const canContinue = selectedAssetId && (!requiresAccount || selectedAccountId)

  const handleAssetCreated = async (assetId?: string) => {
    setShowCreateDialog(false)
    setSelectedCategory(null)
    await onReload() // Recarregar assets
    
    // Pré-selecionar o ativo criado
    if (assetId) {
      form.setValue('asset_id', assetId)
    }
  }

  const handleDeleteAsset = async () => {
    if (!deleteAsset) return
    
    try {
      const { error } = await supabase
        .from('custom_assets')
        .delete()
        .eq('id', deleteAsset.id)

      if (error) throw error

      toast.success(`Ativo "${deleteAsset.name}" removido com sucesso`)
      
      // Se o ativo deletado estava selecionado, limpar seleção
      if (selectedAssetId === deleteAsset.id) {
        form.setValue('asset_id', '')
      }
      
      // Fechar dialog e recarregar lista de ativos
      setDeleteAsset(null)
      await onReload()
    } catch (error: any) {
      console.error('Erro ao deletar ativo:', error)
      toast.error('Erro ao remover ativo')
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header mais clean */}
      <div className="text-center space-y-3">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {selectedOperation === 'add_existing' && "Selecione seu ativo"}
          {selectedOperation === 'money_in' && "Onde depositar?"}
          {selectedOperation === 'money_out' && "De onde retirar?"}
          {selectedOperation === 'purchase' && "O que comprar?"}
          {selectedOperation === 'update_value' && "Qual ativo atualizar?"}
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Escolha entre seus ativos ou encontre novos
        </p>
      </div>

      {/* Ativo já selecionado - destaque visual */}
      {selectedAsset && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950 dark:to-emerald-950 border border-green-200 dark:border-green-800 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                <AssetBadge assetClass={selectedAsset.class as any} size="sm" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-green-900 dark:text-green-100">
                    {(selectedAsset as any).label || (selectedAsset as any).label_ptbr || selectedAsset.symbol}
                  </span>
                  {(selectedAsset as any).meta?.is_custom && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full dark:bg-blue-900 dark:text-blue-300">
                      PERSONALIZADO
                    </span>
                  )}
                </div>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Ativo selecionado • {selectedAsset.currency}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => form.setValue('asset_id', '')}
              className="text-green-700 hover:text-green-900 dark:text-green-300 dark:hover:text-green-100"
            >
              Alterar
            </Button>
          </div>
        </div>
      )}

      {/* Conteúdo principal */}
      <div className="space-y-6">
        {/* Quick Actions - Meus Ativos */}
        {customAssets.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center">
                <span className="text-sm">🏠</span>
              </div>
              <h4 className="font-semibold text-gray-900 dark:text-gray-100">Meus Ativos</h4>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full dark:bg-gray-800 dark:text-gray-400">
                {customAssets.length}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {customAssets.map((asset) => (
                <div
                  key={asset.id}
                  className={cn(
                    "relative p-4 rounded-xl border transition-all duration-200 group hover:shadow-md",
                    selectedAssetId === asset.id 
                      ? "border-blue-200 bg-blue-50 shadow-sm ring-2 ring-blue-100 dark:border-blue-800 dark:bg-blue-950 dark:ring-blue-900" 
                      : "border-gray-200 hover:border-blue-200 hover:bg-blue-50/50 dark:border-gray-700 dark:hover:border-blue-700 dark:hover:bg-blue-950/50"
                  )}
                >
                  {/* Menu de opções */}
                  <div className="absolute top-2 right-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onSelect={() => setDeleteAsset({ id: asset.id, name: (asset as any).label || asset.symbol })} 
                          className="text-red-600 dark:text-red-400"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Excluir ativo
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Conteúdo do card - agora clicável */}
                  <button
                    onClick={() => form.setValue('asset_id', asset.id)}
                    className="w-full text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 h-10 w-10 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center group-hover:bg-blue-100 dark:group-hover:bg-blue-900 transition-colors">
                        <AssetBadge assetClass={asset.class as any} size="sm" />
                      </div>
                      <div className="flex-1 min-w-0 pr-8">
                        <div className="font-medium text-gray-900 dark:text-gray-100 break-words">
                          {(asset as any).label || asset.symbol}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          {asset.currency} • Personalizado
                        </div>
                      </div>
                      {selectedAssetId === asset.id && (
                        <div className="flex-shrink-0 h-2 w-2 bg-blue-600 rounded-full mt-2"></div>
                      )}
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search Section */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center">
              <Search className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">Buscar Ativos Globais</h4>
          </div>
          
          <div className="flex gap-2">
            <Select value={selectedAssetType} onValueChange={setSelectedAssetType}>
              <SelectTrigger className="w-40 h-12 border-2 border-gray-200 focus:border-green-400 rounded-xl dark:border-gray-700 dark:focus:border-green-600">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="stock">📈 Ações</SelectItem>
                <SelectItem value="fund">🏦 Fundos</SelectItem>
                <SelectItem value="crypto">₿ Criptomoedas</SelectItem>
              </SelectContent>
            </Select>
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
              <Input
                placeholder={
                  selectedAssetType === 'fund' 
                    ? "Digite o nome ou CNPJ do fundo (14 dígitos)" 
                    : selectedAssetType === 'stock'
                    ? "Digite o código da ação (ex: PETR4, VALE3)"
                    : selectedAssetType === 'crypto'
                    ? "Digite o nome da criptomoeda (ex: Bitcoin, Ethereum)"
                    : "Digite o código ou nome (ex: PETR4, Bitcoin, Apple)"
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-12 h-12 text-base border-2 border-gray-200 focus:border-green-400 rounded-xl dark:border-gray-700 dark:focus:border-green-600"
              />
            </div>
          </div>
          
          {searchQuery && filteredAssets.length > 0 && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden">
              <div className="max-h-64 overflow-y-auto">
                {filteredAssets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => {
                      form.setValue('asset_id', asset.id)
                      setSearchQuery("")
                    }}
                    className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 border-b border-gray-100 dark:border-gray-800 last:border-b-0 transition-colors"
                  >
                    <AssetBadge assetClass={asset.class as any} size="sm" />
                    <div className="flex-1 text-left">
                      <div className="font-medium text-gray-900 dark:text-gray-100">{asset.symbol}</div>
                      {asset.label_ptbr && (
                        <div className="text-sm text-gray-500 dark:text-gray-400">{asset.label_ptbr}</div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {searchQuery && !searching && hasSearched && filteredAssets.length === 0 && searchQuery.length >= 2 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <div className="text-4xl mb-2">🔍</div>
              <p>Nenhum ativo encontrado</p>
              <p className="text-sm mt-1">Tente criar um ativo personalizado abaixo</p>
            </div>
          )}
          
          {searching && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <div className="text-2xl mb-2">⏳</div>
              <p>Buscando ativos...</p>
            </div>
          )}
          
          {searchQuery && ((selectedAssetType !== 'fund' && searchQuery.length < 2) || 
           (selectedAssetType === 'fund' && /^\d+$/.test(searchQuery.replace(/\D/g, '')) && !isValidCNPJFormat(searchQuery))) && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <div className="text-2xl mb-2">✏️</div>
              <p>
                {selectedAssetType === 'fund' && /^\d+$/.test(searchQuery.replace(/\D/g, ''))
                  ? "Digite o CNPJ completo (14 dígitos) para buscar fundos"
                  : "Digite pelo menos 2 caracteres para buscar"
                }
              </p>
            </div>
          )}
        </div>

        {/* Create Custom Asset */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center">
              <Plus className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">Criar Novo Ativo</h4>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {assetCategories.map((category) => {
              const Icon = category.icon
              return (
                <button
                  key={category.type}
                  onClick={() => {
                    setSelectedCategory(category.type)
                    setShowCreateDialog(true)
                  }}
                  className="group p-4 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-purple-200 hover:bg-purple-50/50 dark:hover:border-purple-700 dark:hover:bg-purple-950/50 transition-all duration-200 text-left hover:shadow-md"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("p-3 rounded-lg transition-colors", category.color, "group-hover:scale-105")}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-gray-100 mb-1">{category.label}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {category.examples.slice(0, 2).join(' • ')}
                      </div>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Seleção de conta se necessário */}
        {requiresAccount && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Conta/Carteira
              </CardTitle>
              <CardDescription>
                Onde a operação será registrada
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <FormField
                  control={form.control}
                  name="account_id"
                  render={({ field }) => (
                    <FormItem>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione uma conta" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {accounts.map((account) => (
                            <SelectItem key={account.id} value={account.id}>
                              {account.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Ativo selecionado */}
        {selectedAsset && (
          <Card className="bg-muted/50">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Ativo selecionado:</p>
                  <div className="flex items-center gap-2 mt-1">
                    <AssetBadge assetClass={selectedAsset.class as any} />
                    <span className="font-semibold">{selectedAsset.symbol}</span>
                    {selectedAsset.label_ptbr && (
                      <span className="text-muted-foreground">- {selectedAsset.label_ptbr}</span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => form.setValue('asset_id', '')}
                >
                  Alterar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          Voltar
        </Button>
        <Button onClick={onNext} disabled={!canContinue}>
          Continuar
        </Button>
      </div>

      {/* Dialog para criar ativo customizado */}
      {/* Dialog de confirmação de exclusão */}
      <Dialog open={!!deleteAsset} onOpenChange={(open) => !open && setDeleteAsset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir ativo personalizado?</DialogTitle>
            <DialogDescription>
              Esta ação não pode ser desfeita. O ativo "{deleteAsset?.name}" será permanentemente removido.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteAsset(null)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive"
              onClick={handleDeleteAsset}
            >
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <CreateCustomAssetDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        assetType={selectedCategory || 'real_estate'}
        onSuccess={handleAssetCreated}
      />
    </div>
  )
}