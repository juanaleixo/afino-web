import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { AssetBadge } from "@/components/ui/asset-badge"
import { Asset } from "@/lib/supabase"
import { formatCurrency, parseDecimalInput, formatNumber } from "@/lib/utils/formatters"
import { Calendar, DollarSign, Hash } from "lucide-react"
import { OperationType } from "./index"

interface DetailsFormStepProps {
  form: any
  selectedOperation: OperationType
  selectedAsset: Asset | undefined
  onSubmit: () => void
  onBack: () => void
  isSubmitting: boolean
}

const operationTitles: Record<OperationType, string> = {
  'add_existing': 'Informações do Patrimônio',
  'money_in': 'Detalhes da Entrada',
  'money_out': 'Detalhes da Saída',
  'purchase': 'Detalhes da Compra',
  'update_value': 'Novo Valor'
}

export function DetailsFormStep({ 
  form, 
  selectedOperation,
  selectedAsset,
  onSubmit, 
  onBack,
  isSubmitting 
}: DetailsFormStepProps) {
  
  const isCashAsset = selectedAsset?.class === 'currency' || selectedAsset?.class === 'cash'
  const showQuantity = !isCashAsset && selectedOperation !== 'update_value'
  const showPrice = ['purchase', 'add_existing', 'update_value'].includes(selectedOperation) && !isCashAsset

  // Calcular valor total para exibição
  const amount = parseDecimalInput(form.watch('amount'))
  const price = parseDecimalInput(form.watch('price'))
  const totalValue = showQuantity && showPrice ? amount * price : (showPrice ? price : amount)

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-xl font-semibold">
          {operationTitles[selectedOperation]}
        </h3>
        {selectedAsset && (
          <div className="flex items-center justify-center gap-2">
            <AssetBadge assetClass={selectedAsset.class as any} />
            <span className="font-medium">{selectedAsset.symbol}</span>
            {selectedAsset.label_ptbr && (
              <span className="text-muted-foreground">- {selectedAsset.label_ptbr}</span>
            )}
          </div>
        )}
      </div>

      <Form {...form}>
        <div className="space-y-4">
          {/* Campo de quantidade/valor */}
          {showQuantity && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Hash className="h-4 w-4" />
                  {isCashAsset ? 'Valor' : 'Quantidade'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          {...field}
                          type="text"
                          inputMode="decimal"
                          placeholder={isCashAsset ? "0,00" : "0"}
                          className="text-lg"
                          onChange={(e) => {
                            const value = e.target.value
                            field.onChange(value)
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                      {isCashAsset && (
                        <p className="text-sm text-muted-foreground mt-1">
                          Digite o valor em {selectedAsset?.currency || 'BRL'}
                        </p>
                      )}
                      {!isCashAsset && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedOperation === 'add_existing' && "Quantas unidades você já possui?"}
                          {selectedOperation === 'purchase' && "Quantas unidades está comprando?"}
                          {selectedOperation === 'money_in' && "Quanto está depositando?"}
                          {selectedOperation === 'money_out' && "Quanto está retirando?"}
                        </p>
                      )}
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Campo de preço */}
          {showPrice && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  {selectedOperation === 'update_value' ? 'Valor Total Atual' : 'Preço Unitário'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="price"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Input
                          {...field}
                          type="text"
                          inputMode="decimal"
                          placeholder="0,00"
                          className="text-lg"
                          onChange={(e) => {
                            const value = e.target.value
                            field.onChange(value)
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                      <p className="text-sm text-muted-foreground mt-1">
                        {selectedOperation === 'update_value' 
                          ? "Qual o valor total atual deste ativo?"
                          : "Valor por unidade em " + (selectedAsset?.currency || 'BRL')
                        }
                      </p>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Valor total calculado */}
          {showQuantity && showPrice && totalValue > 0 && (
            <Card className="bg-muted/50">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">Valor Total</p>
                  <p className="text-2xl font-bold mt-1">
                    {formatCurrency(totalValue, selectedAsset?.currency || 'BRL')}
                  </p>
                  {(selectedOperation as OperationType) !== 'update_value' && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatNumber(amount)} × {formatCurrency(price, selectedAsset?.currency || 'BRL')}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Data */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data da Operação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        {...field}
                        type="datetime-local"
                        className="text-base"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          {/* Observações */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Observações (opcional)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder="Adicione detalhes ou notas sobre esta operação..."
                        rows={3}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>
        </div>
      </Form>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} disabled={isSubmitting}>
          Voltar
        </Button>
        <Button onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? "Salvando..." : "Concluir"}
        </Button>
      </div>
    </div>
  )
}