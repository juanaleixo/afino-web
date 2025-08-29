import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// ClickHouse Sync Edge Function
// Recebe webhooks do trigger PostgreSQL e sincroniza com ClickHouse

interface SyncPayload {
  table: string
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  record_id: string
  old_data?: any
  new_data?: any
}

interface ClickHouseConfig {
  url: string
  user: string
  password: string
  database: string
}

// Configuração do ClickHouse (via environment variables)
const getClickHouseConfig = (): ClickHouseConfig => {
  const config = {
    url: Deno.env.get('CLICKHOUSE_URL'),
    user: Deno.env.get('CLICKHOUSE_USER'), 
    password: Deno.env.get('CLICKHOUSE_PASSWORD'),
    database: Deno.env.get('CLICKHOUSE_DATABASE') || 'afino'
  }
  
  if (!config.url || !config.user || !config.password) {
    throw new Error('ClickHouse configuration missing')
  }
  
  return config as ClickHouseConfig
}

// Executar query no ClickHouse
const executeClickHouseQuery = async (query: string, params?: Record<string, any>) => {
  const config = getClickHouseConfig()
  
  const url = new URL('/?' + new URLSearchParams({
    query,
    database: config.database,
    ...(params && { params: JSON.stringify(params) })
  }), config.url)
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'X-ClickHouse-User': config.user,
      'X-ClickHouse-Key': config.password,
      'Content-Type': 'application/json'
    },
    body: params ? JSON.stringify(Object.values(params)) : undefined
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`ClickHouse error: ${error}`)
  }
  
  return await response.text()
}

// Sincronizar evento para ClickHouse
const syncEventToClickHouse = async (data: any, operation: string) => {
  if (operation === 'DELETE') {
    // Para deletar no ClickHouse, inserir evento reverso
    const reverseEvent = {
      user_id: data.user_id,
      event_id: `${data.id}-deleted`,
      asset_id: data.asset_id,
      account_id: data.account_id,
      timestamp: new Date().toISOString(),
      kind: data.kind,
      units_delta: -(data.units_delta || 0), // Reverter quantidade
      price_override: data.price_override,
      price_close: data.price_close,
      currency: data.currency || 'BRL',
      notes: `Deleted event ${data.id}`,
      source: 'api'
    }
    
    const query = `
      INSERT INTO events_stream (
        user_id, event_id, asset_id, account_id, timestamp, kind,
        units_delta, price_override, price_close, currency, notes, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    
    await executeClickHouseQuery(query, [
      reverseEvent.user_id,
      reverseEvent.event_id, 
      reverseEvent.asset_id,
      reverseEvent.account_id,
      reverseEvent.timestamp,
      reverseEvent.kind,
      reverseEvent.units_delta,
      reverseEvent.price_override,
      reverseEvent.price_close,
      reverseEvent.currency,
      reverseEvent.notes,
      reverseEvent.source
    ])
  } else {
    // INSERT ou UPDATE - inserir/atualizar evento
    const event = {
      user_id: data.user_id,
      event_id: data.id,
      asset_id: data.asset_id,
      account_id: data.account_id,
      timestamp: data.tstamp,
      kind: data.kind,
      units_delta: data.units_delta || 0,
      price_override: data.price_override,
      price_close: data.price_close,
      currency: data.currency || 'BRL',
      notes: data.notes,
      source: data.source || 'manual'
    }
    
    const query = `
      INSERT INTO events_stream (
        user_id, event_id, asset_id, account_id, timestamp, kind,
        units_delta, price_override, price_close, currency, notes, source
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    
    await executeClickHouseQuery(query, [
      event.user_id,
      event.event_id,
      event.asset_id, 
      event.account_id,
      event.timestamp,
      event.kind,
      event.units_delta,
      event.price_override,
      event.price_close,
      event.currency,
      event.notes,
      event.source
    ])
    
    // Se o evento tem preço, atualizar tabela de preços também
    if (event.price_override || event.price_close) {
      const price = event.price_override || event.price_close
      await syncPriceToClickHouse(event.asset_id, price, 'event', event.timestamp)
    }
  }
}

// Sincronizar asset metadata
const syncAssetToClickHouse = async (data: any, operation: string) => {
  if (operation === 'DELETE') {
    await executeClickHouseQuery(`
      ALTER TABLE assets_metadata DELETE WHERE asset_id = ?
    `, [data.id])
  } else {
    const query = `
      INSERT INTO assets_metadata (
        asset_id, symbol, name, class, currency, exchange, sector, external_id, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
    
    await executeClickHouseQuery(query, [
      data.id,
      data.symbol,
      data.label_ptbr || data.symbol,
      data.class || 'other',
      data.currency || 'BRL',
      data.meta?.exchange,
      data.meta?.sector, 
      data.external_account_id,
      JSON.stringify(data.meta || {})
    ])
  }
}

// Sincronizar preço para tabela de preços
const syncPriceToClickHouse = async (
  assetId: string, 
  price: number, 
  source: string, 
  timestamp: string
) => {
  const query = `
    INSERT INTO asset_prices (
      asset_id, source, price, currency, timestamp, confidence
    ) VALUES (?, ?, ?, ?, ?, ?)
  `
  
  await executeClickHouseQuery(query, [
    assetId,
    source,
    price,
    'BRL',
    timestamp,
    source === 'event' ? 1.0 : 0.9
  ])
}

// Main handler
serve(async (req) => {
  // Verificar método e autenticação
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }
  
  const authHeader = req.headers.get('Authorization')
  const expectedToken = Deno.env.get('SYNC_TOKEN')
  
  if (!authHeader || !expectedToken || authHeader !== `Bearer ${expectedToken}`) {
    return new Response('Unauthorized', { status: 401 })
  }
  
  try {
    const payload: SyncPayload = await req.json()
    
    console.log('Syncing to ClickHouse:', {
      table: payload.table,
      operation: payload.operation,
      record_id: payload.record_id
    })
    
    // Roteamento por tabela
    switch (payload.table) {
      case 'events':
        await syncEventToClickHouse(
          payload.new_data || payload.old_data, 
          payload.operation
        )
        break
        
      case 'global_assets':
        await syncAssetToClickHouse(
          payload.new_data || payload.old_data,
          payload.operation
        )
        break
        
      case 'accounts':
        // Sincronizar contas se necessário
        console.log('Account sync not implemented yet')
        break
        
      default:
        console.warn(`Unknown table for sync: ${payload.table}`)
    }
    
    return new Response(JSON.stringify({ 
      success: true,
      table: payload.table,
      operation: payload.operation,
      synced_at: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('ClickHouse sync failed:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})

/* 
DEPLOYMENT INSTRUCTIONS:

1. Deploy this edge function:
   supabase functions deploy clickhouse-sync

2. Set environment variables:
   supabase secrets set CLICKHOUSE_URL=https://your-clickhouse.cloud:8443
   supabase secrets set CLICKHOUSE_USER=your-user
   supabase secrets set CLICKHOUSE_PASSWORD=your-password  
   supabase secrets set CLICKHOUSE_DATABASE=afino
   supabase secrets set SYNC_TOKEN=your-random-secret-token

3. Configure in PostgreSQL:
   ALTER DATABASE postgres SET app.clickhouse_sync_url = 'https://your-project.supabase.co/functions/v1/clickhouse-sync';
   ALTER DATABASE postgres SET app.clickhouse_sync_token = 'your-random-secret-token';

4. Test the sync:
   INSERT INTO events (...) VALUES (...);
   -- Should appear in ClickHouse within seconds
*/