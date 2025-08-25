import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Account, Asset } from "@/lib/supabase"
import { AssetBadge } from "@/components/ui/asset-badge"
import { Badge } from "@/components/ui/badge"
import { Plus, Search, Building, Car, Briefcase, Palette, DollarSign } from "lucide-react"
import { OperationType } from "./index"
import { CreateCustomAssetDialog } from "./create-custom-asset-dialog"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

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
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null)
  const [showCreateDialog, setShowCreateDialog] = React.useState(false)
  
  const selectedAssetId = form.watch('asset_id')
  const selectedAccountId = form.watch('account_id')
  
  // Combinar assets globais e customizados
  const allAssets = [...assets, ...customAssets]
  const selectedAsset = allAssets.find(a => a.id === selectedAssetId)
  
  // Filtrar assets baseado na busca
  const filteredAssets = React.useMemo(() => {
    if (!searchQuery) return []
    
    const query = searchQuery.toLowerCase()
    return assets.filter(asset => 
      asset.symbol.toLowerCase().includes(query) ||
      (asset.label_ptbr && asset.label_ptbr.toLowerCase().includes(query))
    ).slice(0, 10) // Limitar resultados
  }, [assets, searchQuery])

  // Determinar se precisa de conta baseado na operação
  const requiresAccount = ['money_in', 'money_out', 'purchase'].includes(selectedOperation)
  
  const canContinue = selectedAssetId && (!requiresAccount || selectedAccountId)

  const handleAssetCreated = () => {
    setShowCreateDialog(false)
    setSelectedCategory(null)
    onReload() // Recarregar assets
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold">
          {selectedOperation === 'add_existing' && "Que patrimônio você quer adicionar?"}
          {selectedOperation === 'money_in' && "Onde você quer depositar?"}
          {selectedOperation === 'money_out' && "De onde você quer retirar?"}
          {selectedOperation === 'purchase' && "O que você quer comprar?"}
          {selectedOperation === 'update_value' && "Qual ativo quer atualizar?"}
        </h3>
        <p className="text-sm text-muted-foreground">
          Busque por ativos existentes ou crie um novo personalizado
        </p>
      </div>

      <div className="space-y-4">
        {/* Busca de ativos existentes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4" />
              Buscar Ativo Existente
            </CardTitle>
            <CardDescription>
              Ações, criptomoedas, fundos e moedas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Digite o nome ou código (ex: PETR4, Bitcoin, BRL)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
            
            {searchQuery && filteredAssets.length > 0 && (
              <div className="border rounded-lg p-2 space-y-1 max-h-60 overflow-y-auto">
                {filteredAssets.map((asset) => (
                  <button
                    key={asset.id}
                    onClick={() => {
                      form.setValue('asset_id', asset.id)
                      setSearchQuery("")
                    }}
                    className={cn(
                      "w-full text-left p-2 rounded hover:bg-muted transition-colors",
                      selectedAssetId === asset.id && "bg-muted"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <AssetBadge assetClass={asset.class as any} size="sm" />
                        <span className="font-medium">{asset.symbol}</span>
                        {asset.label_ptbr && (
                          <span className="text-sm text-muted-foreground">
                            - {asset.label_ptbr}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
            
            {searchQuery && filteredAssets.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum ativo encontrado. Tente criar um personalizado abaixo.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Criar ativo personalizado */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Criar Ativo Personalizado
            </CardTitle>
            <CardDescription>
              Imóveis, veículos, renda fixa e outros bens
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {assetCategories.map((category) => {
                const Icon = category.icon
                return (
                  <button
                    key={category.type}
                    onClick={() => {
                      setSelectedCategory(category.type)
                      setShowCreateDialog(true)
                    }}
                    className="p-4 border rounded-lg hover:bg-muted transition-colors text-left"
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn("p-2 rounded", category.color)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm">{category.label}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {category.examples.slice(0, 2).join(', ')}...
                        </p>
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          </CardContent>
        </Card>

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
      <CreateCustomAssetDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        assetType={selectedCategory || 'real_estate'}
        onSuccess={handleAssetCreated}
      />
    </div>
  )
}