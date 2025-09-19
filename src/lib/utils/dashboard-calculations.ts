/**
 * Frontend calculations for dashboard data
 * Moved from database for better performance
 */

export interface RawHolding {
  asset_id: string
  date: string
  units: number
  value: number
}

export interface RawTimelinePoint {
  date?: string
  month?: string
  value: number
}

export interface ProcessedHolding {
  asset_id: string
  symbol: string
  class: string
  label_ptbr: string
  units: number
  value: number
  percentage: number
}

export interface PortfolioStats {
  total_value: number
  total_assets: number
  largest_holding: {
    symbol: string
    percentage: number
  } | null
  diversification: {
    score: number
    label: string
  } | null
  performance_6m: {
    percentage: number
    is_positive: boolean
  } | null
}

/**
 * Process raw holdings data into organized current positions
 */
export function processHoldings(
  rawHoldings: RawHolding[],
  globalAssets?: Record<string, { symbol: string; class: string; label_ptbr: string }>,
  customAssets?: Record<string, { symbol: string; class: string; label: string }>
): ProcessedHolding[] {
  if (!rawHoldings?.length) return []

  // Group by asset_id and get latest position
  const holdingsMap = new Map<string, RawHolding>()

  rawHoldings.forEach(holding => {
    const existing = holdingsMap.get(holding.asset_id)
    if (!existing || new Date(holding.date) > new Date(existing.date)) {
      holdingsMap.set(holding.asset_id, holding)
    }
  })

  // Calculate total value for percentages
  const totalValue = Array.from(holdingsMap.values())
    .reduce((sum, h) => sum + h.value, 0)

  // Process holdings with asset info
  return Array.from(holdingsMap.values())
    .filter(h => h.value > 0.01)
    .map(holding => {
      const globalAsset = globalAssets?.[holding.asset_id]
      const customAsset = customAssets?.[holding.asset_id]

      return {
        asset_id: holding.asset_id,
        symbol: globalAsset?.symbol || customAsset?.symbol || holding.asset_id,
        class: globalAsset?.class || customAsset?.class || 'unknown',
        label_ptbr: globalAsset?.label_ptbr || customAsset?.label || holding.asset_id,
        units: holding.units,
        value: holding.value,
        percentage: totalValue > 0 ? (holding.value / totalValue) * 100 : 0
      }
    })
    .sort((a, b) => b.value - a.value)
}

/**
 * Calculate portfolio statistics from processed holdings
 */
export function calculatePortfolioStats(
  holdings: ProcessedHolding[],
  timelineData?: RawTimelinePoint[]
): PortfolioStats {
  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0)
  const totalAssets = holdings.length

  // Largest holding
  const largestHolding = holdings.length > 0 ? {
    symbol: holdings[0]!.symbol,
    percentage: holdings[0]!.percentage
  } : null

  // Diversification score (Herfindahl-Hirschman Index)
  let diversificationScore = 0
  let diversificationLabel = 'Baixa'

  if (holdings.length > 0) {
    const hhi = holdings.reduce((sum, h) => {
      const weight = h.value / totalValue
      return sum + (weight * weight)
    }, 0)

    diversificationScore = Math.max(0, (1 - hhi) * 100)

    if (diversificationScore > 70) diversificationLabel = 'Alta'
    else if (diversificationScore > 50) diversificationLabel = 'Média'
    else if (diversificationScore > 30) diversificationLabel = 'Razoável'
  }

  // Performance calculation (6 months)
  let performance6m = null
  if (timelineData && timelineData.length > 1) {
    const sortedData = [...timelineData].sort((a, b) => {
      const dateA = a.date || a.month!
      const dateB = b.date || b.month!
      return new Date(dateA).getTime() - new Date(dateB).getTime()
    })

    const firstValue = sortedData[0]?.value || 0
    const lastValue = sortedData[sortedData.length - 1]?.value || 0

    if (firstValue > 0) {
      const percentageChange = ((lastValue - firstValue) / firstValue) * 100
      performance6m = {
        percentage: percentageChange,
        is_positive: percentageChange >= 0
      }
    }
  }

  return {
    total_value: totalValue,
    total_assets: totalAssets,
    largest_holding: largestHolding,
    diversification: totalAssets > 0 ? {
      score: diversificationScore,
      label: diversificationLabel
    } : null,
    performance_6m: performance6m
  }
}

/**
 * Process timeline data for charts
 */
export function processTimelineData(
  monthlyData?: RawTimelinePoint[],
  dailyData?: RawTimelinePoint[]
) {
  const processPoints = (data: RawTimelinePoint[], dateKey: 'date' | 'month') => {
    if (!data?.length) return []

    return data
      .map(point => ({
        [dateKey === 'date' ? 'date' : 'month_eom']: point[dateKey]!,
        total_value: point.value
      }))
      .sort((a, b) => {
        const dateA = dateKey === 'date' ? a.date : a.month_eom
        const dateB = dateKey === 'date' ? b.date : b.month_eom
        return new Date(dateA).getTime() - new Date(dateB).getTime()
      })
  }

  return {
    monthly_series: processPoints(monthlyData || [], 'month'),
    daily_series: processPoints(dailyData || [], 'date')
  }
}

/**
 * Fast asset diversity calculation
 */
export function getAssetClassDistribution(holdings: ProcessedHolding[]) {
  if (!holdings?.length) {
    return { diversityLabel: 'Sem dados' }
  }

  const numAssets = holdings.length

  let diversityLabel = 'Concentrado'
  if (numAssets >= 5) diversityLabel = 'Diversificado'
  else if (numAssets >= 3) diversityLabel = 'Balanceado'

  return { diversityLabel }
}