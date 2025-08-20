"use client"

import { useEffect, useMemo, useState } from "react"
import ProtectedRoute from "@/components/ProtectedRoute"
import { useAuth } from "@/lib/auth"
import { supabase, Asset } from "@/lib/supabase"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, ArrowLeft, Layers, Plus, Minus, Shuffle, TrendingUp, TrendingDown, Calendar } from "lucide-react"

type HoldingRow = {
  asset_id: string
  symbol: string
  class: string
  units: number
  value: number
}

export default function HoldingsPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<HoldingRow[]>([])
  const [assetsMap, setAssetsMap] = useState<Map<string, Asset>>(new Map())
  const [date, setDate] = useState<string>(() => new Date().toISOString().slice(0,10))
  const [filter, setFilter] = useState<'all'|'cash'|'assets'>('all')

  const formatBRL = (n: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)

  useEffect(() => {
    const load = async () => {
      if (!user) return
      setLoading(true)
      try {
        const [{ data: hold, error: e1 }, { data: assets, error: e2 }] = await Promise.all([
          supabase.rpc('api_holdings_at', { p_date: date }),
          supabase.from('global_assets').select('id,symbol,class')
        ])
        if (e1) console.warn('api_holdings_at error', e1)
        if (e2) console.warn('global_assets error', e2)
        const m = new Map<string, Asset>((assets || []).map((a: any)=>[a.id, a]))
        setAssetsMap(m)
        const list: HoldingRow[] = (hold || []).map((h:any) => ({
          asset_id: h.asset_id,
          symbol: m.get(h.asset_id)?.symbol || '—',
          class: m.get(h.asset_id)?.class || '—',
          units: h.units || 0,
          value: h.value || 0
        }))
        list.sort((a,b)=> (b.value - a.value))
        setRows(list)
      } catch (err) {
        console.error('holdings error', err)
        setRows([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user?.id, date])

  const filtered = useMemo(() => {
    if (filter === 'all') return rows
    if (filter === 'cash') return rows.filter(r => r.class === 'currency' || r.class === 'cash')
    return rows.filter(r => !(r.class === 'currency' || r.class === 'cash'))
  }, [rows, filter])

  const total = filtered.reduce((s,r)=> s + (r.value||0), 0)

  const getAssetClassLabel = (assetClass: string) => {
    switch (assetClass) {
      case 'stock': return 'Ação'
      case 'bond': return 'Título'
      case 'fund': return 'Fundo'
      case 'crypto': return 'Cripto'
      case 'currency': return 'Caixa'
      case 'commodity': return 'Commodities'
      case 'real_estate': return 'Imóvel'
      default: return assetClass
    }
  }

  const getAssetClassColor = (assetClass: string) => {
    switch (assetClass) {
      case 'stock': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
      case 'bond': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
      case 'fund': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300'
      case 'crypto': return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300'
      case 'currency': return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
      case 'commodity': return 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300'
      case 'real_estate': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300'
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    }
  }

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
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
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
                          {filtered.map((r) => (
                            <tr key={r.asset_id} className="border-t">
                              <td className="py-2">
                                <div className="flex items-center gap-2">
                                  <span>{r.symbol}</span>
                                  {(r.class === 'currency' || r.class === 'cash') && (
                                    <Badge variant="secondary">Caixa</Badge>
                                  )}
                                </div>
                              </td>
                              <td className="py-2">
                                <Badge className={getAssetClassColor(r.class)}>
                                  {getAssetClassLabel(r.class)}
                                </Badge>
                              </td>
                              <td className="py-2 text-right">{r.units.toLocaleString('pt-BR')}</td>
                              <td className="py-2 text-right font-medium">{formatBRL(r.value)}</td>
                              <td className="py-2">
                                <div className="flex items-center justify-end gap-2">
                                  {(r.class === 'currency' || r.class === 'cash') ? (
                                    <>
                                      <Button asChild size="sm" variant="secondary">
                                        <Link href={`/dashboard/events/new?kind=deposit&asset_id=${r.asset_id}`}>
                                          <Plus className="h-4 w-4 mr-1" /> Depósito
                                        </Link>
                                      </Button>
                                      <Button asChild size="sm" variant="outline">
                                        <Link href={`/dashboard/events/new?kind=withdraw&asset_id=${r.asset_id}`}>
                                          <Minus className="h-4 w-4 mr-1" /> Saque
                                        </Link>
                                      </Button>
                                      {/* Transferência de caixa assistida removida */}
                                    </>
                                  ) : (
                                    <>
                                      <Button asChild size="sm" variant="secondary">
                                        <Link href={`/dashboard/events/new?kind=buy&asset_id=${r.asset_id}`}>
                                          <TrendingUp className="h-4 w-4 mr-1" /> Comprar
                                        </Link>
                                      </Button>
                                      <Button asChild size="sm" variant="ghost">
                                        <Link href={`/dashboard/events/new?kind=valuation&asset_id=${r.asset_id}`}>
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
