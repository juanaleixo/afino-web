import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Stepper } from "@/components/ui/stepper"
import { EventTypeStep } from "./event-type-step"
import { AssetAccountStep } from "./asset-account-step"
import { DetailsStep } from "./details-step"
import { useAuth } from "@/lib/auth"
import { supabase, Account, Asset } from "@/lib/supabase"
import { toast } from "sonner"
import { LoadingState } from "@/components/ui/loading-state"

type EventKind = 'deposit' | 'withdraw' | 'buy' | 'position_add' | 'valuation'

const eventSchema = z.object({
  asset_id: z.string().min(1, "Ativo é obrigatório"),
  account_id: z.string().optional(),
  kind: z.enum(['deposit', 'withdraw', 'buy', 'position_add', 'valuation']),
  units_delta: z.string().optional(),
  price_override: z.string().optional(),
  price_close: z.string().optional(),
  tstamp: z.string().min(1, "Data é obrigatória"),
})

type EventForm = z.infer<typeof eventSchema>

const steps = ['Tipo', 'Ativo & Conta', 'Detalhes']

interface EventWizardProps {
  preselectedAssetId?: string
  preselectedKind?: EventKind
  preselectedAccountId?: string
}

export function EventWizard({ 
  preselectedAssetId, 
  preselectedKind, 
  preselectedAccountId 
}: EventWizardProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedType, setSelectedType] = useState<EventKind | null>(preselectedKind || null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<EventForm>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      asset_id: preselectedAssetId || "",
      account_id: preselectedAccountId || "none",
      kind: preselectedKind || "buy",
      units_delta: "",
      price_override: "",
      price_close: "",
      tstamp: new Date().toISOString().slice(0, 16),
    },
  })

  const selectedAssetId = form.watch('asset_id')
  const selectedAsset = assets.find(a => a.id === selectedAssetId)
  const isCurrencyAsset = selectedAsset?.class === 'currency'

  // Carregar dados iniciais
  const loadData = useCallback(async () => {
    if (!user) return

    try {
      const [accountsData, assetsData] = await Promise.all([
        supabase
          .from('accounts')
          .select('*')
          .eq('user_id', user.id)
          .order('label', { ascending: true }),
        supabase
          .from('global_assets')
          .select('*')
          .order('symbol', { ascending: true })
      ])

      if (accountsData.error) throw accountsData.error
      if (assetsData.error) throw assetsData.error

      setAccounts(accountsData.data || [])
      setAssets(assetsData.data || [])
      
      // Auto-select first account if needed
      if (accountsData.data && accountsData.data.length > 0 && !form.getValues('account_id')) {
        form.setValue('account_id', accountsData.data[0].id)
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error)
      toast.error('Erro ao carregar dados')
    } finally {
      setLoading(false)
    }
  }, [user, form])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Auto-advance to step 1 if type is preselected
  useEffect(() => {
    if (preselectedKind && currentStep === 0) {
      setSelectedType(preselectedKind)
      setCurrentStep(1)
    }
  }, [preselectedKind, currentStep])

  const handleTypeSelect = (type: EventKind) => {
    setSelectedType(type)
    form.setValue('kind', type)
    setCurrentStep(1)
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSubmit = async () => {
    if (!user || !selectedType) return

    const formData = form.getValues()
    setIsSubmitting(true)

    try {
      // Validação específica por tipo
      const selectedAsset = assets.find(a => a.id === formData.asset_id)
      const assetIsCash = selectedAsset?.class === 'currency'

      if (assetIsCash && ['buy', 'valuation'].includes(selectedType)) {
        throw new Error('Para cash, use depósito ou saque.')
      }

      // Preparar dados do evento principal
      const eventData: any = {
        user_id: user.id,
        asset_id: formData.asset_id,
        kind: selectedType,
        tstamp: new Date(formData.tstamp).toISOString(),
      }

      if (formData.account_id && formData.account_id !== "none") {
        eventData.account_id = formData.account_id
      }

      // Array para armazenar todos os eventos a serem criados
      const eventsToInsert = []

      // Função helper para fazer parse de valores com locale pt-BR
      const parseLocaleNumber = (value: string) => {
        if (!value || value.trim() === '') return NaN
        // Normalizar vírgula para ponto
        const normalized = value.replace(',', '.')
        return parseFloat(normalized)
      }

      // Adicionar campos específicos por tipo
      if (['deposit', 'withdraw'].includes(selectedType)) {
        const qty = parseLocaleNumber(formData.units_delta || '0')
        if (isNaN(qty) || qty <= 0) {
          throw new Error('Quantidade deve ser um número positivo. Use vírgula ou ponto como separador decimal.')
        }
        eventData.units_delta = selectedType === 'withdraw' ? -Math.abs(qty) : Math.abs(qty)
        eventsToInsert.push(eventData)
      } else if (selectedType === 'buy') {
        const qty = parseLocaleNumber(formData.units_delta || '0')
        const price = parseLocaleNumber(formData.price_close || '0')
        if (isNaN(qty) || qty <= 0) {
          throw new Error('Quantidade deve ser um número positivo. Use vírgula ou ponto como separador decimal.')
        }
        if (isNaN(price) || price <= 0) {
          throw new Error('Preço deve ser um número positivo. Use vírgula ou ponto como separador decimal.')
        }
        
        // Evento principal (ativo) - sempre positivo para compra
        eventData.units_delta = Math.abs(qty)
        eventData.price_close = price
        eventsToInsert.push(eventData)

        // Dupla entrada: perna de caixa (BRL) - saída de caixa
        // Buscar ativo BRL/Cash
        const cashAsset = assets.find(a => a.class === 'currency' || a.symbol?.toUpperCase() === 'BRL')
        if (cashAsset && formData.account_id && formData.account_id !== "none") {
          const cashValue = Math.abs(qty) * price
          const cashEventData = {
            user_id: user.id,
            asset_id: cashAsset.id,
            account_id: formData.account_id,
            kind: 'withdraw',
            units_delta: -cashValue,
            tstamp: new Date(formData.tstamp).toISOString(),
          }
          eventsToInsert.push(cashEventData)
        }
      } else if (selectedType === 'position_add') {
        const qty = parseLocaleNumber(formData.units_delta || '0')
        const price = parseLocaleNumber(formData.price_close || '0')
        if (isNaN(qty) || qty <= 0) {
          throw new Error('Quantidade deve ser um número positivo. Use vírgula ou ponto como separador decimal.')
        }
        if (isNaN(price) || price <= 0) {
          throw new Error('Preço deve ser um número positivo. Use vírgula ou ponto como separador decimal.')
        }
        
        // Evento principal - adicionar posição existente
        eventData.units_delta = Math.abs(qty)
        eventData.price_close = price
        eventsToInsert.push(eventData)
      } else if (selectedType === 'valuation') {
        const price = parseLocaleNumber(formData.price_override || '0')
        if (isNaN(price) || price <= 0) {
          throw new Error('Preço de avaliação deve ser um número positivo. Use vírgula ou ponto como separador decimal.')
        }
        eventData.price_override = price
        eventsToInsert.push(eventData)
      }

      // Inserir todos os eventos em uma transação
      const { error } = await supabase
        .from('events')
        .insert(eventsToInsert)

      if (error) throw error

      toast.success('Evento criado com sucesso!')
      router.push('/dashboard/events')
    } catch (error) {
      console.error('Erro ao criar evento:', error)
      toast.error(error instanceof Error ? error.message : 'Erro ao criar evento')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return <LoadingState variant="card" message="Carregando dados..." />
  }

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="text-center">Novo Evento</CardTitle>
        <div className="pt-4">
          <Stepper steps={steps} currentStep={currentStep} />
        </div>
      </CardHeader>
      <CardContent className="pt-6">
        {currentStep === 0 && (
          <EventTypeStep
            selectedType={selectedType}
            onTypeSelect={handleTypeSelect}
            isCurrencyAsset={isCurrencyAsset}
          />
        )}
        
        {currentStep === 1 && selectedType && (
          <AssetAccountStep
            eventKind={selectedType}
            form={form}
            accounts={accounts}
            assets={assets}
            onNext={handleNext}
            onBack={handleBack}
          />
        )}
        
        {currentStep === 2 && selectedType && (
          <DetailsStep
            eventKind={selectedType}
            form={form}
            accounts={accounts}
            assets={assets}
            onSubmit={handleSubmit}
            onBack={handleBack}
            isSubmitting={isSubmitting}
          />
        )}
      </CardContent>
    </Card>
  )
}