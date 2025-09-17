"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { PatrimonyWizard } from "@/components/dashboard/patrimony-wizard"
import { Calendar } from "lucide-react"

function NewEventInner() {
  const searchParams = useSearchParams()
  
  const preselectedAssetId = searchParams.get('asset_id') ?? undefined
  const preselectedAccountId = searchParams.get('account_id') ?? undefined
  
  // Mapear 'kind' da URL para operation
  const kindParam = searchParams.get('kind')
  const operationParam = searchParams.get('operation')
  
  let preselectedOperation = operationParam as any
  
  // Se não tem operation mas tem kind, mapear
  if (!preselectedOperation && kindParam) {
    switch (kindParam) {
      case 'deposit':
        preselectedOperation = 'money_in'
        break
      case 'withdraw':
        preselectedOperation = 'money_out'
        break
      case 'buy':
        preselectedOperation = 'purchase'
        break
      case 'position_add':
        preselectedOperation = 'add_existing'
        break
      case 'valuation':
        preselectedOperation = 'update_value'
        break
    }
  }

  return (
    <DashboardLayout
      title="Novo Evento"
      description="Registre uma nova transação ou evento financeiro"
      icon={<Calendar className="h-6 w-6" />}
      backHref="/dashboard/events"
      breadcrumbs={[
        { label: "Painel", href: "/dashboard" },
        { label: "Eventos", href: "/dashboard/events" },
        { label: "Novo" },
      ]}
    >
      <div className="flex justify-center">
        <PatrimonyWizard
          {...(preselectedAssetId && { preselectedAssetId })}
          {...(preselectedOperation && { preselectedOperation })}
          {...(preselectedAccountId && { preselectedAccountId })}
        />
      </div>
    </DashboardLayout>
  )
}

export default function NewEventPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><span>Carregando...</span></div>}>
      <NewEventInner />
    </Suspense>
  )
}
