import { supabase } from '../supabase'
import { clickhouse, type EventRecord } from '../clickhouse'
import { PriceEngine } from '../pricing/price-engine'
import { cache, CacheTags } from '../cache'

// Sistema de sincronização para eventos entre Supabase e ClickHouse
export class EventProcessor {
  private userId: string
  
  constructor(userId: string) {
    this.userId = userId
  }

  // Processar novo evento: salvar no Supabase e sincronizar com ClickHouse
  async processNewEvent(eventData: {
    asset_id: string
    account_id?: string
    kind: 'deposit' | 'withdraw' | 'buy' | 'sell' | 'position_add' | 'position_remove' | 'valuation' | 'dividend' | 'split'
    units_delta: number
    price_override?: number
    price_close?: number
    notes?: string
    tstamp?: string
  }) {
    const eventId = `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const timestamp = eventData.tstamp || new Date().toISOString()
    
    // 1. Salvar no Supabase (source of truth transacional)
    const { data, error } = await supabase
      .from('events')
      .insert({
        id: eventId,
        user_id: this.userId,
        ...eventData,
        tstamp: timestamp
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to save event to Supabase:', error)
      throw new Error('Erro ao salvar evento')
    }

    // 2. Sincronizar com ClickHouse de forma assíncrona
    try {
      await this.syncEventToClickHouse({
        user_id: this.userId,
        event_id: eventId,
        asset_id: eventData.asset_id,
        account_id: eventData.account_id,
        timestamp,
        kind: eventData.kind,
        units_delta: eventData.units_delta,
        price_override: eventData.price_override,
        price_close: eventData.price_close,
        notes: eventData.notes,
        source: 'manual'
      })
    } catch (syncError) {
      console.error('Failed to sync event to ClickHouse:', syncError)
      // Não falhar a operação, mas logar para retry posterior
      await this.queueForRetry(eventId, syncError as Error)
    }

    // 3. Invalidar caches relacionados
    this.invalidateUserCaches()
    
    return data
  }

  // Sincronizar evento individual para ClickHouse
  private async syncEventToClickHouse(eventRecord: EventRecord) {
    await clickhouse.insert('events_stream', [eventRecord])
    console.log(`Event ${eventRecord.event_id} synced to ClickHouse`)
  }

  // Processar batch de eventos (para imports e migrations)
  async processBatchEvents(events: Array<{
    asset_id: string
    account_id?: string
    kind: EventRecord['kind']
    units_delta: number
    price_override?: number
    price_close?: number
    notes?: string
    tstamp: string
  }>) {
    const eventRecords = events.map(event => ({
      id: `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      user_id: this.userId,
      ...event
    }))

    // 1. Batch insert no Supabase
    const { data, error } = await supabase
      .from('events')
      .insert(eventRecords)
      .select()

    if (error) {
      console.error('Failed to batch save events to Supabase:', error)
      throw new Error('Erro ao salvar eventos em lote')
    }

    // 2. Batch sync para ClickHouse
    const clickhouseRecords: EventRecord[] = (data || []).map(event => ({
      user_id: event.user_id,
      event_id: event.id,
      asset_id: event.asset_id,
      account_id: event.account_id,
      timestamp: event.tstamp,
      kind: event.kind,
      units_delta: event.units_delta || 0,
      price_override: event.price_override,
      price_close: event.price_close,
      notes: event.notes,
      source: 'import'
    }))

    try {
      await clickhouse.insert('events_stream', clickhouseRecords)
      console.log(`${clickhouseRecords.length} events synced to ClickHouse`)
    } catch (syncError) {
      console.error('Failed to batch sync events to ClickHouse:', syncError)
      // Queue individual events for retry
      for (const record of clickhouseRecords) {
        await this.queueForRetry(record.event_id, syncError as Error)
      }
    }

    // 3. Invalidar caches
    this.invalidateUserCaches()
    
    return data
  }

  // Atualizar preço de ativo (valuation event) + price engine
  async updateAssetValuation(assetId: string, newPrice: number, date?: string) {
    // 1. Criar evento de valuation
    const event = await this.processNewEvent({
      asset_id: assetId,
      kind: 'valuation',
      units_delta: 0, // Valuation não altera quantidade
      price_override: newPrice,
      tstamp: date || new Date().toISOString(),
      notes: `Price update: ${newPrice}`
    })

    // 2. Atualizar no price engine (para queries rápidas)
    try {
      await PriceEngine.updateAssetPrice(assetId, newPrice, 'manual', 1.0)
    } catch (error) {
      console.error('Failed to update price in price engine:', error)
      // Não falhar a operação principal
    }

    return event
  }

  // Remover evento (marcar como deleted no Supabase + remover do ClickHouse)
  async deleteEvent(eventId: string) {
    // 1. Soft delete no Supabase
    const { error } = await supabase
      .from('events')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', eventId)
      .eq('user_id', this.userId)

    if (error) {
      console.error('Failed to delete event from Supabase:', error)
      throw new Error('Erro ao remover evento')
    }

    // 2. Remover do ClickHouse (ClickHouse não suporta UPDATE facilmente)
    // Strategy: inserir evento "reverso" para cancelar o efeito
    try {
      const { data: originalEvent } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single()

      if (originalEvent && originalEvent.units_delta !== 0) {
        // Criar evento reverso
        await this.syncEventToClickHouse({
          user_id: this.userId,
          event_id: `${eventId}-reverse`,
          asset_id: originalEvent.asset_id,
          account_id: originalEvent.account_id,
          timestamp: new Date().toISOString(),
          kind: originalEvent.kind,
          units_delta: -originalEvent.units_delta, // Reverter quantidade
          price_override: originalEvent.price_override,
          price_close: originalEvent.price_close,
          notes: `Reversal of ${eventId}`,
          source: 'manual'
        })
      }
    } catch (error) {
      console.error('Failed to create reversal event in ClickHouse:', error)
    }

    // 3. Invalidar caches
    this.invalidateUserCaches()
  }

  // Invalidar caches do usuário
  private invalidateUserCaches() {
    cache.invalidateTags([
      CacheTags.PORTFOLIO(this.userId),
      CacheTags.HOLDINGS(this.userId),
      CacheTags.EVENTS(this.userId)
    ])
  }

  // Queue para retry em caso de falha de sync
  private async queueForRetry(eventId: string, error: Error) {
    // Em uma implementação real, isso iria para uma fila (Redis, SQS, etc.)
    // Por enquanto, apenas log para monitoramento
    console.error(`Queuing event ${eventId} for retry due to:`, error.message)
    
    // Armazenar na tabela de sync_queue para processamento posterior
    try {
      await supabase
        .from('sync_queue')
        .insert({
          table_name: 'events',
          record_id: eventId,
          operation: 'sync_to_clickhouse',
          error_message: error.message,
          retry_count: 0,
          created_at: new Date().toISOString()
        })
    } catch (queueError) {
      console.error('Failed to queue event for retry:', queueError)
    }
  }

  // Processar fila de retry (executar periodicamente)
  static async processRetryQueue() {
    const { data: retryItems, error } = await supabase
      .from('sync_queue')
      .select('*')
      .eq('operation', 'sync_to_clickhouse')
      .lt('retry_count', 3) // Máximo 3 tentativas
      .order('created_at')
      .limit(50)

    if (error || !retryItems?.length) return

    for (const item of retryItems) {
      try {
        // Buscar evento original
        const { data: event } = await supabase
          .from('events')
          .select('*')
          .eq('id', item.record_id)
          .single()

        if (!event) continue

        // Tentar sync novamente
        const eventRecord: EventRecord = {
          user_id: event.user_id,
          event_id: event.id,
          asset_id: event.asset_id,
          account_id: event.account_id,
          timestamp: event.tstamp,
          kind: event.kind,
          units_delta: event.units_delta || 0,
          price_override: event.price_override,
          price_close: event.price_close,
          notes: event.notes,
          source: 'retry'
        }

        await clickhouse.insert('events_stream', [eventRecord])
        
        // Remover da fila após sucesso
        await supabase
          .from('sync_queue')
          .delete()
          .eq('id', item.id)

        console.log(`Retry successful for event ${item.record_id}`)
        
      } catch (retryError) {
        // Incrementar contador de retry
        await supabase
          .from('sync_queue')
          .update({ 
            retry_count: item.retry_count + 1,
            last_retry_at: new Date().toISOString(),
            error_message: (retryError as Error).message
          })
          .eq('id', item.id)

        console.error(`Retry failed for event ${item.record_id}:`, retryError)
      }
    }
  }

  // Migração inicial: sync todos os eventos existentes para ClickHouse
  static async initialSync(userId?: string) {
    console.log('Starting initial sync from Supabase to ClickHouse...')
    
    let query = supabase
      .from('events')
      .select('*')
      .is('deleted_at', null)
      .order('tstamp')

    if (userId) {
      query = query.eq('user_id', userId)
    }

    const { data: events, error } = await query

    if (error) {
      console.error('Failed to fetch events for initial sync:', error)
      throw new Error('Erro na sincronização inicial')
    }

    if (!events?.length) {
      console.log('No events to sync')
      return
    }

    // Batch sync em chunks de 1000
    const chunkSize = 1000
    for (let i = 0; i < events.length; i += chunkSize) {
      const chunk = events.slice(i, i + chunkSize)
      const clickhouseRecords: EventRecord[] = chunk.map(event => ({
        user_id: event.user_id,
        event_id: event.id,
        asset_id: event.asset_id,
        account_id: event.account_id,
        timestamp: event.tstamp,
        kind: event.kind,
        units_delta: event.units_delta || 0,
        price_override: event.price_override,
        price_close: event.price_close,
        notes: event.notes,
        source: 'migration'
      }))

      try {
        await clickhouse.insert('events_stream', clickhouseRecords)
        console.log(`Synced chunk ${Math.floor(i / chunkSize) + 1}/${Math.ceil(events.length / chunkSize)} (${clickhouseRecords.length} events)`)
      } catch (chunkError) {
        console.error(`Failed to sync chunk starting at index ${i}:`, chunkError)
        throw chunkError
      }
    }

    console.log(`Initial sync completed: ${events.length} events synced to ClickHouse`)
  }
}

// Função utilitária para criar processor
export function createEventProcessor(userId: string): EventProcessor {
  return new EventProcessor(userId)
}

// Background job para processar retry queue (executar a cada 5 minutos)
if (typeof window === 'undefined') { // Server-side only
  const RETRY_INTERVAL = 5 * 60 * 1000 // 5 minutos
  
  setInterval(() => {
    EventProcessor.processRetryQueue().catch(error => {
      console.error('Error processing retry queue:', error)
    })
  }, RETRY_INTERVAL)
}