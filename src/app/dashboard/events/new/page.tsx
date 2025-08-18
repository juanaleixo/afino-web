"use client"

import { useState, useEffect, useCallback } from "react"
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
import { ArrowLeft, Plus, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

const eventSchema = z.object({
  asset_id: z.string().min(1, "Ativo é obrigatório"),
  account_id: z.string().optional(),
  kind: z.enum(['deposit', 'withdraw', 'buy', 'sell', 'transfer', 'valuation']),
  units_delta: z.string().optional(),
  price_override: z.string().optional(),
  price_close: z.string().optional(),
  tstamp: z.string().min(1, "Data é obrigatória"),
}).refine((data) => {
  if (data.kind === 'deposit' || data.kind === 'withdraw') {
    return data.units_delta && parseFloat(data.units_delta) > 0
  }
  if (data.kind === 'buy' || data.kind === 'sell') {
    return data.units_delta && parseFloat(data.units_delta) > 0 && data.price_override && parseFloat(data.price_override) > 0
  }
  if (data.kind === 'transfer') {
    return data.units_delta && parseFloat(data.units_delta) !== 0
  }
  if (data.kind === 'valuation') {
    return data.price_override && parseFloat(data.price_override) > 0
  }
  return true
}, {
  message: "Dados obrigatórios não fornecidos para o tipo de evento selecionado"
}).refine((data) => {
  // Validação adicional para garantir que apenas os campos relevantes sejam preenchidos
  if (data.kind === 'deposit' || data.kind === 'withdraw') {
    return !data.price_override && !data.price_close
  }
  if (data.kind === 'buy' || data.kind === 'sell') {
    return !data.price_close
  }
  if (data.kind === 'transfer') {
    return !data.price_override && !data.price_close
  }
  if (data.kind === 'valuation') {
    return !data.units_delta && !data.price_close
  }
  return true
}, {
  message: "Apenas os campos relevantes para o tipo de evento devem ser preenchidos"
})

type EventForm = z.infer<typeof eventSchema>

export default function NewEventPage() {
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
      tstamp: new Date().toISOString().split('T')[0] || "",
    },
  })

  // Função para limpar campos não relevantes quando o tipo de evento muda
  const handleKindChange = (newKind: string) => {
    form.setValue('kind', newKind as 'deposit' | 'withdraw' | 'buy' | 'sell' | 'transfer' | 'valuation')
    
    // Limpar campos não relevantes
    if (newKind === 'deposit' || newKind === 'withdraw') {
      form.setValue('price_override', '')
      form.setValue('price_close', '')
    } else if (newKind === 'buy' || newKind === 'sell') {
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

  const onSubmit = async (data: EventForm) => {
    if (!user) return

    setIsSubmitting(true)
    try {
      // Validações específicas por tipo de evento
      if (data.kind === 'deposit' || data.kind === 'withdraw') {
        if (!data.units_delta || parseFloat(data.units_delta) <= 0) {
          throw new Error('Quantidade é obrigatória e deve ser maior que zero para depósitos e saques')
        }
      }
      
      if (data.kind === 'buy' || data.kind === 'sell') {
        if (!data.units_delta || parseFloat(data.units_delta) <= 0) {
          throw new Error('Quantidade é obrigatória e deve ser maior que zero para compras e vendas')
        }
        if (!data.price_override || parseFloat(data.price_override) <= 0) {
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
        tstamp: new Date(data.tstamp).toISOString(),
      }

      // Adicionar account_id apenas se não for "none"
      if (data.account_id && data.account_id !== "none") {
        eventData.account_id = data.account_id
      }

      // Adicionar campos específicos por tipo de evento
      if (data.kind === 'deposit' || data.kind === 'withdraw') {
        eventData.units_delta = parseFloat(data.units_delta!)
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
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <Button variant="ghost" asChild className="mb-4">
              <Link href="/dashboard/events">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para Eventos
              </Link>
            </Button>
            <h1 className="text-3xl font-bold">Novo Evento</h1>
            <p className="text-muted-foreground">Registre uma nova transação ou evento</p>
          </div>

          <div className="flex justify-center">
            <div className="w-full max-w-lg">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Evento</CardTitle>
              <CardDescription>
                Preencha os dados para registrar o novo evento
              </CardDescription>
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
                                {asset.symbol} - {asset.class}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="account_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Conta (Opcional)</FormLabel>
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
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="kind"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Evento</FormLabel>
                        <Select onValueChange={handleKindChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o tipo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="deposit">Depósito</SelectItem>
                            <SelectItem value="withdraw">Saque</SelectItem>
                            <SelectItem value="buy">Compra</SelectItem>
                            <SelectItem value="sell">Venda</SelectItem>
                            <SelectItem value="transfer">Transferência</SelectItem>
                            <SelectItem value="valuation">Avaliação</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                        {field.value === 'deposit' && (
                          <p className="text-sm text-muted-foreground">
                            Registra um depósito de ativos. Use valores positivos.
                          </p>
                        )}
                        {field.value === 'withdraw' && (
                          <p className="text-sm text-muted-foreground">
                            Registra um saque de ativos. Use valores negativos.
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
                            Registra uma transferência de ativos entre contas.
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
                        <FormLabel>Data</FormLabel>
                        <FormControl>
                          <Input 
                            type="date"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />



                  <FormField
                    control={form.control}
                    name="price_override"
                    render={({ field }) => (
                      <FormItem className={form.watch('kind') !== 'valuation' ? 'hidden' : ''}>
                        <FormLabel>Preço Manual *</FormLabel>
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

                  <FormField
                    control={form.control}
                    name="units_delta"
                    render={({ field }) => (
                      <FormItem className={form.watch('kind') === 'deposit' || form.watch('kind') === 'withdraw' || form.watch('kind') === 'buy' || form.watch('kind') === 'sell' || form.watch('kind') === 'transfer' ? '' : 'hidden'}>
                        <FormLabel>Quantidade *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            step="0.000001"
                            placeholder="Ex: 100 (positivo) ou -50 (negativo)" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="price_override"
                    render={({ field }) => (
                      <FormItem className={form.watch('kind') === 'buy' || form.watch('kind') === 'sell' || form.watch('kind') === 'valuation' ? '' : 'hidden'}>
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
        </div>
      </div>
    </ProtectedRoute>
  )
} 