import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Cliente com service role para operações em background
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { asset_symbol, mode } = await request.json()

    if (!asset_symbol) {
      return NextResponse.json(
        { error: 'asset_symbol is required' },
        { status: 400 }
      )
    }

    let result
    
    if (mode === 'single') {
      // Preenche preços para um único asset (chamada rápida)
      const { data, error } = await supabase.rpc('fn_fill_single_asset_prices', {
        p_asset_symbol: asset_symbol
      })

      if (error) {
        console.error('Error filling prices for single asset:', error)
        return NextResponse.json(
          { error: 'Failed to fill prices', details: error.message },
          { status: 500 }
        )
      }

      result = data
    } else {
      // Modo batch (para preenchimento em massa)
      const { data, error } = await supabase.rpc('fn_populate_missing_prices_batch', {
        p_batch_size: 5,
        p_max_runtime_seconds: 45
      })

      if (error) {
        console.error('Error in batch price filling:', error)
        return NextResponse.json(
          { error: 'Failed to fill prices in batch', details: error.message },
          { status: 500 }
        )
      }

      result = data
    }

    return NextResponse.json({
      success: true,
      result
    })

  } catch (error) {
    console.error('Error in background price fill API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Endpoint para verificar status
export async function GET() {
  try {
    // Retorna lista de assets que precisam de preços
    const { data, error } = await supabase.rpc('fn_find_missing_prices')

    if (error) {
      return NextResponse.json(
        { error: 'Failed to get missing prices status' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      missing_prices: data,
      total_assets_missing: data?.length || 0
    })

  } catch (error) {
    console.error('Error getting price fill status:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}