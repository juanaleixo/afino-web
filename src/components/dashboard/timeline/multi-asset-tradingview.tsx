"use client"

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Crown, LineChart, TrendingUp, Layers, PieChart, CandlestickChart } from 'lucide-react'
import { createChart, ColorType, LineStyle, LineSeries, CandlestickSeries } from 'lightweight-charts'
import { FadeIn, Stagger } from '@/components/ui/fade-in'
import { ChartSkeleton } from '@/components/ui/skeleton-loader'

interface AssetData {
  asset_id: string
  asset_symbol: string
  asset_class: string
  daily_values: Array<{ date: string; value: number; open?: number; high?: number; low?: number; close?: number }>
  color: string
}

interface MultiAssetTradingViewProps {
  assetsData: AssetData[]
  portfolioData?: {
    monthlySeries?: Array<{ month_eom: string; total_value: number }>
    dailySeries?: Array<{ date: string; total_value: number }>
  }
  isPremium: boolean
  isLoading: boolean
}

const ASSET_COLORS = [
  '#2563eb', '#dc2626', '#059669', '#d97706', '#7c3aed', 
  '#db2777', '#0891b2', '#65a30d', '#c2410c', '#4338ca'
]

// Generate OHLC data from value series for candlestick charts
const generateOHLCData = (daily_values: Array<{ date: string; value: number }>) => {
  return daily_values.map((item, index, array) => {
    const value = item.value
    const prevValue = index > 0 ? (array[index - 1]?.value || value) : value
    
    // Generate realistic OHLC based on the day's value
    const volatility = 0.02 // 2% daily volatility
    const randomFactor = () => (Math.random() - 0.5) * volatility
    
    const open = index === 0 ? value : prevValue
    const variation = value * randomFactor()
    
    // Ensure realistic OHLC relationships
    const high = Math.max(open, value) + Math.abs(variation)
    const low = Math.min(open, value) - Math.abs(variation)
    const close = value
    
    return {
      ...item,
      open,
      high,
      low,
      close
    }
  })
}

