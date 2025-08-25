/**
 * Utilities para padronizar a exibição e tratamento de ativos
 */

import { Asset } from "@/lib/supabase"

/**
 * Obter label de exibição padronizado para um ativo
 */
export function getAssetDisplayLabel(asset: Asset): string {
  // Se tem label customizado em PT-BR, usar ele
  if (asset.label_ptbr && asset.label_ptbr.trim().length > 0) {
    return asset.label_ptbr
  }
  
  // Para cash/currency, sempre exibir como "Caixa"
  if (asset.class === 'currency' || asset.class === 'cash') {
    return 'Caixa'
  }
  
  // Para cripto, usar nomes conhecidos
  if (asset.class === 'crypto') {
    const sym = asset.symbol?.toUpperCase?.() || ''
    if (sym === 'BTC') return 'Bitcoin'
    if (sym === 'ETH') return 'Ethereum'
    if (sym === 'ADA') return 'Cardano'
    if (sym === 'DOT') return 'Polkadot'
  }
  
  // Para outros ativos, usar o símbolo
  return asset.symbol || 'Ativo'
}

/**
 * Obter label da classe do ativo em português
 */
export function getAssetClassLabel(assetClass: string): string {
  switch (assetClass) {
    case "stock":
      return "Ação"
    case "bond":
      return "Título"
    case "fund":
      return "Fundo"
    case "crypto":
      return "Cripto"
    case "currency":
    case "cash":
      return "Caixa"
    case "commodity":
      return "Commodities"
    case "real_estate":
      return "Imóvel"
    case "reit":
      return "REIT"
    case "vehicle":
      return "Veículo"
    default:
      return assetClass
  }
}

/**
 * Obter cor CSS para a classe do ativo
 */
export function getAssetClassColor(assetClass: string): string {
  switch (assetClass) {
    case "stock":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
    case "bond":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300"
    case "fund":
      return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300"
    case "crypto":
      return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300"
    case "currency":
    case "cash":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
    case "commodity":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300"
    case "real_estate":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300"
    case "reit":
      return "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-300"
    case "vehicle":
      return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300"
    default:
      return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300"
  }
}

/**
 * Verificar se um ativo é cash/currency
 */
export function isCashAsset(asset: Asset): boolean {
  return asset.class === 'cash' || asset.class === 'currency'
}

/**
 * Verificar se um ativo deve ser excluído de visualizações de performance
 * (cash sempre tem valor fixo, não faz sentido em análises de performance)
 */
export function shouldExcludeFromPerformanceAnalysis(asset: Asset): boolean {
  return isCashAsset(asset)
}

/**
 * Filtrar ativos removendo cash quando apropriado
 */
export function filterAssetsExcludingCash(assets: Asset[]): Asset[] {
  return assets.filter(asset => !isCashAsset(asset))
}