import * as React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Account, Asset } from "@/lib/supabase"
import { AssetBadge } from "@/components/ui/asset-badge"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import { Plus } from "lucide-react"

type EventKind = 'deposit' | 'withdraw' | 'buy' | 'valuation'

interface AssetAccountStepProps {
  eventKind: EventKind
  form: any // react-hook-form
  accounts: Account[]
  assets: Asset[]
  onNext: () => void
  onBack: () => void
}

export function AssetAccountStep({ 
  eventKind, 
  form, 
  accounts, 
  assets, 
  onNext, 
  onBack 
}: AssetAccountStepProps) {
  const selectedAssetId = form.watch('asset_id')
  const selectedAccountId = form.watch('account_id')
  const selectedToAccountId = form.watch('to_account_id')
  const selectedAsset = assets.find(a => a.id === selectedAssetId)
  
  const requiresAccount = ['deposit', 'withdraw', 'buy', 'valuation'].includes(eventKind)
  const isTransfer = false
  
  const canContinue = selectedAssetId && (!requiresAccount || (selectedAccountId && selectedAccountId !== 'none'))

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">
          Selecione o ativo e a conta
        </h3>
        <p className="text-sm text-muted-foreground">
          Escolha qual ativo será movimentado e em qual conta.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Ativo
              <Link 
                href="/dashboard/assets/new" 
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs underline text-muted-foreground hover:text-foreground"
              >
                Novo ativo ↗
              </Link>
            </CardTitle>
            <CardDescription>
              O que você quer movimentar?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <FormField
                control={form.control}
                name="asset_id"
                render={({ field }) => (
                  <FormItem>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o ativo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {assets.map((asset) => (
                          <SelectItem key={asset.id} value={asset.id}>
                            <div className="flex items-center gap-2">
                              <AssetBadge 
                                assetClass={asset.class as any}
                                size="sm"
                                showLabel={false}
                              />
                              <span>{asset.symbol}</span>
                            </div>
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center justify-between">
              Conta
              <Link href="/dashboard/accounts/new" className="text-xs underline text-muted-foreground">
                Nova conta
              </Link>
            </CardTitle>
            <CardDescription>
              {requiresAccount ? 'Obrigatória para esta operação' : 'Opcional'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <FormField
                control={form.control}
                name="account_id"
                render={({ field }) => (
                  <FormItem>
                    <Select onValueChange={field.onChange} value={field.value || "none"}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione a conta" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {!requiresAccount && (
                          <SelectItem value="none">Nenhuma conta</SelectItem>
                        )}
                        {accounts.map((account) => (
                          <SelectItem key={account.id} value={account.id}>
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{account.currency}</Badge>
                              <span>{account.label}</span>
                            </div>
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

      </div>

      {selectedAsset && (
        <Card className="border-dashed bg-muted/30">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">Você selecionou:</p>
              <div className="flex items-center justify-center gap-2">
                <AssetBadge assetClass={selectedAsset.class as any} />
                <span className="font-medium">{selectedAsset.symbol}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-4">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Voltar
        </Button>
        <Button 
          onClick={onNext} 
          disabled={!canContinue}
          className="flex-1"
        >
          Continuar
        </Button>
      </div>
    </div>
  )
}