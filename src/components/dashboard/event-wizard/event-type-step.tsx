import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { 
  ArrowDownCircle, 
  ArrowUpCircle, 
  ShoppingCart, 
  TrendingDown,
  RefreshCw,
  DollarSign,
  type LucideIcon
} from "lucide-react"
import { cn } from "@/lib/utils"

type EventKind = 'deposit' | 'withdraw' | 'buy' | 'valuation'

interface EventTypeOption {
  kind: EventKind
  title: string
  description: string
  icon: LucideIcon
  color: string
  forCurrency?: boolean
  forAssets?: boolean
}

const eventTypeOptions: EventTypeOption[] = [
  {
    kind: 'deposit',
    title: 'Depósito',
    description: 'Adicionar dinheiro ou ativos à conta',
    icon: ArrowDownCircle,
    color: 'text-green-600 bg-green-50',
    forCurrency: true,
    forAssets: true,
  },
  {
    kind: 'withdraw', 
    title: 'Saque',
    description: 'Retirar dinheiro ou ativos da conta',
    icon: ArrowUpCircle,
    color: 'text-red-600 bg-red-50',
    forCurrency: true,
    forAssets: true,
  },
  {
    kind: 'buy',
    title: 'Compra',
    description: 'Comprar ativos (ações, crypto, etc.)',
    icon: ShoppingCart,
    color: 'text-blue-600 bg-blue-50',
    forCurrency: false,
    forAssets: true,
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
            ? 'Para valores em dinheiro (caixa), você pode fazer depósitos ou saques.'
            : 'Para ativos (ações, crypto, etc.), você pode comprar ou avaliar.'
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
                <div>
                  <CardTitle className="text-base">{option.title}</CardTitle>
                  <CardDescription className="text-xs">
                    {option.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>

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