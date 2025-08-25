"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { PatrimonyWizard } from "@/components/dashboard/patrimony-wizard"
import { Plus } from "lucide-react"

function NewPatrimonyInner() {
  const searchParams = useSearchParams()
  
  const preselectedAssetId = searchParams.get('asset_id') ?? undefined
  const preselectedOperation = searchParams.get('operation') as any ?? undefined
  const preselectedAccountId = searchParams.get('account_id') ?? undefined

  return (
    <DashboardLayout
      title="Adicionar ao Patrimônio"
      description="Registre novos ativos, atualize valores ou faça movimentações"
      icon={<Plus className="h-6 w-6" />}
      backHref="/dashboard"
      breadcrumbs={[
        { label: "Painel", href: "/dashboard" },
        { label: "Adicionar" },
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

export default function NewPatrimonyPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><span>Carregando...</span></div>}>
      <NewPatrimonyInner />
    </Suspense>
  )
}