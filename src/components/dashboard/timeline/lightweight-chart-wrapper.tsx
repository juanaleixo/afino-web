"use client"

import { useEffect, useRef } from 'react'
import { createChart, ColorType, LineStyle, LineSeries, CandlestickSeries } from 'lightweight-charts'

interface ChartWrapperProps {
  data: any[]
  chartType: 'lines' | 'candles' | 'percentage'
  selectedAssets: any[]
  showPortfolio: boolean
  portfolioData?: any
  isDark: boolean
  onChartReady?: (chart: any) => void
}

export default function LightweightChartWrapper({
  data,
  chartType,
  selectedAssets,
  showPortfolio,
  portfolioData,
  isDark,
  onChartReady
}: ChartWrapperProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)

  useEffect(() => {
    if (!chartContainerRef.current) return

    // Chart implementation moved here for better code splitting
    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: isDark ? '#e2e8f0' : '#64748b',
        fontSize: 12,
      },
      width: chartContainerRef.current.clientWidth,
      height: 400,
      rightPriceScale: {
        borderColor: isDark ? '#374151' : '#e2e8f0',
        scaleMargins: {
          top: 0.1,
          bottom: 0.1,
        },
      },
      timeScale: {
        borderColor: isDark ? '#374151' : '#e2e8f0',
        timeVisible: true,
        secondsVisible: false,
      },
      crosshair: {
        mode: 1,
        vertLine: {
          color: isDark ? '#9ca3af' : '#64748b',
          width: 1,
          style: LineStyle.Dashed,
        },
        horzLine: {
          color: isDark ? '#9ca3af' : '#64748b',
          width: 1,
          style: LineStyle.Dashed,
        },
      },
      grid: {
        vertLines: {
          color: isDark ? '#1f2937' : '#f1f5f9',
        },
        horzLines: {
          color: isDark ? '#1f2937' : '#f1f5f9',
        },
      },
    })

    chartRef.current = chart
    onChartReady?.(chart)

    return () => {
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [isDark, onChartReady])

  return (
    <div 
      ref={chartContainerRef} 
      className="w-full animate-fade-in-up"
      style={{ minHeight: '400px' }}
    />
  )
}