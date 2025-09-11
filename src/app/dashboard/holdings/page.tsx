"use client"

import { useMemo, useState } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { LoadingState } from "@/components/ui/loading-state"
import { AssetBadge } from "@/components/ui/asset-badge"
import { ArrowLeft, Layers, Plus, Minus, TrendingUp, Calendar } from "lucide-react"
import { useDashboardData } from "@/lib/hooks/useDashboardData"
import { formatBRL } from "@/lib/utils/formatters"
import { getAssetClassLabel, getAssetClassColor } from "@/lib/utils/assets"

export default function HoldingsPage() {
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0,10))
  const [filter, setFilter] = useState<'all'|'cash'|'assets'>('all')
  
  const { data: dashboardData, isLoading, error } = useDashboardData(date)
  const holdings = dashboardData?.holdings || []

  const filtered = useMemo(() => {
    if (filter === 'all') return holdings
    if (filter === 'cash') return holdings.filter((h: any) => h.class === 'currency' || h.class === 'cash')
    return holdings.filter((h: any) => !(h.class === 'currency' || h.class === 'cash'))
  }, [holdings, filter])

  const total = filtered.reduce((s: number, h: any) => s + (h.value || 0), 0)

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
                  </Button>
                </Link>
                <div className="flex items-center gap-2 text-foreground">
                  <Layers className="h-5 w-5 text-primary" />
                  <h1 className="text-xl font-semibold">Posições</h1>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Data</Badge>
                  <input
                    type="date"
                    className="h-9 rounded-md border px-2 text-sm bg-background"
                    value={date}
                    onChange={(e)=>setDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8">
          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <div className="text-center py-16 text-red-500">Erro: {error}</div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Button size="sm" variant={filter==='all'?'default':'outline'} onClick={()=>setFilter('all')}>Todos</Button>
                  <Button size="sm" variant={filter==='cash'?'default':'outline'} onClick={()=>setFilter('cash')}>Caixa</Button>
                  <Button size="sm" variant={filter==='assets'?'default':'outline'} onClick={()=>setFilter('assets')}>Ativos</Button>
                </div>
                <div className="text-sm text-muted-foreground">Total filtrado: <span className="font-medium text-foreground">{formatBRL(total)}</span></div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Resumo</CardTitle>
                  <CardDescription>Posições consolidadas por ativo</CardDescription>
                </CardHeader>
                <CardContent>
                  {filtered.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">Sem posições nesta data.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-muted-foreground">
                            <th className="py-2">Ativo</th>
                            <th className="py-2">Classe</th>
                            <th className="py-2 text-right">Unidades</th>
                            <th className="py-2 text-right">Valor</th>
                            <th className="py-2 text-right">Ações</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((holding: any) => (
                            <tr key={holding.asset_id} className="border-t">
                              <td className="py-2">
                                <AssetBadge symbol={holding.symbol} className={holding.class} />
                              </td>
                              <td className="py-2">
                                <Badge className={getAssetClassColor(holding.class)}>
                                  {getAssetClassLabel(holding.class)}
                                </Badge>
                              </td>
                              <td className="py-2 text-right">{holding.units?.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</td>
                              <td className="py-2 text-right font-medium">{formatBRL(holding.value || 0)}</td>
                              <td className="py-2">
                                <div className="flex items-center justify-end gap-2">
                                  {(holding.class === 'currency' || holding.class === 'cash') ? (
                                    <>
                                      <Button asChild size="sm" variant="secondary">
                                        <Link href={`/dashboard/events/new?kind=deposit&asset_id=${holding.symbol}`}>
                                          <Plus className="h-4 w-4 mr-1" /> Depósito
                                        </Link>
                                      </Button>
                                      <Button asChild size="sm" variant="outline">
                                        <Link href={`/dashboard/events/new?kind=withdraw&asset_id=${holding.symbol}`}>
                                          <Minus className="h-4 w-4 mr-1" /> Saque
                                        </Link>
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <Button asChild size="sm" variant="secondary">
                                        <Link href={`/dashboard/events/new?kind=buy&asset_id=${holding.symbol}`}>
                                          <TrendingUp className="h-4 w-4 mr-1" /> Comprar
                                        </Link>
                                      </Button>
                                      <Button asChild size="sm" variant="ghost">
                                        <Link href={`/dashboard/events/new?kind=valuation&asset_id=${holding.symbol}`}>
                                          <Calendar className="h-4 w-4 mr-1" /> Avaliar
                                        </Link>
                                      </Button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </main>
      </div>
    </ProtectedRoute>
  )
}