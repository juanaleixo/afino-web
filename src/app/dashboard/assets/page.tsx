"use client";

import { useState, useEffect, useCallback } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/auth";
import { supabase, Asset } from "@/lib/supabase";

import { getAssetLinkValue } from "@/lib/utils/asset-helpers"
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  TrendingUp,
  Loader2,
  ArrowLeft,
  TrendingDown,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { getAssetDisplayLabel, getAssetClassLabel, getAssetClassColor } from "@/lib/utils/assets";

interface AssetsTableProps {
  assets: Asset[];
  latestPrices: Record<string, { date: string; price: number }>;
  formatBRL: (n: number) => string;
  formatDate: (d: string) => string;
  currencyLabel: (c: string) => string;
  isGlobalAssets?: boolean;
}

function AssetsTable({
  assets,
  latestPrices,
  formatBRL,
  formatDate,
  currencyLabel,
  isGlobalAssets = false,
}: AssetsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Ativo</TableHead>
          <TableHead>Classe</TableHead>
          <TableHead>Moeda</TableHead>
          <TableHead>Preço</TableHead>
          <TableHead>Atualizado</TableHead>
          {!isGlobalAssets && <TableHead>Ações</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {assets.map((asset) => (
          <TableRow key={asset.symbol || asset.id}>
            <TableCell className="font-medium">
              <div className="flex flex-col">
                <span>{getAssetDisplayLabel(asset)}</span>
                {getAssetDisplayLabel(asset)?.toUpperCase?.() !== asset.symbol?.toUpperCase?.() && (
                  <span className="text-xs text-muted-foreground">{asset.symbol}</span>
                )}
              </div>
            </TableCell>
            <TableCell>
              <Badge className={getAssetClassColor(asset.class)}>
                {getAssetClassLabel(asset.class)}
              </Badge>
            </TableCell>
            <TableCell>{currencyLabel(asset.currency)}</TableCell>
            <TableCell>
              {asset.class === "currency" || asset.class === 'cash' ? (
                <span>{formatBRL(1)}</span>
              ) : typeof asset.manual_price === "number" ? (
                <span>
                  {formatBRL(asset.manual_price)}
                  <Badge variant="secondary" className="ml-2">
                    Manual
                  </Badge>
                </span>
              ) : latestPrices[asset.symbol] ? (
                <span>
                  {formatBRL(latestPrices[asset.symbol]?.price || 0)}
                </span>
              ) : (
                <span className="text-muted-foreground">--</span>
              )}
            </TableCell>
            <TableCell>
              {latestPrices[asset.symbol]?.date ? (
                <span className="text-xs text-muted-foreground">
                  {formatDate(latestPrices[asset.symbol]?.date || '')}
                </span>
              ) : (
                <span className="text-muted-foreground">--</span>
              )}
            </TableCell>
            {!isGlobalAssets && (
              <TableCell>
                <div className="flex flex-wrap gap-2">
                  {asset.class === "currency" || asset.class === 'cash' ? (
                    <>
                      <Button
                        asChild
                        variant="secondary"
                        size="sm"
                        title="Entrada de Caixa"
                      >
                        <Link
                          href={`/dashboard/events/new?kind=deposit&asset_id=${getAssetLinkValue(asset)}`}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Entrada
                        </Link>
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        size="sm"
                        title="Saída de Caixa"
                      >
                        <Link
                          href={`/dashboard/events/new?kind=withdraw&asset_id=${getAssetLinkValue(asset)}`}
                        >
                          <TrendingDown className="h-4 w-4 mr-1" /> Saída
                        </Link>
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        asChild
                        variant="secondary"
                        size="sm"
                        title="Comprar"
                      >
                        <Link
                          href={`/dashboard/events/new?kind=buy&asset_id=${getAssetLinkValue(asset)}`}
                        >
                          <TrendingUp className="h-4 w-4 mr-1" /> Comprar
                        </Link>
                      </Button>
                      <Button
                        asChild
                        variant="ghost"
                        size="sm"
                        title="Avaliar"
                      >
                        <Link
                          href={`/dashboard/events/new?kind=valuation&asset_id=${getAssetLinkValue(asset)}`}
                        >
                          <Calendar className="h-4 w-4 mr-1" /> Avaliar
                        </Link>
                      </Button>
                    </>
                  )}
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export default function AssetsPage() {
  const { user } = useAuth();
  const [assets, setAssets] = useState<Asset[]>([]);
  const [latestPrices, setLatestPrices] = useState<
    Record<string, { date: string; price: number }>
  >({});
  const [loading, setLoading] = useState(true);

  const loadAssets = useCallback(async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from("global_assets")
        .select(
          "symbol, class, currency, meta, created_at, manual_price, label_ptbr"
        )
        .order("label_ptbr", { ascending: true, nullsFirst: false })
        .order("symbol", { ascending: true });

      if (error) throw error;
      const list = data || [];
      setAssets(list);

      // Carregar último preço por ativo (quando aplicável)
      const symbols = list.map((a) => a.symbol);
      if (symbols.length > 0) {
        const { data: prices, error: priceErr } = await supabase
          .from("global_price_daily")
          .select("asset_symbol, date, price")
          .in("asset_symbol", symbols)
          .order("date", { ascending: false });
        if (!priceErr && prices) {
          const map: Record<string, { date: string; price: number }> = {};
          for (const row of prices as any[]) {
            const symbol = row.asset_symbol as string;
            if (!map[symbol]) {
              map[symbol] = { date: row.date, price: Number(row.price) || 0 };
            }
          }
          setLatestPrices(map);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar ativos:", error);
      toast.error("Erro ao carregar ativos");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  // Filtrar apenas ativos customizados
  const customAssets = assets.filter(asset => 
    asset.meta && typeof asset.meta === 'object' && 'is_custom' in asset.meta && asset.meta.is_custom
  );


  const formatBRL = (n: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(n);
  const formatDate = (d: string) => new Date(d).toLocaleDateString("pt-BR");
  const currencyLabel = (c: string) => {
    return c === "BRL" ? "Real Brasileiro (BRL)" : c;
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <div className="min-h-screen flex items-center justify-center">
          <div className="flex items-center space-x-2">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span>Carregando ativos...</span>
          </div>
        </div>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link href="/dashboard">
                  <Button variant="ghost" size="sm">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Voltar
                  </Button>
                </Link>
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-6 w-6 text-primary" />
                  <h1 className="text-2xl font-bold">Ativos</h1>
                </div>
              </div>

              <Button asChild>
                <Link href="/dashboard/assets/new">
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Ativo
                </Link>
              </Button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 py-8">
          <Card>
            <CardHeader>
              <CardTitle>Meus Ativos</CardTitle>
              <CardDescription>
                Ativos criados por você para seu portfólio pessoal
              </CardDescription>
            </CardHeader>
            <CardContent>
              {customAssets.length === 0 ? (
                <div className="text-center py-8">
                  <Plus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">
                    Nenhum ativo personalizado criado
                  </h3>
                  <p className="text-muted-foreground mb-4">
                    Crie seus primeiros ativos personalizados para começar a acompanhar seu portfólio.
                  </p>
                  <Button asChild>
                    <Link href="/dashboard/assets/new">
                      <Plus className="h-4 w-4 mr-2" />
                      Criar Primeiro Ativo
                    </Link>
                  </Button>
                </div>
              ) : (
                <AssetsTable 
                  assets={customAssets} 
                  latestPrices={latestPrices}
                  formatBRL={formatBRL}
                  formatDate={formatDate}
                  currencyLabel={currencyLabel}
                />
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </ProtectedRoute>
  );
}
