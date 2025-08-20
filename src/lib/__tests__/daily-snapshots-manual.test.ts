/**
 * Teste manual integrado com cenários reais de uso
 */

import {
  calculatePositionsAtDate,
  calculateDailySnapshot,
  EventForSnapshot
} from '../daily-snapshots'

describe('Manual Integration Tests', () => {
  test('should handle demo scenario: deposit + evaluations over different dates', () => {
    console.log('\n🔍 TESTE MANUAL: Depósito + Avaliações')
    console.log('=====================================')

    // Cenário: 1 depósito e 2 avaliações em datas diferentes
    const events: EventForSnapshot[] = [
      // Depósito inicial R$ 10,000 em 15/01/2024
      {
        id: 'manual1',
        user_id: 'test_user',
        asset_id: 'cash-brl',
        tstamp: '2024-01-15T10:00:00-03:00',
        kind: 'deposit',
        units_delta: 10000,
        global_assets: { symbol: 'BRL', class: 'currency' }
      },
      
      // Primeira avaliação de um ativo fictício em 16/01/2024
      {
        id: 'manual2',
        user_id: 'test_user',
        asset_id: 'stock-test',
        tstamp: '2024-01-16T14:00:00-03:00',
        kind: 'valuation',
        price_override: 50.00,
        global_assets: { symbol: 'TEST', class: 'stock' }
      },

      // Assumindo que já havia 100 unidades do ativo (compra anterior simulada)
      {
        id: 'manual2b',
        user_id: 'test_user',
        asset_id: 'stock-test',
        tstamp: '2024-01-10T09:00:00-03:00', // Data anterior
        kind: 'buy',
        units_delta: 100,
        price_close: 45.00,
        global_assets: { symbol: 'TEST', class: 'stock' }
      },
      {
        id: 'manual2c',
        user_id: 'test_user',
        asset_id: 'cash-brl',
        tstamp: '2024-01-10T09:00:00-03:00', // Data anterior
        kind: 'withdraw',
        units_delta: -4500, // Cash usado na compra
        global_assets: { symbol: 'BRL', class: 'currency' }
      },

      // Segunda avaliação do mesmo ativo em 17/01/2024
      {
        id: 'manual3',
        user_id: 'test_user',
        asset_id: 'stock-test',
        tstamp: '2024-01-17T16:30:00-03:00',
        kind: 'valuation',
        price_override: 55.00,
        global_assets: { symbol: 'TEST', class: 'stock' }
      }
    ]

    const formatCurrency = (value: number) => 
      new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

    // Ordenar eventos por timestamp para debugging
    events.sort((a, b) => new Date(a.tstamp).getTime() - new Date(b.tstamp).getTime())
    console.log('\n🔧 Debug: Eventos ordenados:')
    events.forEach(e => {
      console.log(`  ${e.tstamp} | ${e.kind} | ${e.global_assets?.symbol} | ${e.units_delta || e.price_override || 'N/A'}`)
    })

    const testDates = ['2024-01-10', '2024-01-15', '2024-01-16', '2024-01-17']
    
    console.log('\n📊 Timeline diária:')
    console.log('==================')

    const results = testDates.map(date => {
      const positions = calculatePositionsAtDate(events, date)
      const snapshot = calculateDailySnapshot(positions, date, 'test_user')
      
      console.log(`\n📅 ${date}:`)
      console.log(`  Caixa: ${formatCurrency(snapshot.cash_balance)}`)
      console.log(`  Ativos: ${formatCurrency(snapshot.assets_value)}`)
      console.log(`  🎯 Total: ${formatCurrency(snapshot.total_value)}`)
      
      if (snapshot.asset_breakdown.length > 0) {
        console.log(`  Detalhes:`)
        snapshot.asset_breakdown.forEach(asset => {
          console.log(`    ${asset.symbol}: ${asset.quantity} × ${formatCurrency(asset.price)} = ${formatCurrency(asset.value)}`)
        })
      }

      return snapshot
    })

    // Verificações de coerência
    console.log('\n✅ Verificações:')
    
    // Dia 1: Apenas compra inicial de ativo (sem depósito ainda)
    expect(results[0].cash_balance).toBe(-4500) // 0 - 4500 da compra (cash negativo)
    expect(results[0].assets_value).toBe(4500) // 100 × 45.00
    expect(results[0].total_value).toBe(0) // -4500 + 4500 = 0
    console.log('  ✓ Dia 1: Compra inicial correta')

    // Dia 2: Depósito adicionado
    expect(results[1].cash_balance).toBe(5500) // -4500 + 10000 depósito = 5500
    expect(results[1].assets_value).toBe(4500) // Ativo mantém preço
    expect(results[1].total_value).toBe(10000) // 5500 + 4500 = 10000
    console.log('  ✓ Dia 2: Depósito processado corretamente')

    // Dia 3: Primeira avaliação
    expect(results[2].cash_balance).toBe(5500) // Cash inalterado
    expect(results[2].assets_value).toBe(5000) // 100 × 50.00
    expect(results[2].total_value).toBe(10500) // 5500 + 5000 = 10500
    console.log('  ✓ Dia 3: Primeira avaliação aplicada')

    // Dia 4: Segunda avaliação
    expect(results[3].cash_balance).toBe(5500) // Cash inalterado
    expect(results[3].assets_value).toBe(5500) // 100 × 55.00
    expect(results[3].total_value).toBe(11000) // 5500 + 5500 = 11000
    console.log('  ✓ Dia 4: Segunda avaliação aplicada')

    // Verificar evolução lógica
    expect(results[1].total_value).toBeGreaterThan(results[0].total_value) // Depósito aumentou
    expect(results[2].total_value).toBeGreaterThan(results[1].total_value) // Avaliação positiva
    expect(results[3].total_value).toBeGreaterThan(results[2].total_value) // Segunda avaliação positiva
    console.log('  ✓ Evolução do patrimônio é coerente e crescente')

    console.log('\n🎉 Teste manual concluído com sucesso!')
    console.log('    Cenário: 1 depósito + 2 avaliações em datas diferentes')
    console.log('    Timeline diária coerente ✓')
    console.log('    Timezone respeitado ✓')
  })

  test('should handle complex scenario with multiple asset types', () => {
    const events: EventForSnapshot[] = [
      // Cash inicial
      {
        id: 'complex1',
        user_id: 'complex_user',
        asset_id: 'cash-brl',
        tstamp: '2024-02-01T09:00:00-03:00',
        kind: 'deposit',
        units_delta: 30000,
        global_assets: { symbol: 'BRL', class: 'currency' }
      },
      
      // Compra ações
      {
        id: 'complex2a',
        user_id: 'complex_user',
        asset_id: 'stock-vale3',
        tstamp: '2024-02-02T10:00:00-03:00',
        kind: 'buy',
        units_delta: 100,
        price_close: 80.00,
        global_assets: { symbol: 'VALE3', class: 'stock' }
      },
      {
        id: 'complex2b',
        user_id: 'complex_user',
        asset_id: 'cash-brl',
        tstamp: '2024-02-02T10:00:00-03:00',
        kind: 'withdraw',
        units_delta: -8000,
        global_assets: { symbol: 'BRL', class: 'currency' }
      },

      // Compra crypto
      {
        id: 'complex3a',
        user_id: 'complex_user',
        asset_id: 'crypto-eth',
        tstamp: '2024-02-03T15:00:00-03:00',
        kind: 'buy',
        units_delta: 5,
        price_close: 2000.00,
        global_assets: { symbol: 'ETH', class: 'crypto' }
      },
      {
        id: 'complex3b',
        user_id: 'complex_user',
        asset_id: 'cash-brl',
        tstamp: '2024-02-03T15:00:00-03:00',
        kind: 'withdraw',
        units_delta: -10000,
        global_assets: { symbol: 'BRL', class: 'currency' }
      },

      // Avaliação de ambos os ativos no mesmo dia
      {
        id: 'complex4a',
        user_id: 'complex_user',
        asset_id: 'stock-vale3',
        tstamp: '2024-02-04T16:00:00-03:00',
        kind: 'valuation',
        price_override: 85.00,
        global_assets: { symbol: 'VALE3', class: 'stock' }
      },
      {
        id: 'complex4b',
        user_id: 'complex_user',
        asset_id: 'crypto-eth',
        tstamp: '2024-02-04T16:30:00-03:00',
        kind: 'valuation',
        price_override: 2200.00,
        global_assets: { symbol: 'ETH', class: 'crypto' }
      }
    ]

    const finalSnapshot = calculateDailySnapshot(
      calculatePositionsAtDate(events, '2024-02-04'),
      '2024-02-04',
      'complex_user'
    )

    // Verificações
    expect(finalSnapshot.cash_balance).toBe(12000) // 30000 - 8000 - 10000
    expect(finalSnapshot.asset_breakdown).toHaveLength(2)
    
    const valeAsset = finalSnapshot.asset_breakdown.find(a => a.symbol === 'VALE3')
    const ethAsset = finalSnapshot.asset_breakdown.find(a => a.symbol === 'ETH')
    
    expect(valeAsset?.value).toBe(8500) // 100 × 85.00
    expect(ethAsset?.value).toBe(11000) // 5 × 2200.00
    expect(finalSnapshot.total_value).toBe(31500) // 12000 + 8500 + 11000

    console.log('\n✅ Cenário complexo verificado:')
    console.log(`   Cash: R$ 12.000`)
    console.log(`   VALE3: R$ 8.500 (100 × R$ 85)`)
    console.log(`   ETH: R$ 11.000 (5 × R$ 2.200)`)
    console.log(`   🎯 Total: R$ 31.500`)
  })
})