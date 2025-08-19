"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { DashboardLayout } from "@/components/dashboard/dashboard-layout"
import { EventWizard } from "@/components/dashboard/event-wizard"
import { Calendar } from "lucide-react"

function NewEventInner() {
  const searchParams = useSearchParams()
  
  const preselectedAssetId = searchParams.get('asset_id') || undefined
  const preselectedKind = searchParams.get('kind') as any || undefined
  const preselectedAccountId = searchParams.get('account_id') || undefined

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
        <EventWizard
          preselectedAssetId={preselectedAssetId}
          preselectedKind={preselectedKind}
          preselectedAccountId={preselectedAccountId}
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
