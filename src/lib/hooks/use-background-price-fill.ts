import { useCallback } from 'react'

export function useBackgroundPriceFill() {
  const triggerPriceFillForAsset = useCallback(async (assetSymbol: string) => {
    // Só executa para assets globais (não UUIDs)
    const isGlobalAsset = !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(assetSymbol)
    
    if (!isGlobalAsset) {
      return { success: true, message: 'Custom asset, no price fill needed' }
    }

    try {
      // Chama API em background (não bloqueia UI)
      fetch('/api/background-price-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          asset_symbol: assetSymbol, 
          mode: 'single' 
        })
      }).then(response => {
        if (response.ok) {
          console.log(`Background price fill initiated for ${assetSymbol}`)
        } else {
          console.warn(`Price fill failed for ${assetSymbol}`)
        }
      }).catch(error => {
        console.error('Background price fill error:', error)
      })

      return { success: true, message: 'Background price fill initiated' }
    } catch (error) {
      console.error('Error triggering price fill:', error)
      return { success: false, message: 'Failed to trigger price fill' }
    }
  }, [])

  const triggerBatchPriceFill = useCallback(async () => {
    try {
      const response = await fetch('/api/background-price-fill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'batch' })
      })

      const result = await response.json()
      return result
    } catch (error) {
      console.error('Error triggering batch price fill:', error)
      return { success: false, error: 'Failed to trigger batch price fill' }
    }
  }, [])

  const getMissingPricesStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/background-price-fill')
      return await response.json()
    } catch (error) {
      console.error('Error getting missing prices status:', error)
      return { error: 'Failed to get status' }
    }
  }, [])

  return {
    triggerPriceFillForAsset,
    triggerBatchPriceFill,
    getMissingPricesStatus
  }
}