"use client"

import { useState } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { StatusBadge } from "@/components/ui/status-badge"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { ArrowLeft, Plus, Loader2 } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

const accountSchema = z.object({
  label: z.string().min(1, "Nome da conta é obrigatório"),
})

type AccountForm = z.infer<typeof accountSchema>

export default function NewAccountPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      label: "",
    },
  })

  const onSubmit = async (data: AccountForm) => {
    if (!user) return

    setIsSubmitting(true)
    try {
      const { error } = await supabase
        .from('accounts')
        .insert({
          user_id: user.id,
          label: data.label,
          currency: "BRL",
        })

      if (error) throw error
      
      toast.success('Conta criada com sucesso!')
      router.push('/dashboard/accounts')
    } catch (error) {
      console.error('Erro ao criar conta:', error)
      toast.error('Erro ao criar conta')
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
              <Link href="/dashboard/accounts">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para Contas
              </Link>
            </Button>
            <h1 className="text-3xl font-bold">Nova Conta</h1>
            <p className="text-muted-foreground">Crie uma nova conta para organizar seus investimentos</p>
          </div>

          <div className="flex justify-center">
            <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Informações da Conta</CardTitle>
              <CardDescription>
                Preencha os dados para criar sua nova conta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="label"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome da Conta</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ex: Conta Principal, Nubank, XP Investimentos" 
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">Um nome curto que você reconheça facilmente.</p>
                      </FormItem>
                    )}
                  />

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">Moeda</h4>
                        <p className="text-sm text-muted-foreground">Todas as contas operam em Real Brasileiro</p>
                      </div>
                      <StatusBadge variant="success" size="sm">BRL</StatusBadge>
                    </div>
                  </div>

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
                          Criar Conta
                        </>
                      )}
                    </Button>
                    <Button type="button" variant="outline" asChild>
                      <Link href="/dashboard/accounts">
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
