import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Home,
  Car,
  TrendingUp,
  DollarSign,
  ArrowDownCircle,
  ArrowUpCircle,
  ShoppingCart,
  RefreshCw,
  type LucideIcon
} from "lucide-react"
import { cn } from "@/lib/utils"
import { OperationType } from "./index"

interface OperationOption {
  type: OperationType
  title: string
  description: string
  icon: LucideIcon
  color: string
  examples: string[]
  recommended?: boolean
}

const operationOptions: OperationOption[] = [
  {
    type: 'add_existing',
    title: 'Adicionar Posição Existente',
    description: 'Registre ativos que você já possui hoje',
    icon: Home,
    color: 'text-purple-600 bg-purple-50 dark:bg-purple-950',
    examples: ['Ações em carteira', 'Fundos atuais', 'Criptomoedas', 'Imóveis'],
    recommended: true
  },
  {
    type: 'money_in',
    title: 'Entrada de Dinheiro',
    description: 'Registre recebimento de valores em caixa',
    icon: ArrowDownCircle,
    color: 'text-green-600 bg-green-50 dark:bg-green-950',
    examples: ['Depósito', 'Salário', 'Rendimentos', 'Dividendos']
  },
  {
    type: 'money_out',
    title: 'Saída de Dinheiro', 
    description: 'Registre retiradas de caixa',
    icon: ArrowUpCircle,
    color: 'text-red-600 bg-red-50 dark:bg-red-950',
    examples: ['Despesas', 'Transferências', 'Impostos', 'Saques']
  },
  {
    type: 'purchase',
    title: 'Compra de Ativo',
    description: 'Registre aquisição de novos investimentos',
    icon: ShoppingCart,
    color: 'text-blue-600 bg-blue-50 dark:bg-blue-950',
    examples: ['Compra de ações', 'Aquisição de crypto', 'Novos fundos']
  },
  {
    type: 'update_value',
    title: 'Atualizar Valor',
    description: 'Atualize o valor de mercado de um ativo',
    icon: RefreshCw,
    color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950',
    examples: ['Novo valor do imóvel', 'Cotação atualizada', 'Avaliação de veículo']
  }
]

interface OperationTypeStepProps {
  selectedOperation: OperationType | null
  onOperationSelect: (operation: OperationType) => void
  hasAssets: boolean
  isCurrencyAsset?: boolean
}

export function OperationTypeStep({ 
  selectedOperation, 
  onOperationSelect,
  hasAssets,
  isCurrencyAsset = false
}: OperationTypeStepProps) {
  
  // Filtrar opções baseado no contexto
  let availableOptions = operationOptions
  
  if (!hasAssets) {
    // Se não tem ativos, mostrar apenas adicionar patrimônio e entrada
    availableOptions = operationOptions.filter(opt => ['add_existing', 'money_in'].includes(opt.type))
  } else if (isCurrencyAsset) {
    // Para ativos de caixa, só permitir entrada/saída de dinheiro
    availableOptions = operationOptions.filter(opt => ['money_in', 'money_out'].includes(opt.type))
  } else {
    // Para outros ativos, não permitir entrada/saída direta de dinheiro
    availableOptions = operationOptions.filter(opt => !['money_in', 'money_out'].includes(opt.type))
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-2xl font-semibold">O que você deseja fazer?</h3>
        <p className="text-muted-foreground">
          {!hasAssets 
            ? 'Comece adicionando seu patrimônio atual ou fazendo um depósito inicial'
            : isCurrencyAsset
            ? 'Para ativos de caixa, você pode registrar entradas ou saídas de dinheiro'
            : 'Para ativos de investimento, você pode comprar, adicionar posições existentes ou atualizar valores'
          }
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {availableOptions.map((option) => (
          <Card
            key={option.type}
            className={cn(
              "cursor-pointer transition-all hover:shadow-md relative overflow-hidden",
              selectedOperation === option.type && "ring-2 ring-primary"
            )}
            onClick={() => onOperationSelect(option.type)}
          >
            {option.recommended && (
              <div className="absolute top-2 right-2">
                <Badge variant="secondary" className="text-xs">
                  Recomendado
                </Badge>
              </div>
            )}
            
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <div className={cn("p-2 rounded-lg", option.color)}>
                  <option.icon className="h-5 w-5" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-base">{option.title}</CardTitle>
                  <CardDescription className="text-sm mt-1">
                    {option.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Exemplos:</p>
                <div className="flex flex-wrap gap-1">
                  {option.examples.map((example, idx) => (
                    <Badge 
                      key={idx} 
                      variant="outline" 
                      className="text-xs"
                    >
                      {example}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {!hasAssets && (
        <div className="mt-6 p-4 bg-muted/50 rounded-lg text-center">
          <p className="text-sm text-muted-foreground">
            💡 <strong>Dica:</strong> Comece registrando os ativos que você já possui 
            para ter uma visão completa do seu patrimônio desde o início.
          </p>
        </div>
      )}
    </div>
  )
}