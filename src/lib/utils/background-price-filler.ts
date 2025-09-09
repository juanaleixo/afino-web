/**
 * Background Price Filler Utility
 * Executes price population in controlled batches to avoid blocking the UI
 * Note: This utility should only be used in server-side contexts (API routes)
 */

import { supabaseAdmin } from '@/lib/supabase-admin'

export interface PriceFillerResult {
  processed: number
  success: number
  errors: number
  error_details: Array<{asset: string, error: string}>
  runtime_seconds: number
}

export interface PriceFillerStatus {
  isRunning: boolean
  totalProcessed: number
  totalSuccess: number
  totalErrors: number
  currentBatch: number
  startTime: Date
  lastResult?: PriceFillerResult
}

let currentStatus: PriceFillerStatus | null = null

export async function startBackgroundPriceFilling(): Promise<{success: boolean, message: string}> {
  if (currentStatus?.isRunning) {
    return {
      success: false,
      message: 'Background price filling is already running'
    }
  }

  // Inicializar status
  currentStatus = {
    isRunning: true,
    totalProcessed: 0,
    totalSuccess: 0,
    totalErrors: 0,
    currentBatch: 0,
    startTime: new Date()
  }

  // Executar em background (não bloqueia)
  runPriceFillingBatches()

  return {
    success: true,
    message: 'Background price filling started'
  }
}

async function runPriceFillingBatches() {
  if (!currentStatus) return

  try {
    let continueProcessing = true
    let batchCount = 0
    const maxBatches = 50 // Limite de segurança

    while (continueProcessing && batchCount < maxBatches) {
      batchCount++
      currentStatus.currentBatch = batchCount

      // Chama função do banco em lotes pequenos
      const { data, error } = await supabaseAdmin.rpc('fn_populate_missing_prices_batch', {
        p_batch_size: 3, // Poucos assets por vez
        p_max_runtime_seconds: 30 // Timeout curto
      })

      if (error) {
        console.error('Error in price filling batch:', error)
        continueProcessing = false
        break
      }

      const result: PriceFillerResult = data
      currentStatus.lastResult = result
      currentStatus.totalProcessed += result.processed
      currentStatus.totalSuccess += result.success
      currentStatus.totalErrors += result.errors

      console.log(`Batch ${batchCount} completed:`, result)

      // Para se não processou nada (sem assets faltantes)
      if (result.processed === 0) {
        continueProcessing = false
        console.log('No more assets need price filling')
        break
      }

      // Pausa entre batches para não sobrecarregar
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

  } catch (error) {
    console.error('Error in background price filling:', error)
  } finally {
    if (currentStatus) {
      currentStatus.isRunning = false
    }
  }
}

export function getPriceFillerStatus(): PriceFillerStatus | null {
  return currentStatus
}

export function stopBackgroundPriceFilling(): {success: boolean, message: string} {
  if (!currentStatus?.isRunning) {
    return {
      success: false,
      message: 'Background price filling is not running'
    }
  }

  currentStatus.isRunning = false
  return {
    success: true,
    message: 'Background price filling stopped'
  }
}