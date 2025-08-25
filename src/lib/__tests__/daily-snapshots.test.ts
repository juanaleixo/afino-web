// Mock Supabase before importing the module
jest.mock('../supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            data: [],
            error: null
          }))
        }))
      }))
    }))
  }
}))

import {
  calculatePositionsAtDate,
  calculateDailySnapshot,
  toSaoPauloDate,
  getSaoPauloToday,
  getSaoPauloDayEnd,
  getSaoPauloDayStart,
  snapshotCache,
  EventForSnapshot,
  AssetPosition
} from '../daily-snapshots'

describe('Daily Snapshots', () => {
  beforeEach(() => {
    // Clear cache before each test
    snapshotCache.clear()
  })

  describe('Timezone utilities', () => {
    test('should format date in São Paulo timezone', () => {
      const date = new Date('2024-01-15T10:30:00Z')
      const formatted = toSaoPauloDate(date)
      expect(formatted).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })

    test('should get São Paulo day end', () => {
      const dayEnd = getSaoPauloDayEnd('2024-01-15')
      expect(dayEnd.toISOString()).toBe('2024-01-16T02:59:59.000Z')
    })

    test('should get São Paulo day start', () => {
      const dayStart = getSaoPauloDayStart('2024-01-15')
      expect(dayStart.toISOString()).toBe('2024-01-15T03:00:00.000Z')
    })
  })

  describe('Position calculation', () => {
    const mockEvents: EventForSnapshot[] = [
      {
        id: '1',
        user_id: 'user1',
        asset_id: 'cash-brl',
        tstamp: '2024-01-10T10:00:00-03:00',
        kind: 'deposit',
        units_delta: 1000,
        global_assets: { symbol: 'BRL', class: 'currency' }
      },
      {
        id: '2',
        user_id: 'user1',
        asset_id: 'stock-petr4',
        tstamp: '2024-01-11T14:00:00-03:00',
        kind: 'buy',
        units_delta: 100,
        price_close: 30.50,
        global_assets: { symbol: 'PETR4', class: 'stock' }
      },
      {
        id: '3',
        user_id: 'user1',
        asset_id: 'cash-brl',
        tstamp: '2024-01-11T14:00:00-03:00',
        kind: 'withdraw',
        units_delta: -3050, // Cash outflow for stock purchase
        global_assets: { symbol: 'BRL', class: 'currency' }
      },
      {
        id: '4',
        user_id: 'user1',
        asset_id: 'stock-petr4',
        tstamp: '2024-01-12T16:00:00-03:00',
        kind: 'valuation',
        price_override: 32.00,
        global_assets: { symbol: 'PETR4', class: 'stock' }
      }
    ]

    test('should calculate positions at specific date - day 1 (cash only)', () => {
      const positions = calculatePositionsAtDate(mockEvents, '2024-01-10')
      
      expect(positions).toHaveLength(1)
      expect(positions[0]).toEqual({
        asset_id: 'cash-brl',
        symbol: 'BRL',
        asset_class: 'currency',
        quantity: 1000,
        last_price: 1
      })
    })

    test('should calculate positions at specific date - day 2 (cash + stock)', () => {
      const positions = calculatePositionsAtDate(mockEvents, '2024-01-11')
      
      expect(positions).toHaveLength(2)
      
      const cashPosition = positions.find(p => p.asset_id === 'cash-brl')
      expect(cashPosition).toEqual({
        asset_id: 'cash-brl',
        symbol: 'BRL',
        asset_class: 'currency',
        quantity: -2050, // 1000 - 3050
        last_price: 1
      })

      const stockPosition = positions.find(p => p.asset_id === 'stock-petr4')
      expect(stockPosition).toEqual({
        asset_id: 'stock-petr4',
        symbol: 'PETR4',
        asset_class: 'stock',
        quantity: 100,
        last_price: 30.50
      })
    })

    test('should calculate positions at specific date - day 3 (with valuation)', () => {
      const positions = calculatePositionsAtDate(mockEvents, '2024-01-12')
      
      const stockPosition = positions.find(p => p.asset_id === 'stock-petr4')
      expect(stockPosition?.last_price).toBe(32.00) // Updated by valuation
    })

    test('should exclude events after target date', () => {
      const positions = calculatePositionsAtDate(mockEvents, '2024-01-09')
      expect(positions).toHaveLength(0)
    })
  })

  describe('Snapshot calculation', () => {
    const mockPositions: AssetPosition[] = [
      {
        asset_id: 'cash-brl',
        symbol: 'BRL',
        asset_class: 'currency',
        quantity: 2000,
        last_price: 1
      },
      {
        asset_id: 'stock-petr4',
        symbol: 'PETR4',
        asset_class: 'stock',
        quantity: 100,
        last_price: 32.00
      },
      {
        asset_id: 'crypto-btc',
        symbol: 'BTC',
        asset_class: 'crypto',
        quantity: 0.5,
        last_price: 200000
      }
    ]

    test('should calculate daily snapshot correctly', () => {
      const snapshot = calculateDailySnapshot(mockPositions, '2024-01-12', 'user1')
      
      expect(snapshot.date).toBe('2024-01-12')
      expect(snapshot.cash_balance).toBe(2000) // BRL cash
      expect(snapshot.assets_value).toBe(3200 + 100000) // PETR4 + BTC
      expect(snapshot.total_value).toBe(2000 + 3200 + 100000)
      
      expect(snapshot.asset_breakdown).toHaveLength(2)
      
      const petr4Asset = snapshot.asset_breakdown.find(a => a.symbol === 'PETR4')
      expect(petr4Asset).toEqual({
        asset_id: 'stock-petr4',
        symbol: 'PETR4',
        asset_class: 'stock',
        quantity: 100,
        price: 32.00,
        value: 3200
      })

      const btcAsset = snapshot.asset_breakdown.find(a => a.symbol === 'BTC')
      expect(btcAsset).toEqual({
        asset_id: 'crypto-btc',
        symbol: 'BTC',
        asset_class: 'crypto',
        quantity: 0.5,
        price: 200000,
        value: 100000
      })
    })

    test('should handle negative cash balance', () => {
      const negativePositions: AssetPosition[] = [
        {
          asset_id: 'cash-brl',
          symbol: 'BRL',
          asset_class: 'currency',
          quantity: -1000,
          last_price: 1
        }
      ]

      const snapshot = calculateDailySnapshot(negativePositions, '2024-01-12', 'user1')
      
      expect(snapshot.cash_balance).toBe(-1000)
      expect(snapshot.assets_value).toBe(0)
      expect(snapshot.total_value).toBe(-1000)
    })
  })

  describe('Cache functionality', () => {
    test('should cache and retrieve snapshots', () => {
      const mockSnapshot = {
        date: '2024-01-12',
        total_value: 10000,
        cash_balance: 5000,
        assets_value: 5000,
        asset_breakdown: []
      }

      // Set cache
      snapshotCache.set('user1', '2024-01-12', mockSnapshot)
      
      // Get from cache
      const cached = snapshotCache.get('user1', '2024-01-12')
      expect(cached).toEqual(mockSnapshot)
    })

    test('should return undefined for non-cached entries', () => {
      const cached = snapshotCache.get('user1', '2024-01-13')
      expect(cached).toBeUndefined()
    })

    test('should invalidate specific date', () => {
      const mockSnapshot = {
        date: '2024-01-12',
        total_value: 10000,
        cash_balance: 5000,
        assets_value: 5000,
        asset_breakdown: []
      }

      snapshotCache.set('user1', '2024-01-12', mockSnapshot)
      snapshotCache.invalidate('user1', '2024-01-12')
      
      const cached = snapshotCache.get('user1', '2024-01-12')
      expect(cached).toBeUndefined()
    })

    test('should invalidate all user entries', () => {
      const mockSnapshot = {
        date: '2024-01-12',
        total_value: 10000,
        cash_balance: 5000,
        assets_value: 5000,
        asset_breakdown: []
      }

      snapshotCache.set('user1', '2024-01-12', mockSnapshot)
      snapshotCache.set('user1', '2024-01-13', mockSnapshot)
      snapshotCache.set('user2', '2024-01-12', mockSnapshot)
      
      snapshotCache.invalidate('user1')
      
      expect(snapshotCache.get('user1', '2024-01-12')).toBeUndefined()
      expect(snapshotCache.get('user1', '2024-01-13')).toBeUndefined()
      expect(snapshotCache.get('user2', '2024-01-12')).toEqual(mockSnapshot)
    })
  })

  describe('Cash vs Asset price handling', () => {
    test('should handle cash with fixed price (1.0) and assets with variable prices', () => {
      const events: EventForSnapshot[] = [
        // Cash deposit - preço sempre 1.0
        {
          id: 'cash1',
          user_id: 'user',
          asset_id: 'cash-brl',
          tstamp: '2024-01-01T10:00:00-03:00',
          kind: 'deposit',
          units_delta: 5000,
          global_assets: { symbol: 'BRL', class: 'currency' }
        },
        // Buy stock - define preço na compra
        {
          id: 'stock1',
          user_id: 'user',
          asset_id: 'stock-test',
          tstamp: '2024-01-02T10:00:00-03:00',
          kind: 'buy',
          units_delta: 100,
          price_close: 50.00, // Preço da compra
          global_assets: { symbol: 'TEST', class: 'stock' }
        },
        // Withdraw cash - só quantidade, preço continua 1.0
        {
          id: 'cash2',
          user_id: 'user',
          asset_id: 'cash-brl',
          tstamp: '2024-01-03T15:00:00-03:00',
          kind: 'withdraw',
          units_delta: -2000, // Retirada
          global_assets: { symbol: 'BRL', class: 'currency' }
        },
        // Withdraw stock - só quantidade, preço não muda
        {
          id: 'stock2',
          user_id: 'user',
          asset_id: 'stock-test',
          tstamp: '2024-01-04T11:00:00-03:00',
          kind: 'withdraw',
          units_delta: -30, // Retirada de 30 ações
          global_assets: { symbol: 'TEST', class: 'stock' }
        }
      ]

      // Dia 1: Só cash
      const day1 = calculatePositionsAtDate(events, '2024-01-01')
      expect(day1).toHaveLength(1)
      const onlyPos = day1[0]!
      expect(onlyPos.quantity).toBe(5000)
      expect(onlyPos.last_price).toBe(1) // Cash sempre 1.0
      
      // Dia 2: Cash + stock
      const day2 = calculatePositionsAtDate(events, '2024-01-02')
      const cashPos = day2.find(p => p.asset_class === 'currency')!
      const stockPos = day2.find(p => p.asset_class === 'stock')!
      
      expect(cashPos.quantity).toBe(5000)
      expect(cashPos.last_price).toBe(1) // Cash sempre 1.0
      expect(stockPos.quantity).toBe(100)
      expect(stockPos.last_price).toBe(50) // Preço da compra
      
      // Dia 3: Retirada de cash
      const day3 = calculatePositionsAtDate(events, '2024-01-03')
      const cash3 = day3.find(p => p.asset_class === 'currency')!
      const stock3 = day3.find(p => p.asset_class === 'stock')!
      
      expect(cash3.quantity).toBe(3000) // 5000 - 2000
      expect(cash3.last_price).toBe(1) // Preço não mudou
      expect(stock3.quantity).toBe(100)
      expect(stock3.last_price).toBe(50) // Preço não mudou
      
      // Dia 4: Retirada de ações
      const day4 = calculatePositionsAtDate(events, '2024-01-04')
      const cash4 = day4.find(p => p.asset_class === 'currency')!
      const stock4 = day4.find(p => p.asset_class === 'stock')!
      
      expect(cash4.quantity).toBe(3000)
      expect(cash4.last_price).toBe(1) // Preço não mudou
      expect(stock4.quantity).toBe(70) // 100 - 30 
      expect(stock4.last_price).toBe(50) // PREÇO NÃO MUDOU na retirada!
      
      // Snapshot final
      const snapshot = calculateDailySnapshot(day4, '2024-01-04', 'user')
      expect(snapshot.cash_balance).toBe(3000) // 3000 × 1.0
      expect(snapshot.assets_value).toBe(3500) // 70 × 50.0
      expect(snapshot.total_value).toBe(6500)
      
      console.log('\n✅ Verificação de preços:')
      console.log(`   Cash: ${cash4.quantity} × R$ ${cash4.last_price} = R$ ${cash4.quantity * cash4.last_price}`)
      console.log(`   Stock: ${stock4.quantity} × R$ ${stock4.last_price} = R$ ${stock4.quantity * stock4.last_price}`)
      console.log(`   Total: R$ ${snapshot.total_value}`)
    })
  })

  describe('Integration test - Reference spreadsheet case', () => {
    test('should match reference spreadsheet calculation', () => {
      // Reference case: User starts with R$ 10,000, buys R$ 3,000 of PETR4, 
      // stock appreciates to R$ 35/share, total should be R$ 10,500
      const referenceEvents: EventForSnapshot[] = [
        // Day 1: Deposit R$ 10,000
        {
          id: '1',
          user_id: 'ref_user',
          asset_id: 'cash-brl',
          tstamp: '2024-01-01T09:00:00-03:00',
          kind: 'deposit',
          units_delta: 10000,
          global_assets: { symbol: 'BRL', class: 'currency' }
        },
        // Day 2: Buy 100 shares of PETR4 at R$ 30/share
        {
          id: '2',
          user_id: 'ref_user',
          asset_id: 'stock-petr4',
          tstamp: '2024-01-02T10:00:00-03:00',
          kind: 'buy',
          units_delta: 100,
          price_close: 30.00,
          global_assets: { symbol: 'PETR4', class: 'stock' }
        },
        {
          id: '3',
          user_id: 'ref_user',
          asset_id: 'cash-brl',
          tstamp: '2024-01-02T10:00:00-03:00',
          kind: 'withdraw',
          units_delta: -3000, // Cash outflow
          global_assets: { symbol: 'BRL', class: 'currency' }
        },
        // Day 3: Stock valuation update to R$ 35/share
        {
          id: '4',
          user_id: 'ref_user',
          asset_id: 'stock-petr4',
          tstamp: '2024-01-03T16:00:00-03:00',
          kind: 'valuation',
          price_override: 35.00,
          global_assets: { symbol: 'PETR4', class: 'stock' }
        }
      ]

      // Day 1: Only cash
      const day1Positions = calculatePositionsAtDate(referenceEvents, '2024-01-01')
      const day1Snapshot = calculateDailySnapshot(day1Positions, '2024-01-01', 'ref_user')
      
      expect(day1Snapshot.cash_balance).toBe(10000)
      expect(day1Snapshot.assets_value).toBe(0)
      expect(day1Snapshot.total_value).toBe(10000)

      // Day 2: Cash + stock at purchase price
      const day2Positions = calculatePositionsAtDate(referenceEvents, '2024-01-02')
      const day2Snapshot = calculateDailySnapshot(day2Positions, '2024-01-02', 'ref_user')
      
      expect(day2Snapshot.cash_balance).toBe(7000) // 10000 - 3000
      expect(day2Snapshot.assets_value).toBe(3000) // 100 * 30.00
      expect(day2Snapshot.total_value).toBe(10000) // No change in total

      // Day 3: Cash + stock at new valuation
      const day3Positions = calculatePositionsAtDate(referenceEvents, '2024-01-03')
      const day3Snapshot = calculateDailySnapshot(day3Positions, '2024-01-03', 'ref_user')
      
      expect(day3Snapshot.cash_balance).toBe(7000) // Unchanged
      expect(day3Snapshot.assets_value).toBe(3500) // 100 * 35.00
      expect(day3Snapshot.total_value).toBe(10500) // Total increased due to stock appreciation
      
      // Verify asset breakdown
      expect(day3Snapshot.asset_breakdown).toHaveLength(1)
      expect(day3Snapshot.asset_breakdown[0]).toEqual({
        asset_id: 'stock-petr4',
        symbol: 'PETR4',
        asset_class: 'stock',
        quantity: 100,
        price: 35.00,
        value: 3500
      })
    })
  })
})