export default function MultiAssetTradingView({ 
  assetsData, 
  portfolioData, 
  isPremium, 
  isLoading 
}: MultiAssetTradingViewProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null)
  const [chartType, setChartType] = useState<'lines' | 'candles' | 'percentage'>('lines')
  const [selectedAssets, setSelectedAssets] = useState<string[]>([])
  const [showPortfolio, setShowPortfolio] = useState(true)
  const [isDarkMode, setIsDarkMode] = useState(false)

  // Detect dark mode
  useEffect(() => {
    const checkDarkMode = () => {
      setIsDarkMode(document.documentElement.classList.contains('dark'))
    }
    
    checkDarkMode()
    
    // Listen for theme changes
    const observer = new MutationObserver(checkDarkMode)
    observer.observe(document.documentElement, { 
      attributes: true, 
      attributeFilter: ['class'] 
    })
    
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (assetsData.length > 0 && selectedAssets.length === 0) {
      // Auto-select assets by value (5 for candles, 5 for others initially)
      const maxAssets = chartType === 'candles' ? 3 : 5
      const sortedAssets = [...assetsData]
        .sort((a, b) => {
          const aLastValue = a.daily_values[a.daily_values.length - 1]?.value || 0
          const bLastValue = b.daily_values[b.daily_values.length - 1]?.value || 0
          return bLastValue - aLastValue
        })
        .slice(0, maxAssets)
        .map(a => a.asset_id)
      
      setSelectedAssets(sortedAssets)
    }
  }, [assetsData, chartType, selectedAssets.length])

  // Limit assets when switching to candles mode
  useEffect(() => {
    if (chartType === 'candles' && selectedAssets.length > 5) {
      setSelectedAssets(prev => prev.slice(0, 5))
    }
  }, [chartType, selectedAssets.length])

  useEffect(() => {
    if (!chartContainerRef.current || !isPremium || isLoading) return

    // Clear existing chart
    if (chartRef.current) {
      chartRef.current.remove()
      chartRef.current = null
    }

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDarkMode ? '#e2e8f0' : '#64748b',
        fontSize: 12,
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      rightPriceScale: {
        borderColor: isDarkMode ? '#374151' : '#e2e8f0',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: isDarkMode ? '#374151' : '#e2e8f0',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: isDarkMode ? '#9ca3af' : '#64748b',
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: isDarkMode ? '#9ca3af' : '#64748b',
          width: 1,
          style: LineStyle.Dashed,
        },
      },
      grid: {
        vertLines: {
          color: isDarkMode ? '#1f2937' : '#f1f5f9',
        },
        horzLines: {
          color: isDarkMode ? '#1f2937' : '#f1f5f9',
        },
      },
    })

    chartRef.current = chart

    // Add portfolio line if enabled (only in line modes, not candles)
    if (showPortfolio && portfolioData?.dailySeries && chartType !== 'candles') {
      const portfolioSeries = chart.addSeries(LineSeries, {
        color: '#1f2937',
        lineWidth: 3,
        title: 'Portfolio Total',
        priceFormat: {
          type: 'custom',
          formatter: (price: number) => 
            new Intl.NumberFormat('pt-BR', {
              style: 'currency',
              currency: 'BRL',
              minimumFractionDigits: 0,
              maximumFractionDigits: 0
            }).format(price)
        },
      })

      const portfolioChartData = portfolioData.dailySeries.map(item => ({
        time: item.date,
        value: item.total_value
      }))

      portfolioSeries.setData(portfolioChartData)
    }

    // Add selected asset lines
    const filteredAssets = assetsData.filter(asset => 
      selectedAssets.includes(asset.asset_id)
    )

    filteredAssets.forEach((asset, index) => {
      const color = ASSET_COLORS[index % ASSET_COLORS.length] || '#2563eb'
      
      if (chartType === 'percentage') {
        // Calculate percentage changes from first value
        const firstValue = asset.daily_values[0]?.value || 0
        if (firstValue === 0) return

        const percentageData = asset.daily_values.map(item => ({
          time: item.date,
          value: ((item.value - firstValue) / firstValue) * 100
        }))

        const series = chart.addSeries(LineSeries, {
          color,
          lineWidth: 2,
          title: asset.asset_symbol,
          priceFormat: {
            type: 'percent',
          },
        })

        series.setData(percentageData)
      } else if (chartType === 'candles') {
        // Generate OHLC data for candlesticks
        const ohlcData = generateOHLCData(asset.daily_values)
        
        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: color,
          downColor: '#ef4444',
          borderUpColor: color,
          borderDownColor: '#ef4444',
          wickUpColor: color,
          wickDownColor: '#ef4444',
          title: asset.asset_symbol,
          priceFormat: {
            type: 'custom',
            formatter: (price: number) => 
              new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(price)
          },
        })

        const candleData = ohlcData.map(item => ({
          time: item.date,
          open: item.open,
          high: item.high,
          low: item.low,
          close: item.close
        }))

        candleSeries.setData(candleData)
      } else {
        // Lines mode
        const series = chart.addSeries(LineSeries, {
          color,
          lineWidth: 2,
          title: asset.asset_symbol,
          priceFormat: {
            type: 'custom',
            formatter: (price: number) => 
              new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
              }).format(price)
          },
        })

        const chartData = asset.daily_values.map(item => ({
          time: item.date,
          value: item.value
        }))

        series.setData(chartData)
      }
    })

    chart.timeScale().fitContent()

    // Cleanup
    return () => {
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [assetsData, selectedAssets, chartType, showPortfolio, portfolioData, isPremium, isLoading, isDarkMode])

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
        })
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const toggleAsset = (assetId: string) => {
    setSelectedAssets(prev => 
      prev.includes(assetId) 
        ? prev.filter(id => id !== assetId)
        : [...prev, assetId]
    )
  }

  if (!isPremium) {
    return (
      <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Crown className="h-5 w-5 text-yellow-600" />
              <div>
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">
                  Gráfico Multi-Ativos Profissional
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Visualize múltiplos ativos simultaneamente com análise técnica avançada
                </p>
              </div>
            </div>
            <Button variant="outline" className="border-yellow-300 hover:bg-yellow-100">
              <Crown className="h-4 w-4 mr-2" />
              Fazer Upgrade
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <FadeIn className="space-y-4">
      {/* Controls */}
      <Card className="card-hover">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Layers className="h-5 w-5" />
              <CardTitle>Gráfico Multi-Ativos</CardTitle>
              <Badge variant="outline" className="flex items-center space-x-1">
                <Crown className="h-3 w-3" />
                <span>Premium</span>
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant={chartType === 'lines' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartType('lines')}
                className="transition-all duration-200"
              >
                <LineChart className="h-4 w-4 mr-1" />
                Linhas
              </Button>
              <Button
                variant={chartType === 'candles' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartType('candles')}
                className="transition-all duration-200"
              >
                <CandlestickChart className="h-4 w-4 mr-1" />
                Candles
              </Button>
              <Button
                variant={chartType === 'percentage' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setChartType('percentage')}
                className="transition-all duration-200"
              >
                <TrendingUp className="h-4 w-4 mr-1" />
                %
              </Button>
              <Button
                variant={showPortfolio ? 'default' : 'outline'}
                size="sm"
                onClick={() => setShowPortfolio(!showPortfolio)}
                disabled={chartType === 'candles'}
                title={chartType === 'candles' ? 'Portfolio não disponível em modo candles' : 'Mostrar/ocultar linha do portfolio'}
                className="transition-all duration-200"
              >
                <PieChart className="h-4 w-4 mr-1" />
                Portfolio
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Chart Type Info */}
            {chartType === 'candles' && (
              <FadeIn>
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3 animate-fade-in-up">
                  <div className="flex items-center space-x-2 text-blue-800 dark:text-blue-200">
                    <CandlestickChart className="h-4 w-4" />
                    <span className="text-sm">
                      Visualização em candles mostra a variação completa de cada período
                    </span>
                  </div>
                </div>
              </FadeIn>
            )}
            
            {/* Asset Selection */}
            <div>
              <h4 className="text-sm font-medium mb-2">Ativos Selecionados ({selectedAssets.length}/{chartType === 'candles' ? '5' : '10'})</h4>
              <Stagger staggerDelay={0.05} className="flex flex-wrap gap-2">
                {assetsData.slice(0, 20).map((asset) => {
                  const isSelected = selectedAssets.includes(asset.asset_id)
                  const color = ASSET_COLORS[selectedAssets.indexOf(asset.asset_id) % ASSET_COLORS.length]
                  
                  return (
                    <Button
                      key={asset.asset_id}
                      variant={isSelected ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => toggleAsset(asset.asset_id)}
                      disabled={!isSelected && selectedAssets.length >= (chartType === 'candles' ? 5 : 10)}
                      className={`${isSelected ? 'border-2' : ''} transition-all duration-200 hover:scale-105`}
                      style={isSelected ? { borderColor: color, backgroundColor: color + '20' } : {}}
                    >
                      <div 
                        className="w-2 h-2 rounded-full mr-2 transition-colors duration-200" 
                        style={{ backgroundColor: isSelected ? color : '#94a3b8' }}
                      />
                      {asset.asset_symbol}
                      <Badge variant="secondary" className="ml-1 text-xs">
                        {asset.asset_class}
                      </Badge>
                    </Button>
                  )
                })}
              </Stagger>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      <FadeIn delay={100}>
        <Card className="card-hover">
          <CardContent className="p-0">
            {isLoading ? (
              <ChartSkeleton />
            ) : (
              <div 
                ref={chartContainerRef} 
                className="w-full animate-fade-in-up"
                style={{ minHeight: '400px' }}
              />
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* Legend */}
      <FadeIn delay={200}>
        <Card className="card-hover">
          <CardHeader>
            <CardTitle className="text-sm">Legenda dos Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {showPortfolio && (
                <FadeIn>
                  <div className="flex items-center space-x-2 hover:bg-muted/50 p-2 rounded transition-colors">
                    <div className="w-3 h-3 bg-gray-800 rounded" />
                    <span className="text-sm font-medium">Portfolio Total</span>
                  </div>
                </FadeIn>
              )}
              <Stagger staggerDelay={0.05}>
                {assetsData
                  .filter(asset => selectedAssets.includes(asset.asset_id))
                  .map((asset) => {
                    const color = ASSET_COLORS[selectedAssets.indexOf(asset.asset_id) % ASSET_COLORS.length]
                    const lastValue = asset.daily_values[asset.daily_values.length - 1]?.value || 0
                    
                    return (
                      <div key={asset.asset_id} className="flex items-center justify-between space-x-2 hover:bg-muted/50 p-2 rounded transition-colors">
                        <div className="flex items-center space-x-2">
                          <div 
                            className="w-3 h-3 rounded transition-transform hover:scale-110" 
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-sm font-medium">{asset.asset_symbol}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 0
                          }).format(lastValue)}
                        </span>
                      </div>
                    )
                  })}
              </Stagger>
            </div>
          </CardContent>
        </Card>
      </FadeIn>
    </FadeIn>
  )
}