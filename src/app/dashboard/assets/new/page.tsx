"use client"

import { useState } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
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

const assetSchema = z.object({
  symbol: z.string().min(1, "Símbolo é obrigatório"),
  class: z.string().min(1, "Classe é obrigatória"),
  currency: z.string().min(1, "Moeda é obrigatória"),
  manual_price: z.string().optional(),
  connector: z.string().optional(),
})

type AssetForm = z.infer<typeof assetSchema>

export default function NewAssetPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<AssetForm>({
    resolver: zodResolver(assetSchema),
    defaultValues: {
      symbol: "",
      class: "stock",
      currency: "BRL",
      manual_price: "",
      connector: "",
    },
  })

  const onSubmit = async (data: AssetForm) => {
    if (!user) return

    setIsSubmitting(true)
    try {
      const assetData = {
        symbol: data.symbol.toUpperCase(),
        class: data.class,
        currency: data.currency,
        manual_price: data.manual_price ? parseFloat(data.manual_price) : null,
        connector: data.connector || null,
      }

      const { error } = await supabase
        .from('global_assets')
        .insert(assetData)

      if (error) throw error
      
      toast.success('Ativo criado com sucesso!')
      router.push('/dashboard/assets')
    } catch (error) {
      console.error('Erro ao criar ativo:', error)
      toast.error('Erro ao criar ativo')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8">
          <div className="mb-8">
            <Button variant="ghost" asChild className="mb-4">
              <Link href="/dashboard/assets">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para Ativos
              </Link>
            </Button>
            <h1 className="text-3xl font-bold">Novo Ativo</h1>
            <p className="text-muted-foreground">Adicione um novo ativo ao seu portfólio</p>
          </div>

          <div className="flex justify-center">
            <div className="w-full max-w-lg">
          <Card>
            <CardHeader>
              <CardTitle>Informações do Ativo</CardTitle>
              <CardDescription>
                Preencha os dados para adicionar o novo ativo
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="symbol"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Símbolo</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ex: PETR4, VALE3, BTC, USD"
                            value={field.value}
                            onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">Use o ticker ou código do ativo. Será convertido para maiúsculas.</p>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="class"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Classe do Ativo</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a classe" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="stock">Ação</SelectItem>
                            <SelectItem value="bond">Título</SelectItem>
                            <SelectItem value="fund">Fundo</SelectItem>
                            <SelectItem value="crypto">Criptomoeda</SelectItem>
                            <SelectItem value="currency">Moeda</SelectItem>
                            <SelectItem value="commodity">Commodities</SelectItem>
                            <SelectItem value="real_estate">Imóvel</SelectItem>
                            <SelectItem value="other">Outro</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="currency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Moeda</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a moeda" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="BRL">Real Brasileiro (BRL)</SelectItem>
                            <SelectItem value="USD">Dólar Americano (USD)</SelectItem>
                            <SelectItem value="EUR">Euro (EUR)</SelectItem>
                            <SelectItem value="GBP">Libra Esterlina (GBP)</SelectItem>
                            <SelectItem value="JPY">Iene Japonês (JPY)</SelectItem>
                            <SelectItem value="CHF">Franco Suíço (CHF)</SelectItem>
                            <SelectItem value="CAD">Dólar Canadense (CAD)</SelectItem>
                            <SelectItem value="AUD">Dólar Australiano (AUD)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="manual_price"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Preço Manual (Opcional)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number"
                            step="0.01"
                            placeholder="Ex: 25.50" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">Se preenchido, será usado como preço do ativo quando aplicável.</p>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="connector"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Conector (Opcional)</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ex: alpha_vantage, yahoo_finance" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">Integração para cotação automática (se disponível).</p>
                      </FormItem>
                    )}
                  />

                  <div className="flex space-x-4">
                    <Button type="submit" disabled={isSubmitting || !form.formState.isValid} className="flex-1">
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Criando...
                        </>
                      ) : (
                        <>
                          <Plus className="h-4 w-4 mr-2" />
                          Criar Ativo
                        </>
                      )}
                    </Button>
                    <Button type="button" variant="outline" asChild>
                      <Link href="/dashboard/assets">
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
