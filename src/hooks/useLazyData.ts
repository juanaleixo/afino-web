import { useState, useEffect, useCallback } from 'react'

interface UseLazyDataOptions<T> {
  initialData?: T[]
  pageSize?: number
  loadFn: (page: number, pageSize: number) => Promise<T[]>
  dependencies?: any[]
}

interface UseLazyDataReturn<T> {
  data: T[]
  loading: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => void
  refresh: () => void
  page: number
  totalLoaded: number
}

export function useLazyData<T>({
  initialData = [],
  pageSize = 20,
  loadFn,
  dependencies = [],
}: UseLazyDataOptions<T>): UseLazyDataReturn<T> {
  const [data, setData] = useState<T[]>(initialData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const loadData = useCallback(
    async (pageNum: number, append = false) => {
      if (loading) return

      setLoading(true)
      setError(null)

      try {
        const newData = await loadFn(pageNum, pageSize)
        
        if (append) {
          setData(prev => [...prev, ...newData])
        } else {
          setData(newData)
        }

        setHasMore(newData.length === pageSize)
        setPage(pageNum)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
        console.error('Error loading data:', err)
      } finally {
        setLoading(false)
      }
    },
    [loadFn, pageSize, loading]
  )

  const loadMore = useCallback(() => {
    if (hasMore && !loading) {
      loadData(page + 1, true)
    }
  }, [hasMore, loading, page, loadData])

  const refresh = useCallback(() => {
    setPage(0)
    setHasMore(true)
    loadData(0, false)
  }, [loadData])

  // Load initial data when dependencies change
  useEffect(() => {
    refresh()
  }, dependencies)

  return {
    data,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    page,
    totalLoaded: data.length,
  }
}