"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/lib/auth"
import { supabase, Account } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LoadingState } from "@/components/ui/loading-state"
import { StatusBadge } from "@/components/ui/status-badge"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Plus, Edit, Trash2, Wallet } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

const accountSchema = z.object({
  label: z.string().min(1, "Nome da conta é obrigatório"),
  currency: z.string().min(1, "Moeda é obrigatória"),
})

type AccountForm = z.infer<typeof accountSchema>

export default function AccountsPage() {
  const { user } = useAuth()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState<Account | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<AccountForm>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      label: "",
      currency: "BRL",
    },
  })

  // Carregar contas
  const loadAccounts = useCallback(async () => {
    if (!user) return

    try {
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      setAccounts(data || [])
    } catch (error) {
      console.error('Erro ao carregar contas:', error)
      toast.error('Erro ao carregar contas')
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadAccounts()
  }, [loadAccounts])

  // Criar/Editar conta
  const onSubmit = async (data: AccountForm) => {
    if (!user) return

    setIsSubmitting(true)
    
    const optimisticAccount = {
      id: editingAccount?.id || crypto.randomUUID(),
      user_id: user.id,
      label: data.label,
      currency: data.currency,
      created_at: editingAccount?.created_at || new Date().toISOString(),
    }

    try {
      if (editingAccount) {
        // Optimistic update: Atualizar imediatamente na UI
        setAccounts(prev => 
          prev.map(acc => 
            acc.id === editingAccount.id 
              ? { ...acc, label: data.label, currency: data.currency }
              : acc
          )
        )

        // Editar conta existente no servidor
        const { error } = await supabase
          .from('accounts')
          .update({
            label: data.label,
            currency: data.currency,
          })
          .eq('id', editingAccount.id)
          .eq('user_id', user.id)

        if (error) {
          // Rollback em caso de erro
          setAccounts(prev => 
            prev.map(acc => 
              acc.id === editingAccount.id 
                ? editingAccount  // Restaurar valores originais
                : acc
            )
          )
          throw error
        }
        toast.success('Conta atualizada com sucesso!')
      } else {
        // Optimistic update: Adicionar imediatamente à lista
        setAccounts(prev => [optimisticAccount, ...prev])

        // Criar nova conta no servidor
        const { data: newAccount, error } = await supabase
          .from('accounts')
          .insert({
            user_id: user.id,
            label: data.label,
            currency: data.currency,
          })
          .select()
          .single()

        if (error) {
          // Rollback em caso de erro
          setAccounts(prev => prev.filter(acc => acc.id !== optimisticAccount.id))
          throw error
        }

        // Substituir pela conta real do servidor (com ID correto)
        setAccounts(prev => 
          prev.map(acc => 
            acc.id === optimisticAccount.id ? newAccount : acc
          )
        )
        toast.success('Conta criada com sucesso!')
      }

      setIsDialogOpen(false)
      setEditingAccount(null)
      form.reset()
    } catch (error) {
      console.error('Erro ao salvar conta:', error)
      toast.error('Erro ao salvar conta')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Excluir conta
  const deleteAccount = async (accountId: string) => {
    if (!user || !confirm('Tem certeza que deseja excluir esta conta?')) return

    // Guardar a conta para rollback se necessário
    const accountToDelete = accounts.find(acc => acc.id === accountId)
    if (!accountToDelete) return

    try {
      // Optimistic update: Remover imediatamente da UI
      setAccounts(prev => prev.filter(acc => acc.id !== accountId))

      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', accountId)
        .eq('user_id', user.id)

      if (error) {
        // Rollback em caso de erro - restaurar a conta na posição original
        setAccounts(prev => {
          const newAccounts = [...prev]
          const originalIndex = accounts.findIndex(acc => acc.id === accountId)
          newAccounts.splice(originalIndex, 0, accountToDelete)
          return newAccounts
        })
        throw error
      }
      
      toast.success('Conta excluída com sucesso!')
    } catch (error) {
      console.error('Erro ao excluir conta:', error)
      toast.error('Erro ao excluir conta')
    }
  }

  // Abrir modal de edição
  const openEditDialog = (account: Account) => {
    setEditingAccount(account)
    form.reset({
      label: account.label,
      currency: account.currency,
    })
    setIsDialogOpen(true)
  }

  // Abrir modal de criação
  const openCreateDialog = () => {
    setEditingAccount(null)
    form.reset({
      label: "",
      currency: "BRL",
    })
    setIsDialogOpen(true)
  }

  const currencies = [
    { code: "BRL", name: "Real Brasileiro" },
    { code: "USD", name: "Dólar Americano" },
    { code: "EUR", name: "Euro" },
    { code: "GBP", name: "Libra Esterlina" },
  ]

  if (loading) {
    return (
      <DashboardLayout
        title="Contas"
        description="Gerencie suas contas bancárias"
        icon={<Wallet className="h-6 w-6" />}
        backHref="/dashboard"
        breadcrumbs={[
          { label: "Painel", href: "/dashboard" },
          { label: "Contas" },
        ]}
      >
        <LoadingState variant="page" />
      </DashboardLayout>
    )
  }

  return (
    <DashboardLayout
      title="Contas"
      description="Gerencie suas contas bancárias e carteiras"
      icon={<Wallet className="h-6 w-6" />}
      backHref="/dashboard"
      breadcrumbs={[
        { label: "Painel", href: "/dashboard" },
        { label: "Contas" },
      ]}
      actions={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Nova Conta
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {editingAccount ? 'Editar Conta' : 'Nova Conta'}
              </DialogTitle>
              <DialogDescription>
                {editingAccount 
                  ? 'Atualize as informações da conta'
                  : 'Crie uma nova conta bancária'
                }
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Conta</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Banco Inter" {...field} />
                      </FormControl>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">Um nome curto que você reconheça facilmente.</p>
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
                          {currencies.map((currency) => (
                            <SelectItem key={currency.code} value={currency.code}>
                              {currency.code} - {currency.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                      <p className="text-xs text-muted-foreground">Moeda base para lançamentos nesta conta.</p>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting || !form.formState.isValid}>
                    {isSubmitting ? (
                      <LoadingState variant="inline" size="sm" message="Salvando..." />
                    ) : (
                      editingAccount ? 'Atualizar' : 'Criar'
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      }
    >
        {accounts.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center space-y-4">
                <Wallet className="h-12 w-12 text-muted-foreground mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold">Nenhuma conta encontrada</h3>
                  <p className="text-muted-foreground">
                    Comece criando sua primeira conta bancária
                  </p>
                </div>
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Primeira Conta
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Stats */}
            <div className="stats-grid">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total de Contas</CardTitle>
                    <Wallet className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{accounts.length}</div>
                  </CardContent>
                </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Contas BRL</CardTitle>
                  <StatusBadge variant="success" size="sm">BRL</StatusBadge>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {accounts.filter(a => a.currency === 'BRL').length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Contas em reais
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Contas USD</CardTitle>
                  <StatusBadge variant="info" size="sm">USD</StatusBadge>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {accounts.filter(a => a.currency === 'USD').length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Contas em dólar
                  </p>
                </CardContent>
              </Card>
              </div>

              {/* Table */}
              <Card>
                <CardHeader>
                  <CardTitle>Suas Contas</CardTitle>
                  <CardDescription>
                    Gerencie todas as suas contas bancárias
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Moeda</TableHead>
                        <TableHead>Criada em</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {accounts.map((account) => (
                        <TableRow key={account.id}>
                          <TableCell className="font-medium">{account.label}</TableCell>
                          <TableCell>
                            <StatusBadge 
                              variant={account.currency === 'BRL' ? 'success' : 'info'} 
                              size="sm"
                            >
                              {account.currency}
                            </StatusBadge>
                          </TableCell>
                          <TableCell>
                            {new Date(account.created_at).toLocaleDateString('pt-BR')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(account)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteAccount(account.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
          </div>
        )}
    </DashboardLayout>
  )
} 
