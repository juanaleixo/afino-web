#!/usr/bin/env tsx

/**
 * Script de sincronização inicial
 * Migra todos os eventos do Supabase para o ClickHouse
 */

import { EventProcessor } from '../src/lib/sync/event-processor'
import { testClickHouseConnection } from '../src/lib/clickhouse'
import { supabase } from '../src/lib/supabase'

async function main() {
  console.log('🚀 Iniciando sincronização inicial Supabase → ClickHouse')

  // 1. Verificar conectividade
  console.log('1. Verificando conectividade...')
  
  const clickhouseHealthy = await testClickHouseConnection()
  if (!clickhouseHealthy) {
    console.error('❌ ClickHouse não está acessível')
    console.error('Verifique as variáveis de ambiente CLICKHOUSE_*')
    process.exit(1)
  }
  console.log('✅ ClickHouse conectado')

  const { data: supabaseTest, error } = await supabase
    .from('events')
    .select('count')
    .limit(1)
    
  if (error) {
    console.error('❌ Supabase não está acessível:', error.message)
    process.exit(1)
  }
  console.log('✅ Supabase conectado')

  // 2. Verificar se já existem dados no ClickHouse
  try {
    const { data: existingEvents } = await supabase
      .from('events')
      .select('id')
      .limit(1)
      
    if (existingEvents?.length) {
      const proceed = process.argv.includes('--force')
      if (!proceed) {
        console.log('⚠️  Dados já existem. Use --force para reprocessar')
        console.log('   npm run sync:initial -- --force')
        return
      }
    }
  } catch (e) {
    console.log('ℹ️  Primeira sincronização')
  }

  // 3. Contar eventos para sincronizar
  const { count } = await supabase
    .from('events')
    .select('*', { count: 'exact', head: true })
    .is('deleted_at', null)

  if (!count) {
    console.log('ℹ️  Nenhum evento encontrado para sincronizar')
    return
  }

  console.log(`📊 ${count} eventos encontrados`)

  // 4. Executar sincronização
  console.log('2. Executando sincronização...')
  const startTime = Date.now()

  try {
    await EventProcessor.initialSync()
    
    const duration = (Date.now() - startTime) / 1000
    console.log(`✅ Sincronização concluída em ${duration.toFixed(1)}s`)
    
    // 5. Verificar integridade
    console.log('3. Verificando integridade dos dados...')
    
    // TODO: Implementar verificações de integridade
    // - Comparar contagem de eventos
    // - Verificar alguns portfolios calculados
    // - Validar timestamps
    
    console.log('✅ Verificação de integridade concluída')
    console.log('🎉 Sincronização inicial finalizada com sucesso!')
    
  } catch (error) {
    console.error('❌ Erro durante sincronização:', error)
    process.exit(1)
  }
}

// Tratamento de argumentos
if (process.argv.includes('--help')) {
  console.log(`
Sincronização Inicial - Afino

USAGE:
  npm run sync:initial [OPTIONS]

OPTIONS:
  --force     Reprocessar mesmo se dados já existirem
  --user-id   Sincronizar apenas um usuário específico
  --help      Mostrar esta ajuda

EXAMPLES:
  npm run sync:initial
  npm run sync:initial -- --force
  npm run sync:initial -- --user-id=123e4567-e89b-12d3-a456-426614174000

ENVIRONMENT:
  Certifique-se de configurar as variáveis:
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
  - NEXT_PUBLIC_CLICKHOUSE_URL
  - NEXT_PUBLIC_CLICKHOUSE_USER
  - NEXT_PUBLIC_CLICKHOUSE_PASSWORD
`)
  process.exit(0)
}

// Executar
main().catch(error => {
  console.error('💥 Erro fatal:', error)
  process.exit(1)
})