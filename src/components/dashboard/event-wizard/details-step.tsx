import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Account, Asset } from "@/lib/supabase"
import { AssetBadge } from "@/components/ui/asset-badge"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, Hash, DollarSign } from "lucide-react"

type EventKind = 'deposit' | 'withdraw' | 'buy' | 'sell' | 'transfer' | 'valuation'

interface DetailsStepProps {
  eventKind: EventKind
  form: any // react-hook-form
  accounts: Account[]
  assets: Asset[]
  onSubmit: () => void
  onBack: () => void
  isSubmitting: boolean
}

const eventDescriptions = {
  deposit: 'Informe a quantidade que será depositada',
  withdraw: 'Informe a quantidade que será sacada',
  buy: 'Informe a quantidade e o preço da compra',
  sell: 'Informe a quantidade e o preço da venda',
  transfer: 'Informe a quantidade que será transferida entre as contas',
  valuation: 'Informe o novo preço para avaliação',
}

export function DetailsStep({ 
  eventKind, 
  form, 
  accounts, 
  assets, 
  onSubmit, 
  onBack, 
  isSubmitting 
}: DetailsStepProps) {
  const selectedAssetId = form.watch('asset_id')
  const selectedAccountId = form.watch('account_id')
  const selectedToAccountId = form.watch('to_account_id')
  
  const selectedAsset = assets.find(a => a.id === selectedAssetId)
  const selectedAccount = accounts.find(a => a.id === selectedAccountId)
  const selectedToAccount = accounts.find(a => a.id === selectedToAccountId)
  
  const isCurrencyAsset = selectedAsset?.class === 'currency'
  const needsQuantity = ['deposit', 'withdraw', 'buy', 'sell', 'transfer'].includes(eventKind)
  const needsPrice = ['buy', 'sell'].includes(eventKind) && !isCurrencyAsset
  const needsPriceOverride = eventKind === 'valuation' && !isCurrencyAsset

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Detalhes da operação</h3>
        <p className="text-sm text-muted-foreground">
          {eventDescriptions[eventKind]}
        </p>
      </div>

      {/* Resumo da seleção */}
      <Card className="border-dashed bg-muted/30">
        <CardContent className="pt-6">
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2">
              <AssetBadge assetClass={selectedAsset?.class as any} />
              <span className="font-medium">{selectedAsset?.symbol}</span>
            </div>
            {eventKind === 'transfer' && selectedAccount && selectedToAccount ? (
              <div className="flex items-center justify-center gap-4 text-sm">
                <div className="flex items-center gap-2 bg-red-100 text-red-800 px-2 py-1 rounded">
                  <Badge variant="secondary">{selectedAccount.currency}</Badge>
                  <span>{selectedAccount.label}</span>
                  <span className="text-xs">(Origem)</span>
                </div>
                <span>→</span>
                <div className="flex items-center gap-2 bg-green-100 text-green-800 px-2 py-1 rounded">
                  <Badge variant="secondary">{selectedToAccount.currency}</Badge>
                  <span>{selectedToAccount.label}</span>
                  <span className="text-xs">(Destino)</span>
                </div>
              </div>
            ) : selectedAccount && (
              <div className="flex items-center justify-center gap-2 text-sm">
                <Badge variant="secondary">{selectedAccount.currency}</Badge>
                <span>{selectedAccount.label}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Form {...form}>
        <div className="space-y-4">
          {/* Data e Hora */}
          <FormField
            control={form.control}
            name="tstamp"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <CalendarDays className="h-4 w-4" />
                  Data e Hora
                </FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Quantidade */}
          {needsQuantity && (
            <FormField
              control={form.control}
              name="units_delta"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <Hash className="h-4 w-4" />
                    Quantidade *
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="text"
                      placeholder={isCurrencyAsset ? "Ex: 1000,00 ou 1000.00" : "Ex: 100 ou 100,5"} 
                      {...field}
                      onChange={(e) => {
                        // Permitir apenas números, vírgula, ponto e sinal negativo
                        const value = e.target.value.replace(/[^0-9,.-]/g, '')
                        field.onChange(value)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  {isCurrencyAsset ? (
                    <p className="text-xs text-muted-foreground">
                      Para dinheiro: 1 unidade = R$ 1,00. Aceita vírgula ou ponto como decimal.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      {eventKind === 'transfer' 
                        ? 'Quantidade que sairá da conta origem e entrará na conta destino. Use vírgula ou ponto para decimais.'
                        : 'Use valores positivos, o sistema ajustará automaticamente. Aceita vírgula ou ponto como decimal.'
                      }
                    </p>
                  )}
                </FormItem>
              )}
            />
          )}

          {/* Preço (para compra/venda) */}
          {needsPrice && (
            <FormField
              control={form.control}
              name="price_close"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Preço por unidade *
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="text"
                      placeholder="Ex: 25,50 ou 25.50" 
                      {...field}
                      onChange={(e) => {
                        // Permitir apenas números, vírgula e ponto
                        const value = e.target.value.replace(/[^0-9,.]/g, '')
                        field.onChange(value)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    Preço pago/recebido por cada unidade do ativo. Aceita vírgula ou ponto como decimal.
                  </p>
                </FormItem>
              )}
            />
          )}

          {/* Preço Override (para avaliação) */}
          {needsPriceOverride && (
            <FormField
              control={form.control}
              name="price_override"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    Preço de avaliação *
                  </FormLabel>
                  <FormControl>
                    <Input 
                      type="text"
                      placeholder="Ex: 25,30 ou 25.30" 
                      {...field}
                      onChange={(e) => {
                        // Permitir apenas números, vírgula e ponto
                        const value = e.target.value.replace(/[^0-9,.]/g, '')
                        field.onChange(value)
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    Preço atual que você considera para este ativo. Aceita vírgula ou ponto como decimal.
                  </p>
                </FormItem>
              )}
            />
          )}
        </div>
      </Form>

      <div className="flex gap-4">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Voltar
        </Button>
        <Button 
          onClick={onSubmit} 
          disabled={isSubmitting}
          className="flex-1"
        >
          {isSubmitting ? 'Criando...' : 'Criar Evento'}
        </Button>
      </div>
    </div>
  )
}