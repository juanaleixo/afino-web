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
import { useBackgroundPriceFill } from "@/lib/hooks/use-background-price-fill"

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
  // State to store the selected asset info for currency detection
  const [selectedAssetInfo, setSelectedAssetInfo] = React.useState<{class: string} | null>(null)
  
  // Hook for background price filling
  const { triggerPriceFillForAsset } = useBackgroundPriceFill()
  
  // Detect if selected asset is currency/cash
  React.useEffect(() => {
    const detectAssetType = async () => {
      if (!selectedAssetId) {
        setSelectedAssetInfo(null)
        return
      }
      
      try {
        // Check if selectedAssetId looks like a UUID (custom asset)
        const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedAssetId)
        
        if (isUUID) {
          // Check custom assets using UUID
          const { data: customAsset } = await supabase
            .from('custom_assets')
            .select('class')
            .eq('id', selectedAssetId)
            .single()
          
          if (customAsset) {
            setSelectedAssetInfo({ class: customAsset.class })
            return
          }
        } else {
          // Check global assets using symbol
          const { data: globalAsset } = await supabase
            .from('global_assets')
            .select('class')
            .eq('symbol', selectedAssetId)
            .single()
            
          if (globalAsset) {
            setSelectedAssetInfo({ class: globalAsset.class })
            return
          }
        }
        
        // Default to non-currency if not found
        setSelectedAssetInfo({ class: 'stock' })
      } catch (error) {
        console.error('Error detecting asset type:', error)
        setSelectedAssetInfo({ class: 'stock' })
      }
    }
    
    detectAssetType()
  }, [selectedAssetId])
  
  const isCashAsset = selectedAssetInfo?.class === 'currency' || selectedAssetInfo?.class === 'cash'

  // Carregar dados iniciais
  const loadData = useCallback(async () => {
    if (!user) return

    try {
      const [accountsData, customAssetsData] = await Promise.all([
        supabase
          .from('accounts')
          .select('*')
          .eq('user_id', user.id)
          .order('label', { ascending: true }),
        supabase
          .from('custom_assets')
          .select('*')
          .eq('user_id', user.id)
          .order('label', { ascending: true })
      ])

      if (accountsData.error) throw accountsData.error
      if (customAssetsData.error) throw customAssetsData.error

      setAccounts(accountsData.data || [])
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
      // Determinar identificador do ativo conforme origem
      const selectedCustom = customAssets.find(a => a.id === formData.asset_id)
      const isCustom = !!selectedCustom

      if (isCustom && !selectedCustom?.symbol) {
        throw new Error('Ativo personalizado precisa ter um símbolo definido para registrar eventos.')
      }

      const eventData: any = {
        user_id: user.id,
        asset_symbol: isCustom ? selectedCustom.id : formData.asset_id,
        account_id: formData.account_id === "" ? null : formData.account_id,
        kind: eventKind,
        tstamp: formData.date,
        meta: formData.notes ? { note: formData.notes } : {}
      }

      // Debug log para investigar o problema
      console.log('DEBUG: Dados do evento sendo criado:', {
        asset_id: formData.asset_id,
        selectedCustom: selectedCustom,
        isCustom: isCustom,
        asset_symbol: eventData.asset_symbol,
        eventData
      })

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
      console.log('DEBUG: Enviando dados para Supabase:', eventData)
      const { data, error } = await supabase
        .from('events')
        .insert([eventData])
        .select()

      console.log('DEBUG: Resposta do Supabase:', { data, error })
      if (error) throw error

      // Trigger background price filling for global assets
      if (formData.asset_id) {
        triggerPriceFillForAsset(formData.asset_id)
      }

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
              hasAssets={customAssets.length > 0}
              isCurrencyAsset={isCashAsset}
            />
          )}

          {currentStep === 1 && selectedOperation && (
            <AssetSelectionStep
              form={form}
              assets={[]} // Não carregar mais todos os assets globais
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
              selectedAsset={undefined}
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
