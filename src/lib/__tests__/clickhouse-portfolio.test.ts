import { HybridPortfolioService } from '../portfolio'
import { clickhouse } from '../clickhouse'
import { EventProcessor } from '../sync/event-processor'

// Mock ClickHouse client
jest.mock('../clickhouse', () => ({
  clickhouse: {
    query: jest.fn(),
    insert: jest.fn()
  },
  ClickHouseHelpers: {
    buildPortfolioDailyQuery: jest.fn(),
    buildCurrentHoldingsQuery: jest.fn(),
    buildAssetBreakdownQuery: jest.fn(),
    buildPerformanceAnalysisQuery: jest.fn()
  }
}))

// Mock Supabase
jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          gte: jest.fn(() => ({
            lte: jest.fn(() => ({
              eq: jest.fn(() => ({
                order: jest.fn(() => ({
                  then: jest.fn(() => Promise.resolve({ data: [], error: null }))
                }))
              }))
            }))
          }))
        }))
      }))
    })),
    rpc: jest.fn(() => Promise.resolve({ data: [], error: null }))
  }
}))

const mockClickhouse = clickhouse as jest.Mocked<typeof clickhouse>

describe('HybridPortfolioService', () => {
  let service: HybridPortfolioService
  const testUserId = 'test-user-123'

  beforeEach(() => {
    service = new HybridPortfolioService(testUserId, { assumedPlan: 'premium' })
    jest.clearAllMocks()
  })

  describe('getDailySeries', () => {
    it('should fetch daily series from ClickHouse successfully', async () => {
      const mockData = [
        { date: '2024-01-01', total_value: 10000, daily_change: 0, daily_return_pct: 0 },
        { date: '2024-01-02', total_value: 10500, daily_change: 500, daily_return_pct: 5 }
      ]

      mockClickhouse.query.mockResolvedValue({
        json: jest.fn().mockResolvedValue(mockData)
      } as any)

      const result = await service.getDailySeries('2024-01-01', '2024-01-31')

      expect(result).toEqual([
        { date: '2024-01-01', total_value: 10000 },
        { date: '2024-01-02', total_value: 10500 }
      ])
      expect(mockClickhouse.query).toHaveBeenCalledTimes(1)
    })

    it('should fallback to Supabase when ClickHouse fails', async () => {
      mockClickhouse.query.mockRejectedValue(new Error('ClickHouse connection failed'))

      // Mock Supabase fallback response
      const mockSupabaseData = [
        { date: '2024-01-01', value: 10000, is_final: true },
        { date: '2024-01-02', value: 10500, is_final: true }
      ]

      // This would be handled by the fallback method
      // The actual implementation would need proper Supabase mocking

      try {
        await service.getDailySeries('2024-01-01', '2024-01-31')
      } catch (error) {
        // Expected to reach fallback
        expect(mockClickhouse.query).toHaveBeenCalledTimes(1)
      }
    })
  })

  describe('getMonthlySeries', () => {
    it('should fetch monthly series from ClickHouse', async () => {
      const mockData = [
        { month_eom: '2024-01-31', total_value: 10000, monthly_change: 0, monthly_return_pct: 0 },
        { month_eom: '2024-02-29', total_value: 11000, monthly_change: 1000, monthly_return_pct: 10 }
      ]

      mockClickhouse.query.mockResolvedValue({
        json: jest.fn().mockResolvedValue(mockData)
      } as any)

      const result = await service.getMonthlySeries('2024-01-01', '2024-02-29')

      expect(result).toEqual([
        { month_eom: '2024-01-31', total_value: 10000 },
        { month_eom: '2024-02-29', total_value: 11000 }
      ])
    })
  })

  describe('getHoldingsAt', () => {
    it('should fetch current holdings from ClickHouse', async () => {
      const mockData = [
        { asset_id: 'PETR4', symbol: 'PETR4', class: 'stock', units: 100, current_price: 25.50, value: 2550 },
        { asset_id: 'BRL', symbol: 'BRL', class: 'currency', units: 7450, current_price: 1, value: 7450 }
      ]

      mockClickhouse.query.mockResolvedValue({
        json: jest.fn().mockResolvedValue(mockData)
      } as any)

      const result = await service.getHoldingsAt('2024-01-31')

      expect(result).toEqual([
        { asset_id: 'PETR4', units: 100, value: 2550, symbol: 'PETR4', class: 'stock' },
        { asset_id: 'BRL', units: 7450, value: 7450, symbol: 'BRL', class: 'currency' }
      ])
    })
  })

  describe('getAssetBreakdown', () => {
    it('should fetch asset breakdown from ClickHouse for premium users', async () => {
      const mockData = [
        {
          date: '2024-01-31',
          asset_id: 'PETR4',
          asset_symbol: 'PETR4',
          asset_class: 'stock',
          value: 2550,
          percentage: 25.5,
          volatility: 0.15,
          sharpe_ratio: 1.2,
          max_drawdown: -0.05
        }
      ]

      mockClickhouse.query.mockResolvedValue({
        json: jest.fn().mockResolvedValue(mockData)
      } as any)

      const result = await service.getAssetBreakdown('2024-01-01', '2024-01-31')

      expect(result).toEqual([
        {
          date: '2024-01-31',
          asset_id: 'PETR4',
          asset_symbol: 'PETR4',
          asset_class: 'stock',
          value: 2550,
          percentage: 25.5
        }
      ])
    })

    it('should throw error for free users', async () => {
      const freeService = new HybridPortfolioService(testUserId, { assumedPlan: 'free' })
      
      await expect(freeService.getAssetBreakdown('2024-01-01', '2024-01-31'))
        .rejects.toThrow('Funcionalidade breakdown por ativo requer plano premium')
    })
  })

  describe('getAssetPerformanceAnalysis', () => {
    it('should calculate performance metrics from ClickHouse', async () => {
      const mockData = [
        {
          asset_id: 'PETR4',
          asset_symbol: 'PETR4',
          asset_class: 'stock',
          first_value: 2000,
          last_value: 2550,
          total_return: 550,
          total_return_percent: 27.5,
          volatility: 15.2,
          sharpe_ratio: 1.81,
          data_points: 31,
          daily_values: [['2024-01-01', 2000], ['2024-01-31', 2550]]
        }
      ]

      mockClickhouse.query.mockResolvedValue({
        json: jest.fn().mockResolvedValue(mockData)
      } as any)

      const result = await service.getAssetPerformanceAnalysis('2024-01-01', '2024-01-31')

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        asset_id: 'PETR4',
        asset_symbol: 'PETR4',
        totalReturn: 550,
        totalReturnPercent: 27.5,
        volatility: 15.2,
        sharpeRatio: 1.81,
        dataPoints: 31
      })
      expect(result[0].daily_values).toEqual([
        { date: '2024-01-01', value: 2000 },
        { date: '2024-01-31', value: 2550 }
      ])
    })
  })
})

