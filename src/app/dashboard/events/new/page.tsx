"use client"

import { Suspense, useState, useEffect, useCallback, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import ProtectedRoute from "@/components/ProtectedRoute"
import { useAuth } from "@/lib/auth"
import { supabase, Account, Asset } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { ArrowLeft, Plus, Loader2, Calendar, ChevronRight } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

const eventSchema = z
  .object({
    asset_id: z.string().min(1, "Ativo é obrigatório"),
    account_id: z.string().optional(),
    kind: z.enum(['deposit', 'withdraw', 'buy', 'sell', 'transfer', 'valuation']),
    units_delta: z.string().optional(),
    price_override: z.string().optional(),
    price_close: z.string().optional(),
    tstamp: z.string().min(1, "Data é obrigatória"),
  })
  .refine((data) => {
    // Regras obrigatórias por tipo
    if (data.kind === 'deposit') {
      return !!data.units_delta && Math.abs(parseFloat(data.units_delta)) > 0
    }
    if (data.kind === 'withdraw') {
      return !!data.units_delta && Math.abs(parseFloat(data.units_delta)) > 0
    }
    if (data.kind === 'buy' || data.kind === 'sell') {
      return (
        !!data.units_delta && Math.abs(parseFloat(data.units_delta)) > 0 &&
        !!data.price_close && parseFloat(data.price_close) > 0
      )
    }
    if (data.kind === 'transfer') {
      return !!data.units_delta && parseFloat(data.units_delta) !== 0
    }
    if (data.kind === 'valuation') {
      return !!data.price_override && parseFloat(data.price_override) > 0
    }
    return true
  }, {
    message: "Dados obrigatórios não fornecidos para o tipo de evento selecionado",
  })
  .refine((data) => {
    // Apenas os campos relevantes devem ser preenchidos
    if (data.kind === 'deposit' || data.kind === 'withdraw') {
      return !data.price_override && !data.price_close
    }
    if (data.kind === 'buy' || data.kind === 'sell') {
      return !data.price_override
    }
    if (data.kind === 'transfer') {
      return !data.price_override && !data.price_close
    }
    if (data.kind === 'valuation') {
      return !data.units_delta && !data.price_close
    }
    return true
  }, {
    message: "Apenas os campos relevantes para o tipo de evento devem ser preenchidos",
  })
  .refine((data) => {
    // Para eventos que movimentam conta (inclui valuation), conta é obrigatória
    if (['deposit', 'withdraw', 'buy', 'sell', 'transfer', 'valuation'].includes(data.kind)) {
      return !!data.account_id && data.account_id !== 'none'
    }
    return true
  }, {
    message: "Selecione uma conta para este tipo de evento",
    path: ['account_id'],
  })

type EventForm = z.infer<typeof eventSchema>

function NewEventInner() {
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)

  const form = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      asset_id: "",
      account_id: "none",
      kind: "buy",
      units_delta: "",
      price_override: "",
      price_close: "",
      tstamp: new Date().toISOString().slice(0, 16) || "",
    },
  })

  // Helper: verificar se o ativo selecionado é "Caixa"
  const selectedAssetId = form.watch('asset_id')
  const isCurrencyAsset = useMemo(() => {
    const asset = assets.find(a => a.id === selectedAssetId)
    const sym = asset?.symbol?.toUpperCase()
    return !!asset && (asset.class === 'currency' || sym === 'BRL' || sym === 'CASH')
  }, [assets, selectedAssetId])

  // Opções permitidas por classe do ativo
  const allowedKinds = useMemo(() => {
    return isCurrencyAsset
      ? (['deposit', 'withdraw', 'transfer'] as const)
      : (['buy', 'sell', 'transfer', 'valuation'] as const)
  }, [isCurrencyAsset])

  // Ajustar kind quando o ativo muda para respeitar allowedKinds
  useEffect(() => {
    const currentKind = form.getValues('kind')
    if (!allowedKinds.includes(currentKind as any)) {
      form.setValue('kind', allowedKinds[0] as any)
    }
  }, [allowedKinds, form])

  // Função para limpar campos não relevantes quando o tipo de evento muda
  const handleKindChange = (newKind: string) => {
    form.setValue('kind', newKind as 'deposit' | 'withdraw' | 'buy' | 'sell' | 'transfer' | 'valuation')
    
    // Limpar campos não relevantes
    if (newKind === 'deposit' || newKind === 'withdraw') {
      form.setValue('price_override', '')
      form.setValue('price_close', '')
    } else if (newKind === 'buy' || newKind === 'sell') {
      form.setValue('price_override', '')
      form.setValue('price_close', '')
    } else if (newKind === 'transfer') {
      form.setValue('price_override', '')
      form.setValue('price_close', '')
    } else if (newKind === 'valuation') {
      form.setValue('units_delta', '')
      form.setValue('price_close', '')
    }
  }

  const loadData = useCallback(async () => {
    if (!user) return

    try {
      // Carregar contas
      const { data: accountsData, error: accountsError } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('label', { ascending: true })

      if (accountsError) throw accountsError

      // Carregar ativos
      const { data: assetsData, error: assetsError } = await supabase
        .from('global_assets')
        .select('*')
        .order('symbol', { ascending: true })

      if (assetsError) throw assetsError

      setAccounts(accountsData || [])
      // selecionar conta padrão se necessário
      const requiresAccount = ['deposit','withdraw','buy','sell','transfer','valuation'].includes(form.getValues('kind'))
      if (requiresAccount && accountsData && accountsData.length > 0 && (!form.getValues('account_id') || form.getValues('account_id') === 'none')) {
        form.setValue('account_id', accountsData[0].id)
      }
      setAssets(assetsData || [])
      setLoading(false)
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast.error('Erro ao carregar dados')
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Preselecionar via query params (asset_id, kind, account_id)
  useEffect(() => {
    const qpAsset = searchParams.get('asset_id')
    const qpKind = searchParams.get('kind') as EventForm['kind'] | null
    const qpAccount = searchParams.get('account_id')
    if (qpAsset) {
      form.setValue('asset_id', qpAsset)
    }
    if (qpKind) {
      form.setValue('kind', qpKind)
    }
    if (qpAccount) {
      form.setValue('account_id', qpAccount)
    }
  }, [searchParams])

  const onSubmit = async (data: EventForm) => {
    if (!user) return

    setIsSubmitting(true)
    try {
      // Validações específicas por tipo de evento
      // Impedir operações não permitidas em cash
      const selectedAsset = assets.find(a => a.id === data.asset_id)
      const assetIsCash = selectedAsset?.class === 'currency'
      if (assetIsCash && (data.kind === 'buy' || data.kind === 'sell' || data.kind === 'valuation')) {
        throw new Error('Para cash, use depósito, saque ou transferência (1 unidade = R$ 1,00).')
      }
      if (data.kind === 'deposit' || data.kind === 'withdraw') {
        if (!data.units_delta || parseFloat(data.units_delta) <= 0) {
          throw new Error('Quantidade é obrigatória e deve ser maior que zero para depósitos e saques')
        }
      }
      
      if (data.kind === 'buy' || data.kind === 'sell') {
        if (!data.units_delta || parseFloat(data.units_delta) <= 0) {
          throw new Error('Quantidade é obrigatória e deve ser maior que zero para compras e vendas')
        }
        if (!data.price_close || parseFloat(data.price_close) <= 0) {
          throw new Error('Preço é obrigatório e deve ser maior que zero para compras e vendas')
        }
      }
      
      if (data.kind === 'transfer') {
        if (!data.units_delta || parseFloat(data.units_delta) === 0) {
          throw new Error('Quantidade é obrigatória e deve ser diferente de zero para transferências')
        }
      }
      
      if (data.kind === 'valuation') {
        if (!data.price_override || parseFloat(data.price_override) <= 0) {
          throw new Error('Preço é obrigatório e deve ser maior que zero para avaliações')
        }
      }

      // Preparar dados para inserção
      const eventData: any = {
        user_id: user.id,
        asset_id: data.asset_id,
        kind: data.kind,
        // tstamp em datetime-local
        tstamp: new Date(data.tstamp).toISOString(),
      }

      // Adicionar account_id apenas se não for "none"
      if (data.account_id && data.account_id !== "none") {
        eventData.account_id = data.account_id
      }

      // Adicionar campos específicos por tipo de evento
      if (data.kind === 'deposit' || data.kind === 'withdraw') {
        const qty = parseFloat(data.units_delta!)
        // Depósito sempre positivo, Saque sempre negativo
        eventData.units_delta = data.kind === 'withdraw' ? -Math.abs(qty) : Math.abs(qty)
      } else if (data.kind === 'buy' || data.kind === 'sell') {
        const qty = parseFloat(data.units_delta!)
        // Compra positiva, Venda negativa
        eventData.units_delta = data.kind === 'sell' ? -Math.abs(qty) : Math.abs(qty)
        eventData.price_close = parseFloat(data.price_close!)
      } else if (data.kind === 'valuation') {
        eventData.price_override = parseFloat(data.price_override!)
      } else if (data.kind === 'transfer') {
        eventData.units_delta = parseFloat(data.units_delta!)
      }

      console.log('Dados do evento a serem inseridos:', eventData)

      const { error } = await supabase
        .from('events')
        .insert(eventData)

      if (error) {
        console.error('Erro do Supabase:', error)
        throw error
      }
      
      toast.success('Evento criado com sucesso!')
      router.push('/dashboard/events')
    } catch (error: any) {
      console.error('Erro ao criar evento:', error)
      toast.error(error.message || 'Erro ao criar evento')
    } finally {
      setIsSubmitting(false)
    }
  }



  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span>Carregando dados...</span>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link href="/dashboard/events">
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar
                  </Button>
                </Link>
                <nav aria-label="Trilha de navegação" className="text-sm text-muted-foreground">
                  <ol className="flex items-center gap-1">
                    <li>
                      <Link href="/dashboard" className="hover:text-foreground">Painel</Link>
                    </li>
                    <li><ChevronRight className="h-3.5 w-3.5" /></li>
                    <li>
                      <Link href="/dashboard/events" className="hover:text-foreground">Eventos</Link>
                    </li>
                    <li><ChevronRight className="h-3.5 w-3.5" /></li>
                    <li className="text-foreground">Novo</li>
                  </ol>
                </nav>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          <div className="flex justify-center">
            <div className="w-full max-w-lg">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-2">
                <Calendar className="h-5 w-5 text-primary" />
                <CardTitle>Novo Evento</CardTitle>
              </div>
              <CardDescription>Registre uma nova transação ou evento</CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="asset_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ativo</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o ativo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {assets.map((asset) => (
                              <SelectItem key={asset.id} value={asset.id}>
                                {asset.symbol} {asset.class === 'currency' ? '(Caixa)' : `(${asset.class})`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">
                          Se não encontrar o ativo, cadastre em “Ativos”.
                        </p>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="account_id"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Conta</FormLabel>
                          <Link href="/dashboard/accounts/new" className="text-xs underline text-muted-foreground">Nova conta</Link>
                        </div>
                        <Select onValueChange={field.onChange} value={field.value || "none"}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a conta (opcional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="none">Nenhuma conta</SelectItem>
                            {accounts.map((account) => (
                              <SelectItem key={account.id} value={account.id}>
                                {account.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">Obrigatória para depósito, saque, compra, venda e transferência.</p>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="kind"
                    render={({ field }) => (
                      <FormItem>
                        <div className="flex items-center justify-between">
                          <FormLabel>Tipo de Evento</FormLabel>
                          <Link href="/dashboard/assets/new" className="text-xs underline text-muted-foreground">Novo ativo</Link>
                        </div>
                        <Select onValueChange={handleKindChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {allowedKinds.includes('deposit' as any) && (
                              <SelectItem value="deposit">Depósito</SelectItem>
                            )}
                            {allowedKinds.includes('withdraw' as any) && (
                              <SelectItem value="withdraw">Saque</SelectItem>
                            )}
                            {allowedKinds.includes('buy' as any) && (
                              <SelectItem value="buy">Compra</SelectItem>
                            )}
                            {allowedKinds.includes('sell' as any) && (
                              <SelectItem value="sell">Venda</SelectItem>
                            )}
                            {allowedKinds.includes('transfer' as any) && (
                              <SelectItem value="transfer">Transferência</SelectItem>
                            )}
                            {allowedKinds.includes('valuation' as any) && (
                              <SelectItem value="valuation">Avaliação</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                        {field.value === 'deposit' && (
                          <p className="text-sm text-muted-foreground">
                            {isCurrencyAsset
                              ? 'Registra um depósito em cash. 1 unidade = R$ 1,00.'
                              : 'Registra um depósito de ativos. Use valores positivos.'}
                          </p>
                        )}
                        {field.value === 'withdraw' && (
                          <p className="text-sm text-muted-foreground">
                            {isCurrencyAsset
                              ? 'Registra um saque em cash. 1 unidade = R$ 1,00.'
                              : 'Registra um saque de ativos.'}
                          </p>
                        )}
                        {field.value === 'buy' && (
                          <p className="text-sm text-muted-foreground">
                            Registra uma compra de ativos. Use valores positivos.
                          </p>
                        )}
                        {field.value === 'sell' && (
                          <p className="text-sm text-muted-foreground">
                            Registra uma venda de ativos. Use valores negativos.
                          </p>
                        )}
                        {field.value === 'transfer' && (
                          <p className="text-sm text-muted-foreground">
                            {isCurrencyAsset
                              ? 'Transfere cash entre contas. 1 unidade = R$ 1,00.'
                              : 'Registra uma transferência de ativos entre contas.'}
                          </p>
                        )}
                        {field.value === 'valuation' && (
                          <p className="text-sm text-muted-foreground">
                            Define um preço manual para o ativo, útil para ativos sem cotação pública ou para ajustes.
                          </p>
                        )}
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tstamp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Data e Hora</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />



                  <FormField
                    control={form.control}
                    name="units_delta"
                    render={({ field }) => (
                      <FormItem className={['deposit','withdraw','buy','sell','transfer'].includes(form.watch('kind')) ? '' : 'hidden'}>
                        <FormLabel>Quantidade *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            step="0.000001"
                            placeholder="Ex: 100" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">
                          Depósito/Compra usam quantidade positiva; Saque/Venda serão convertidos para negativa automaticamente.
                        </p>
                      </FormItem>
                    )}
                  />

                  {/* Preço para buy/sell: usa price_close (não aparece para cash) */}
                  <FormField
                    control={form.control}
                    name="price_close"
                    render={({ field }) => (
                      <FormItem className={['buy','sell'].includes(form.watch('kind')) && !isCurrencyAsset ? '' : 'hidden'}>
                        <FormLabel>Preço *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            step="0.01"
                            placeholder="Ex: 25.50" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Preço para valuation: usa price_override (evitar para cash) */}
                  <FormField
                    control={form.control}
                    name="price_override"
                    render={({ field }) => (
                      <FormItem className={form.watch('kind') === 'valuation' && !isCurrencyAsset ? '' : 'hidden'}>
                        <FormLabel>Preço *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            step="0.01"
                            placeholder="Ex: 25.50" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex space-x-4">
                    <Button type="submit" disabled={isSubmitting} className="flex-1">
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Criando...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Criar Evento
                        </>
                      )}
                    </Button>
                    <Button type="button" variant="outline" asChild>
                      <Link href="/dashboard/events">
                        Cancelar
                      </Link>
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
            </div>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  )
}

export default function NewEventPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><span>Carregando...</span></div>}>
      <NewEventInner />
    </Suspense>
  )
}
