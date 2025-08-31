import * as React from "react"
import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import { Card } from "@/components/ui/card"
import { Stepper } from "@/components/ui/stepper"
import { OperationTypeStep } from "./operation-type-step"
import { AssetSelectionStep } from "./asset-selection-step"
import { DetailsFormStep } from "./details-form-step"
import { useAuth } from "@/lib/auth"
import { supabase, Account, Asset } from "@/lib/supabase"
import { toast } from "sonner"
import { LoadingState } from "@/components/ui/loading-state"

// Tipos de operação mais intuitivos
export type OperationType = 
  | 'add_existing' // Adicionar patrimônio existente (position_add)
  | 'money_in'     // Entrada de dinheiro (deposit)
  | 'money_out'    // Saída de dinheiro (withdraw)
  | 'purchase'     // Compra de novo ativo (buy)
  | 'update_value' // Atualizar valor (valuation)

// Mapeamento para os tipos do banco
const operationToEventKind: Record<OperationType, string> = {
  'add_existing': 'position_add',
  'money_in': 'deposit',
  'money_out': 'withdraw',
  'purchase': 'buy',
  'update_value': 'valuation'
}

const patrimonySchema = z.object({
  asset_id: z.string().min(1, "Selecione um ativo"),
  account_id: z.string().optional(),
  operation: z.enum(['add_existing', 'money_in', 'money_out', 'purchase', 'update_value']),
  amount: z.string().optional(),
  price: z.string().optional(),
  date: z.string().min(1, "Data é obrigatória"),
  notes: z.string().optional(),
})

type PatrimonyForm = z.infer<typeof patrimonySchema>

const steps = ['O que deseja fazer?', 'Selecionar Ativo', 'Informações']

interface PatrimonyWizardProps {
  preselectedAssetId?: string
  preselectedOperation?: OperationType
  preselectedAccountId?: string
}

export function PatrimonyWizard({ 
  preselectedAssetId, 
  preselectedOperation, 
  preselectedAccountId 
}: PatrimonyWizardProps) {
  const { user } = useAuth()
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [selectedOperation, setSelectedOperation] = useState<OperationType | null>(preselectedOperation || null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [assets, setAssets] = useState<Asset[]>([])
  const [loading, setLoading] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [customAssets, setCustomAssets] = useState<Asset[]>([])

  const form = useForm<PatrimonyForm>({
    resolver: zodResolver(patrimonySchema),
    defaultValues: {
      asset_id: preselectedAssetId || "",
      account_id: preselectedAccountId || "",
      operation: preselectedOperation || "add_existing",
      amount: "",
      price: "",
      date: new Date().toISOString().slice(0, 16),
      notes: "",
    },
  })

  const selectedAssetId = form.watch('asset_id')
  const selectedAsset = [...assets, ...customAssets].find(a => a.id === selectedAssetId)
  const isCashAsset = selectedAsset?.class === 'currency' || selectedAsset?.class === 'cash'

  // Carregar dados iniciais
  const loadData = useCallback(async () => {
    if (!user) return

    try {
      const [accountsData, globalAssetsData, customAssetsData] = await Promise.all([
        supabase
          .from('accounts')
          .select('*')
          .eq('user_id', user.id)
          .order('label', { ascending: true }),
        supabase
          .from('global_assets')
          .select('*')
          .order('symbol', { ascending: true }),
        supabase
          .from('custom_assets')
          .select('*')
          .eq('user_id', user.id)
          .order('label', { ascending: true })
      ])

      if (accountsData.error) throw accountsData.error
      if (globalAssetsData.error) throw globalAssetsData.error

      setAccounts(accountsData.data || [])
      setAssets(globalAssetsData.data || [])
      setCustomAssets(customAssetsData.data || [])
      
      // Auto-selecionar primeira conta se necessário
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

  // Auto-avançar se operação pré-selecionada (só na primeira vez)
  useEffect(() => {
    if (preselectedOperation && currentStep === 0 && !selectedOperation) {
      setSelectedOperation(preselectedOperation)
      setCurrentStep(1)
    }
  }, [preselectedOperation]) // Removido currentStep das dependências

  const handleOperationSelect = (operation: OperationType) => {
    setSelectedOperation(operation)
    form.setValue('operation', operation)
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
    if (!user || !selectedOperation) return

    const formData = form.getValues()
    setIsSubmitting(true)

    try {
      // Converter operação para tipo do banco
      const eventKind = operationToEventKind[selectedOperation]

      // Validações específicas
      if (isCashAsset && ['buy', 'valuation'].includes(eventKind)) {
        throw new Error('Para dinheiro, use entrada ou saída.')
      }

      // Preparar dados do evento
      const eventData: any = {
        user_id: user.id,
        asset_id: formData.asset_id,
        account_id: formData.account_id === "" ? null : formData.account_id,
        kind: eventKind,
        tstamp: formData.date,
        meta: formData.notes ? { note: formData.notes } : {}
      }

      // Adicionar campos específicos por tipo
      switch (eventKind) {
        case 'deposit':
        case 'withdraw':
          eventData.units_delta = parseFloat(formData.amount || '0')
          break
        case 'buy':
        case 'position_add':
          eventData.units_delta = parseFloat(formData.amount || '0')
          eventData.price_close = parseFloat(formData.price || '0')
          break
        case 'valuation':
          eventData.price_override = parseFloat(formData.price || '0')
          break
      }

      // Criar evento
      const { error } = await supabase
        .from('events')
        .insert([eventData])

      if (error) throw error

      toast.success('Patrimônio atualizado com sucesso!')
      router.push('/dashboard')
    } catch (error: any) {
      console.error('Erro ao criar evento:', error)
      toast.error(error.message || 'Erro ao salvar')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return <LoadingState />
  }

  return (
    <Card className="max-w-4xl w-full">
      <div className="p-6">
        <Stepper 
          steps={steps} 
          currentStep={currentStep}
          className="mb-8"
        />

        <div className="mt-8">
          {currentStep === 0 && (
            <OperationTypeStep
              selectedOperation={selectedOperation}
              onOperationSelect={handleOperationSelect}
              hasAssets={assets.length > 0 || customAssets.length > 0}
            />
          )}

          {currentStep === 1 && selectedOperation && (
            <AssetSelectionStep
              form={form}
              assets={assets}
              customAssets={customAssets}
              accounts={accounts}
              selectedOperation={selectedOperation}
              onNext={handleNext}
              onBack={handleBack}
              onReload={loadData}
            />
          )}

          {currentStep === 2 && selectedOperation && (
            <DetailsFormStep
              form={form}
              selectedOperation={selectedOperation}
              selectedAsset={selectedAsset}
              onSubmit={handleSubmit}
              onBack={handleBack}
              isSubmitting={isSubmitting}
            />
          )}
        </div>
      </div>
    </Card>
  )
}