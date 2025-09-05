import { useState, useCallback, useMemo, useEffect } from 'react'

export interface SelectionRange {
  left: number | string
  right: number | string
}

export interface ChartSelectionState {
  refAreaLeft: string | number
  refAreaRight: string | number
  isDragging: boolean
  selectionData: Record<string, unknown>[]
}

export interface UseChartSelectionOptions {
  data?: Record<string, unknown>[]
  dateKey?: string
  valueKey?: string
  onSelectionChange?: (selectionData: Record<string, unknown>[]) => void
}

export function useChartSelection({
  data = [],
  dateKey = 'date',
  valueKey = 'total_value',
  onSelectionChange
}: UseChartSelectionOptions = {}) {
  
  const [selectionState, setSelectionState] = useState<ChartSelectionState>({
    refAreaLeft: '',
    refAreaRight: '',
    isDragging: false,
    selectionData: []
  })

  // Iniciar seleção por arrasto
  const handleMouseDown = useCallback((e: { activeLabel?: string; domEvent?: Event }) => {
    if (!e || !e.activeLabel) return
    
    // Prevenir seleção de texto durante arrasto
    if (e.domEvent) {
      e.domEvent.preventDefault()
      e.domEvent.stopPropagation()
    }
    
    // Desabilitar seleção de texto no documento
    document.body.style.userSelect = 'none'
    document.body.style.webkitUserSelect = 'none'
    
    setSelectionState(prev => ({
      ...prev,
      refAreaLeft: e.activeLabel || '',
      refAreaRight: e.activeLabel || '',
      isDragging: true,
      selectionData: []
    }))
  }, [])

  // Atualizar seleção durante arrasto
  const handleMouseMove = useCallback((e: { activeLabel?: string }) => {
    if (!e || !selectionState.isDragging || !e.activeLabel) return
    
    setSelectionState(prev => ({
      ...prev,
      refAreaRight: e.activeLabel || ''
    }))
  }, [selectionState.isDragging])

  // Finalizar seleção
  const handleMouseUp = useCallback(() => {
    if (!selectionState.isDragging) return

    // Reabilitar seleção de texto no documento
    document.body.style.userSelect = ''
    document.body.style.webkitUserSelect = ''

    const { refAreaLeft, refAreaRight } = selectionState

    // Se não há seleção válida, limpar
    if (refAreaLeft === refAreaRight || !refAreaLeft || !refAreaRight) {
      setSelectionState({
        refAreaLeft: '',
        refAreaRight: '',
        isDragging: false,
        selectionData: []
      })
      return
    }

    // Determinar range da seleção
    const leftIndex = data.findIndex(item => 
      String(item[dateKey]) === String(refAreaLeft)
    )
    const rightIndex = data.findIndex(item => 
      String(item[dateKey]) === String(refAreaRight)
    )

    if (leftIndex === -1 || rightIndex === -1) {
      setSelectionState({
        refAreaLeft: '',
        refAreaRight: '',
        isDragging: false,
        selectionData: []
      })
      return
    }

    // Garantir ordem correta dos índices
    const startIndex = Math.min(leftIndex, rightIndex)
    const endIndex = Math.max(leftIndex, rightIndex)

    // Extrair dados da seleção
    const selectionData = data.slice(startIndex, endIndex + 1)

    setSelectionState(prev => ({
      ...prev,
      isDragging: false,
      selectionData
    }))

    // Callback para componente pai
    if (onSelectionChange) {
      onSelectionChange(selectionData)
    }
  }, [data, dateKey, selectionState, onSelectionChange])

  // Limpar seleção
  const clearSelection = useCallback(() => {
    setSelectionState({
      refAreaLeft: '',
      refAreaRight: '',
      isDragging: false,
      selectionData: []
    })
    
    if (onSelectionChange) {
      onSelectionChange([])
    }
  }, [onSelectionChange])

  // Selecionar range específico
  const selectRange = useCallback((startDate: string | number, endDate: string | number) => {
    const leftIndex = data.findIndex(item => 
      String(item[dateKey]) === String(startDate)
    )
    const rightIndex = data.findIndex(item => 
      String(item[dateKey]) === String(endDate)
    )

    if (leftIndex === -1 || rightIndex === -1) return

    const startIndex = Math.min(leftIndex, rightIndex)
    const endIndex = Math.max(leftIndex, rightIndex)
    const selectionData = data.slice(startIndex, endIndex + 1)

    setSelectionState({
      refAreaLeft: startDate,
      refAreaRight: endDate,
      isDragging: false,
      selectionData
    })

    if (onSelectionChange) {
      onSelectionChange(selectionData)
    }
  }, [data, dateKey, onSelectionChange])

  // Estatísticas da seleção
  const selectionStats = useMemo(() => {
    const { selectionData } = selectionState
    
    if (!selectionData.length) return null

    const values = selectionData.map(item => Number(item[valueKey]) || 0)
    const startValue = values[0] || 0
    const endValue = values[values.length - 1] || 0
    const minValue = Math.min(...values)
    const maxValue = Math.max(...values)
    const totalChange = endValue - startValue
    const percentChange = startValue > 0 ? (totalChange / startValue) * 100 : 0

    return {
      period: {
        start: selectionData[0]?.[dateKey] || '',
        end: selectionData[selectionData.length - 1]?.[dateKey] || ''
      },
      values: {
        start: startValue,
        end: endValue,
        min: minValue,
        max: maxValue,
        change: totalChange,
        percentChange
      },
      count: selectionData.length
    }
  }, [selectionState, valueKey, dateKey])

  // Verificar se há seleção ativa
  const hasSelection = selectionState.selectionData.length > 0

  // Range atual para uso no ReferenceArea
  const currentRange = useMemo(() => {
    if (!selectionState.refAreaLeft || !selectionState.refAreaRight) return null
    
    return {
      left: selectionState.refAreaLeft,
      right: selectionState.refAreaRight
    }
  }, [selectionState.refAreaLeft, selectionState.refAreaRight])

  // Cleanup ao desmontar componente
  useEffect(() => {
    return () => {
      // Garantir que a seleção de texto seja reabilitada ao desmontar
      document.body.style.userSelect = ''
      document.body.style.webkitUserSelect = ''
    }
  }, [])

  return {
    // Estado
    selectionState,
    hasSelection,
    currentRange,
    selectionStats,
    
    // Handlers para eventos do gráfico
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    
    // Métodos de controle
    clearSelection,
    selectRange
  }
}