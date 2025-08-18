"use client"

import { useState, useEffect, useCallback } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { useAuth } from "@/lib/auth"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Settings, User, Bell, Shield, Loader2, Save, ArrowLeft } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

const profileSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  email: z.string().email("Email inválido"),
  timezone: z.string().min(1, "Fuso horário é obrigatório"),
})

const notificationSchema = z.object({
  emailNotifications: z.boolean(),
  pushNotifications: z.boolean(),
  weeklyReports: z.boolean(),
  priceAlerts: z.boolean(),
  marketUpdates: z.boolean(),
})

type ProfileForm = z.infer<typeof profileSchema>
type NotificationForm = z.infer<typeof notificationSchema>

export default function SettingsPage() {
  const { user, signOut } = useAuth()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: "",
      email: "",
      timezone: "America/Sao_Paulo",
    },
  })

  const notificationForm = useForm<NotificationForm>({
    resolver: zodResolver(notificationSchema),
    defaultValues: {
      emailNotifications: true,
      pushNotifications: true,
      weeklyReports: true,
      priceAlerts: false,
      marketUpdates: true,
    },
  })

  const loadSettings = useCallback(async () => {
    if (!user) return

    try {
      // Carregar dados do perfil
      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError && profileError.code !== 'PGRST116') throw profileError

      if (profile) {
        profileForm.reset({
          name: profile.name || "",
          email: user.email || "",
          timezone: profile.timezone || "America/Sao_Paulo",
        })
      } else {
        profileForm.reset({
          name: "",
          email: user.email || "",
          timezone: "America/Sao_Paulo",
        })
      }

      // Carregar configurações de notificação (simulado)
      notificationForm.reset({
        emailNotifications: true,
        pushNotifications: true,
        weeklyReports: true,
        priceAlerts: false,
        marketUpdates: true,
      })

      setLoading(false)
    } catch (error) {
      console.error('Erro ao carregar configurações:', error)
      toast.error('Erro ao carregar configurações')
    } finally {
      setLoading(false)
    }
  }, [user, profileForm, notificationForm])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const onProfileSubmit = async (data: ProfileForm) => {
    if (!user) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('users')
        .upsert({
          id: user.id,
          name: data.name,
          timezone: data.timezone,
          updated_at: new Date().toISOString(),
        })

      if (error) throw error
      toast.success('Perfil atualizado com sucesso!')
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error)
      toast.error('Erro ao atualizar perfil')
    } finally {
      setSaving(false)
    }
  }

  const onNotificationSubmit = async () => {
    setSaving(true)
    try {
      // Simular salvamento das configurações de notificação
      await new Promise(resolve => setTimeout(resolve, 1000))
      toast.success('Configurações de notificação atualizadas!')
    } catch (error) {
      console.error('Erro ao atualizar notificações:', error)
      toast.error('Erro ao atualizar notificações')
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    try {
      await signOut()
      toast.success('Logout realizado com sucesso!')
    } catch (error) {
      console.error('Erro ao fazer logout:', error)
      toast.error('Erro ao fazer logout')
    }
  }

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span>Carregando configurações...</span>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Voltar
                </Button>
              </Link>
              <div className="flex items-center space-x-2">
                <Settings className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold">Configurações</h1>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">

        <div className="space-y-6">
          {/* Perfil */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <User className="h-5 w-5" />
                <span>Perfil</span>
              </CardTitle>
              <CardDescription>
                Atualize suas informações pessoais
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)} className="space-y-4">
                  <FormField
                    control={profileForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nome</FormLabel>
                        <FormControl>
                          <Input placeholder="Seu nome completo" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="seu@email.com" {...field} disabled />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={profileForm.control}
                    name="timezone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fuso Horário</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione o fuso horário" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="America/Sao_Paulo">Brasília (GMT-3)</SelectItem>
                            <SelectItem value="America/Manaus">Manaus (GMT-4)</SelectItem>
                            <SelectItem value="America/Belem">Belém (GMT-3)</SelectItem>
                            <SelectItem value="America/Fortaleza">Fortaleza (GMT-3)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Salvar Perfil
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Notificações */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>Notificações</span>
              </CardTitle>
              <CardDescription>
                Configure suas preferências de notificação
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...notificationForm}>
                <form onSubmit={notificationForm.handleSubmit(onNotificationSubmit)} className="space-y-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Notificações por Email</Label>
                        <p className="text-sm text-muted-foreground">
                          Receba atualizações importantes por email
                        </p>
                      </div>
                      <FormField
                        control={notificationForm.control}
                        name="emailNotifications"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Notificações Push</Label>
                        <p className="text-sm text-muted-foreground">
                          Receba notificações em tempo real
                        </p>
                      </div>
                      <FormField
                        control={notificationForm.control}
                        name="pushNotifications"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Relatórios Semanais</Label>
                        <p className="text-sm text-muted-foreground">
                          Receba um resumo semanal do seu portfólio
                        </p>
                      </div>
                      <FormField
                        control={notificationForm.control}
                        name="weeklyReports"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Alertas de Preço</Label>
                        <p className="text-sm text-muted-foreground">
                          Notificações quando ativos atingirem preços específicos
                        </p>
                      </div>
                      <FormField
                        control={notificationForm.control}
                        name="priceAlerts"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Atualizações de Mercado</Label>
                        <p className="text-sm text-muted-foreground">
                          Notícias e análises do mercado financeiro
                        </p>
                      </div>
                      <FormField
                        control={notificationForm.control}
                        name="marketUpdates"
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Switch
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Salvar Notificações
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>

          {/* Segurança */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="h-5 w-5" />
                <span>Segurança</span>
              </CardTitle>
              <CardDescription>
                Gerencie a segurança da sua conta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Autenticação de Dois Fatores</Label>
                  <p className="text-sm text-muted-foreground">
                    Adicione uma camada extra de segurança
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Configurar
                </Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Alterar Senha</Label>
                  <p className="text-sm text-muted-foreground">
                    Atualize sua senha regularmente
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Alterar
                </Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Sessões Ativas</Label>
                  <p className="text-sm text-muted-foreground">
                    Gerencie dispositivos conectados
                  </p>
                </div>
                <Button variant="outline" size="sm">
                  Ver Sessões
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Conta */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Conta</span>
              </CardTitle>
              <CardDescription>
                Ações relacionadas à sua conta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label className="text-red-600">Excluir Conta</Label>
                  <p className="text-sm text-muted-foreground">
                    Esta ação não pode ser desfeita
                  </p>
                </div>
                <Button variant="destructive" size="sm">
                  Excluir
                </Button>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Sair da Conta</Label>
                  <p className="text-sm text-muted-foreground">
                    Faça logout da sua conta
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleSignOut}>
                  Sair
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
        </main>
      </div>
    </ProtectedRoute>
  )
} 