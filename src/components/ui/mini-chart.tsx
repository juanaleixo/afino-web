"use client"

import { ResponsiveContainer, LineChart, Line } from 'recharts'

interface MiniChartProps {
  data: Array<{ date: string; value: number }>
  color?: string
  height?: number
  showDots?: boolean
}

export default function MiniChart({ 
  data, 
  color = '#3b82f6', 
  height = 60,
  showDots = false 
}: MiniChartProps) {
  if (!data || data.length === 0) {
    return (
      <div 
        className="w-full bg-muted/20 rounded animate-pulse" 
        style={{ height }}
      />
    )
  }

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <Line
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2}
          dot={showDots ? { fill: color, strokeWidth: 0, r: 2 } : false}
          activeDot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}