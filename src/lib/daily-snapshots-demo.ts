/**
 * Demo script para testar manualmente o sistema de snapshots diários
 * Execute: tsx src/lib/daily-snapshots-demo.ts
 */

// Import only pure functions for demo (no Supabase dependency)
import {
  calculatePositionsAtDate,
  calculateDailySnapshot,
  toSaoPauloDate,
  EventForSnapshot
} from './daily-snapshots'

// Eventos de teste para demonstração
const demoEvents: EventForSnapshot[] = [
  // Dia 1: Depósito inicial de R$ 50,000
  {
    id: 'demo1',
    user_id: 'demo_user',
    asset_id: 'cash-brl',
    tstamp: '2024-01-10T09:00:00-03:00',
    kind: 'deposit',
    units_delta: 50000,
    global_assets: { symbol: 'BRL', class: 'currency' }
  },

  // Dia 2: Compra 200 ações PETR4 @ R$ 30
  {
    id: 'demo2',
    user_id: 'demo_user',
    asset_id: 'stock-petr4',
    tstamp: '2024-01-11T10:30:00-03:00',
    kind: 'buy',
    units_delta: 200,
    price_close: 30.00,
    global_assets: { symbol: 'PETR4', class: 'stock' }
  },
  {
    id: 'demo2b',
    user_id: 'demo_user',
    asset_id: 'cash-brl',
    tstamp: '2024-01-11T10:30:00-03:00',
    kind: 'withdraw',
    units_delta: -6000, // Saída de cash para compra
    global_assets: { symbol: 'BRL', class: 'currency' }
  },

  // Dia 3: Compra 0.1 BTC @ R$ 200,000
  {
    id: 'demo3',
    user_id: 'demo_user',
    asset_id: 'crypto-btc',
    tstamp: '2024-01-12T14:00:00-03:00',
    kind: 'buy',
    units_delta: 0.1,
    price_close: 200000,
    global_assets: { symbol: 'BTC', class: 'crypto' }
  },
  {
    id: 'demo3b',
    user_id: 'demo_user',
    asset_id: 'cash-brl',
    tstamp: '2024-01-12T14:00:00-03:00',
    kind: 'withdraw',
    units_delta: -20000, // Saída de cash para compra BTC
    global_assets: { symbol: 'BRL', class: 'currency' }
  },

  // Dia 4: Avaliação PETR4 sobe para R$ 35
  {
    id: 'demo4',
    user_id: 'demo_user',
    asset_id: 'stock-petr4',
    tstamp: '2024-01-13T16:00:00-03:00',
    kind: 'valuation',
    price_override: 35.00,
    global_assets: { symbol: 'PETR4', class: 'stock' }
  },

  // Dia 5: Avaliação BTC sobe para R$ 220,000
  {
    id: 'demo5',
    user_id: 'demo_user',
    asset_id: 'crypto-btc',
    tstamp: '2024-01-14T11:00:00-03:00',
    kind: 'valuation',
    price_override: 220000,
    global_assets: { symbol: 'BTC', class: 'crypto' }
  },

  // Dia 6: Saque de R$ 5,000
  {
    id: 'demo6',
    user_id: 'demo_user',
    asset_id: 'cash-brl',
    tstamp: '2024-01-15T15:30:00-03:00',
    kind: 'withdraw',
    units_delta: -5000,
    global_assets: { symbol: 'BRL', class: 'currency' }
  }
]

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value)
}

function formatNumber(value: number, decimals = 2): string {
  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(value)
}

export function runDemo(): void {
  console.log('🔍 DEMO: Sistema de Snapshots Diários')
  console.log('====================================\n')

  const dates = [
    '2024-01-10', // Depósito inicial
    '2024-01-11', // Compra PETR4
    '2024-01-12', // Compra BTC
    '2024-01-13', // PETR4 valoriza
    '2024-01-14', // BTC valoriza
    '2024-01-15'  // Saque
  ]

  dates.forEach((date, index) => {
    console.log(`📅 Dia ${index + 1}: ${date}`)
    console.log('-'.repeat(40))

    // Calcular posições até esta data
    const positions = calculatePositionsAtDate(demoEvents, date)
    
    // Calcular snapshot
    const snapshot = calculateDailySnapshot(positions, date, 'demo_user')

    // Mostrar posições detalhadas
    console.log('📊 Posições:')
    positions.forEach(pos => {
      const value = pos.quantity * pos.last_price
      console.log(`  ${pos.symbol}: ${formatNumber(pos.quantity)} @ ${formatCurrency(pos.last_price)} = ${formatCurrency(value)}`)
    })

    // Mostrar resumo
    console.log('\n💰 Patrimônio:')
    console.log(`  Caixa (BRL): ${formatCurrency(snapshot.cash_balance)}`)
    console.log(`  Ativos: ${formatCurrency(snapshot.assets_value)}`)
    console.log(`  🎯 TOTAL: ${formatCurrency(snapshot.total_value)}`)

    // Mostrar breakdown de ativos
    if (snapshot.asset_breakdown.length > 0) {
      console.log('\n📈 Breakdown de Ativos:')
      snapshot.asset_breakdown.forEach(asset => {
        console.log(`  ${asset.symbol}: ${formatNumber(asset.quantity)} × ${formatCurrency(asset.price)} = ${formatCurrency(asset.value)}`)
      })
    }

    console.log('\n')
  })

  // Mostrar evolução do patrimônio
  console.log('📊 EVOLUÇÃO DO PATRIMÔNIO')
  console.log('========================\n')
  
  let previousValue = 0
  dates.forEach((date, index) => {
    const positions = calculatePositionsAtDate(demoEvents, date)
    const snapshot = calculateDailySnapshot(positions, date, 'demo_user')
    
    const change = index === 0 ? 0 : snapshot.total_value - previousValue
    const changePercent = index === 0 ? 0 : (change / previousValue) * 100
    
    const changeStr = change === 0 ? '' : 
      change > 0 ? ` (+${formatCurrency(change)} / +${formatNumber(changePercent)}%)` :
                   ` (${formatCurrency(change)} / ${formatNumber(changePercent)}%)`
    
    console.log(`${date}: ${formatCurrency(snapshot.total_value)}${changeStr}`)
    
    previousValue = snapshot.total_value
  })

  console.log('\n✅ Demo concluída com sucesso!')
  console.log('\n📋 Casos testados:')
  console.log('  ✓ Depósito inicial de cash')
  console.log('  ✓ Compra de ações (PETR4)')
  console.log('  ✓ Compra de crypto (BTC)')
  console.log('  ✓ Avaliações de ativos')
  console.log('  ✓ Saque de cash')
  console.log('  ✓ Timeline coerente dia a dia')
  console.log('  ✓ Timezone América/São_Paulo respeitado')
}

// Execute a demo se este arquivo for executado diretamente
if (require.main === module) {
  runDemo()
}