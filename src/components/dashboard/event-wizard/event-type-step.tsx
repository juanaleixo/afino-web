import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  ShoppingCart, 
  Plus,
  DollarSign,
  type LucideIcon
} from "lucide-react"
import { cn } from "@/lib/utils"

type EventKind = 'deposit' | 'withdraw' | 'buy' | 'position_add' | 'valuation'

interface EventTypeOption {
  kind: EventKind
  title: string
  description: string
  icon: LucideIcon
  color: string
  forCurrency?: boolean
  forAssets?: boolean
  isNew?: boolean
}

const eventTypeOptions: EventTypeOption[] = [
  {
    kind: 'deposit',
    title: 'Entrada',
    description: 'Adicionar dinheiro ou ativos ao portfólio',
    icon: ArrowDownCircle,
    color: 'text-green-600 bg-green-50',
    forCurrency: true,
    forAssets: true,
  },
  {
    kind: 'withdraw', 
    title: 'Saída',
    description: 'Retirar dinheiro ou ativos do portfólio',
    icon: ArrowUpCircle,
    color: 'text-red-600 bg-red-50',
    forCurrency: true,
    forAssets: true,
  },
  {
    kind: 'buy',
    title: 'Compra',
    description: 'Comprar ativos com preço específico',
    icon: ShoppingCart,
    color: 'text-blue-600 bg-blue-50',
    forCurrency: false,
    forAssets: true,
  },
  {
    kind: 'position_add',
    title: 'Adicionar Posição',
    description: 'Registrar ativos que você já possui',
    icon: Plus,
    color: 'text-purple-600 bg-purple-50',
    forCurrency: false,
    forAssets: true,
    isNew: true,
  },
  {
    kind: 'valuation',
    title: 'Avaliação',
    description: 'Definir preço manual do ativo',
    icon: DollarSign,
    color: 'text-yellow-600 bg-yellow-50',
    forCurrency: false,
    forAssets: true,
  },
]

interface EventTypeStepProps {
  selectedType: EventKind | null
  onTypeSelect: (type: EventKind) => void
  isCurrencyAsset: boolean
}

export function EventTypeStep({ selectedType, onTypeSelect, isCurrencyAsset }: EventTypeStepProps) {
  const availableOptions = eventTypeOptions.filter(option => 
    isCurrencyAsset ? option.forCurrency : option.forAssets
  )

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Que tipo de operação você quer registrar?</h3>
        <p className="text-sm text-muted-foreground">
          {isCurrencyAsset 
            ? 'Para saldo em caixa, você pode registrar entradas ou saídas de dinheiro.'
            : 'Para ativos, você pode comprar, adicionar posições existentes ou avaliar.'
          }
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {availableOptions.map((option) => (
          <Card 
            key={option.kind}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md",
              selectedType === option.kind && "ring-2 ring-primary"
            )}
            onClick={() => onTypeSelect(option.kind)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className={cn("p-2 rounded-lg", option.color)}>
                  <option.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">{option.title}</CardTitle>
                    {option.isNew && (
                      <Badge variant="secondary" className="text-xs">
                        Novo
                      </Badge>
                    )}
                  </div>
                  <CardDescription className="text-xs">
                    {option.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

      {!isCurrencyAsset && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-3">
            <div className="text-blue-600">
              <Plus className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-blue-900 mb-1">
                💡 Novo: Adicionar Posição
              </h4>
              <p className="text-sm text-blue-800">
                Use esta opção para registrar ativos que você já possui. 
                Ideal para fazer um "inventário" do seu patrimônio atual, adicionando posições existentes ao seu portfólio.
              </p>
            </div>
          </div>
        </div>
      )}

      {selectedType && (
        <div className="text-center">
          <Button 
            className="w-full max-w-sm"
            onClick={() => {/* Next step logic */}}
          >
            Continuar com {eventTypeOptions.find(o => o.kind === selectedType)?.title}
          </Button>
        </div>
      )}
    </div>
  )
}