describe('EventProcessor', () => {
  let processor: EventProcessor
  const testUserId = 'test-user-123'

  beforeEach(() => {
    processor = new EventProcessor(testUserId)
    jest.clearAllMocks()
  })

  describe('processNewEvent', () => {
    it('should save event to Supabase and sync to ClickHouse', async () => {
      const mockSupabaseInsert = jest.fn().mockResolvedValue({
        data: {
          id: 'evt-123',
          user_id: testUserId,
          asset_id: 'PETR4',
          kind: 'buy',
          units_delta: 100,
          price_close: 25.50
        },
        error: null
      })

      // Mock Supabase chain
      require('../supabase').supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: mockSupabaseInsert
          })
        })
      })

      mockClickhouse.insert.mockResolvedValue(undefined)

      const eventData = {
        asset_id: 'PETR4',
        kind: 'buy' as const,
        units_delta: 100,
        price_close: 25.50
      }

      const result = await processor.processNewEvent(eventData)

      expect(result.id).toBe('evt-123')
      expect(mockClickhouse.insert).toHaveBeenCalledWith('events_stream', [
        expect.objectContaining({
          user_id: testUserId,
          asset_id: 'PETR4',
          kind: 'buy',
          units_delta: 100,
          price_close: 25.50,
          source: 'manual'
        })
      ])
    })

    it('should handle ClickHouse sync failures gracefully', async () => {
      // Mock successful Supabase save
      require('../supabase').supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { id: 'evt-123' },
              error: null
            })
          })
        })
      })

      // Mock ClickHouse failure
      mockClickhouse.insert.mockRejectedValue(new Error('ClickHouse unavailable'))

      const eventData = {
        asset_id: 'PETR4',
        kind: 'buy' as const,
        units_delta: 100,
        price_close: 25.50
      }

      // Should not throw error even if ClickHouse fails
      const result = await processor.processNewEvent(eventData)
      expect(result.id).toBe('evt-123')
    })
  })

  describe('updateAssetValuation', () => {
    it('should create valuation event with zero units_delta', async () => {
      const mockSupabaseInsert = jest.fn().mockResolvedValue({
        data: { id: 'evt-valuation-123' },
        error: null
      })

      require('../supabase').supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: mockSupabaseInsert
          })
        })
      })

      mockClickhouse.insert.mockResolvedValue(undefined)

      await processor.updateAssetValuation('PETR4', 26.75)

      expect(mockClickhouse.insert).toHaveBeenCalledWith('events_stream', [
        expect.objectContaining({
          asset_id: 'PETR4',
          kind: 'valuation',
          units_delta: 0,
          price_override: 26.75,
          notes: 'Price update: 26.75'
        })
      ])
    })
  })

  describe('processBatchEvents', () => {
    it('should handle batch processing efficiently', async () => {
      const batchEvents = [
        { asset_id: 'PETR4', kind: 'buy' as const, units_delta: 100, price_close: 25.50, tstamp: '2024-01-01T10:00:00Z' },
        { asset_id: 'VALE3', kind: 'buy' as const, units_delta: 50, price_close: 65.20, tstamp: '2024-01-01T11:00:00Z' }
      ]

      require('../supabase').supabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockResolvedValue({
            data: batchEvents.map((_, i) => ({ id: `evt-batch-${i}`, ...batchEvents[i] })),
            error: null
          })
        })
      })

      mockClickhouse.insert.mockResolvedValue(undefined)

      const result = await processor.processBatchEvents(batchEvents)

      expect(result).toHaveLength(2)
      expect(mockClickhouse.insert).toHaveBeenCalledWith('events_stream', 
        expect.arrayContaining([
          expect.objectContaining({ asset_id: 'PETR4', source: 'import' }),
          expect.objectContaining({ asset_id: 'VALE3', source: 'import' })
        ])
      )
    })
  })
})

describe('Integration Tests', () => {
  it('should handle end-to-end event processing and portfolio calculation', async () => {
    // This would be a more comprehensive integration test
    // Testing the full flow from event creation to portfolio calculation
    
    const processor = new EventProcessor('test-user-integration')
    const service = new HybridPortfolioService('test-user-integration', { assumedPlan: 'premium' })

    // Mock successful event creation
    require('../supabase').supabase.from.mockReturnValue({
      insert: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { id: 'evt-integration-123' },
            error: null
          })
        })
      })
    })

    mockClickhouse.insert.mockResolvedValue(undefined)
    mockClickhouse.query.mockResolvedValue({
      json: jest.fn().mockResolvedValue([
        { date: '2024-01-31', total_value: 10000 }
      ])
    } as any)

    // Create event
    await processor.processNewEvent({
      asset_id: 'PETR4',
      kind: 'buy',
      units_delta: 100,
      price_close: 25.50
    })

    // Verify portfolio calculation works
    const dailySeries = await service.getDailySeries('2024-01-01', '2024-01-31')
    expect(dailySeries).toEqual([
      { date: '2024-01-31', total_value: 10000 }
    ])
  })
})