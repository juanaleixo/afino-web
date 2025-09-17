import { supabase } from './supabase'

/**
 * BenchmarkService - Serviço para dados de benchmarks reais
 * 
 * Arquitetura de dados:
 * 1. Prioridade: Buscar dados reais da tabela `benchmark_data` do banco
 * 2. Fallback: APIs externas (BCB para CDI, Yahoo Finance para índices, CoinGecko para crypto)
 * 3. Fallback final: Dados simulados para desenvolvimento
 * 
 * Para usar dados reais em produção:
 * - Criar processo ETL para popular a tabela benchmark_data
 * - Ou garantir que as APIs externas estejam funcionando
 * - Ver database/tables/benchmark_data.sql para estrutura da tabela
 */

export interface BenchmarkData {
  date: string
  value: number
  symbol: string
}

export class BenchmarkService {
  // Obter dados de benchmark do CDI (dados reais do Banco Central)
  async getCDIData(from: string, to: string): Promise<BenchmarkData[]> {
    try {
      // Tentar primeiro buscar dados reais da tabela benchmark_data
      const { data: dbData, error: dbError } = await supabase
        .from('benchmark_data')
        .select('date, value')
        .eq('symbol', 'CDI')
        .gte('date', from)
        .lte('date', to)
        .order('date')

      if (!dbError && dbData && dbData.length > 0) {
        return dbData.map(item => ({
          date: item.date,
          value: item.value,
          symbol: 'CDI'
        }))
      }

      console.log('Dados CDI não encontrados no banco, buscando via Edge Function')
      
      // Usar Edge Function do Supabase com query parameters
      const { data: functionData, error: functionError } = await supabase.functions.invoke('benchmarks', {
        body: JSON.stringify({ benchmark: 'cdi', from, to }),
        method: 'POST'
      })
      
      console.log('Edge Function CDI response:', { functionData, functionError })
      
      if (!functionError && functionData) {
        console.log('Retornando dados CDI da Edge Function:', functionData.length, 'pontos')
        return functionData
      }

      console.warn('Edge Function indisponível, usando dados simulados para CDI')
      return this.getSimulatedCDI(from, to)
      
    } catch (error) {
      console.error('Erro ao carregar dados CDI:', error)
      return this.getSimulatedCDI(from, to)
    }
  }

  // Fallback de dados simulados para CDI
  private getSimulatedCDI(from: string, to: string): BenchmarkData[] {
    const fromDate = new Date(from)
    const toDate = new Date(to)
    const data: BenchmarkData[] = []
    
    const currentDate = new Date(fromDate)
    let cumulativeReturn = 0 // Começar com 0% de retorno
    const dailyRate = 0.105 / 365 // ~10.5% ao ano, dividido por dias úteis
    
    while (currentDate <= toDate) {
      // CDI é mais estável, crescimento linear aproximado
      cumulativeReturn += dailyRate
      data.push({
        date: currentDate.toISOString().split('T')[0]!,
        value: cumulativeReturn * 100, // Convertendo para porcentagem
        symbol: 'CDI'
      })
      
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return data
  }

  // Obter dados de benchmark do IBOVESPA 
  async getIBOVData(from: string, to: string): Promise<BenchmarkData[]> {
    try {
      // Tentar primeiro buscar dados reais da tabela benchmark_data
      const { data: dbData, error: dbError } = await supabase
        .from('benchmark_data')
        .select('date, value')
        .eq('symbol', 'IBOV')
        .gte('date', from)
        .lte('date', to)
        .order('date')

      if (!dbError && dbData && dbData.length > 0) {
        return dbData.map(item => ({
          date: item.date,
          value: item.value,
          symbol: 'IBOV'
        }))
      }

      console.log('Dados IBOVESPA não encontrados no banco, buscando via Edge Function')
      
      // Usar Edge Function do Supabase com query parameters
      const { data: functionData, error: functionError } = await supabase.functions.invoke('benchmarks', {
        body: JSON.stringify({ benchmark: 'ibov', from, to }),
        method: 'POST'
      })
      
      if (!functionError && functionData) {
        return functionData
      }

      console.warn('Edge Function indisponível, usando dados simulados para IBOVESPA')
      return this.getSimulatedIBOV(from, to)
      
    } catch (error) {
      console.error('Erro ao carregar dados IBOVESPA:', error)
      return this.getSimulatedIBOV(from, to)
    }
  }

  // Fallback de dados simulados para IBOVESPA
  private getSimulatedIBOV(from: string, to: string): BenchmarkData[] {
    const data: BenchmarkData[] = []
    const fromDate = new Date(from)
    const toDate = new Date(to)
    
    const currentDate = new Date(fromDate)
    let baseValue = 120000 // Valor aproximado do IBOV
    
    while (currentDate <= toDate) {
      // Volatilidade simulada do IBOV
      const randomChange = (Math.random() - 0.5) * 0.04 // ±2% diário max
      baseValue *= (1 + randomChange)
      
      data.push({
        date: currentDate.toISOString().split('T')[0]!,
        value: baseValue,
        symbol: 'IBOV'
      })
      
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return data
  }

  // Obter dados de benchmark do S&P 500
  async getSP500Data(from: string, to: string): Promise<BenchmarkData[]> {
    try {
      // Tentar primeiro buscar dados reais da tabela benchmark_data
      const { data: dbData, error: dbError } = await supabase
        .from('benchmark_data')
        .select('date, value')
        .eq('symbol', 'SPX')
        .gte('date', from)
        .lte('date', to)
        .order('date')

      if (!dbError && dbData && dbData.length > 0) {
        return dbData.map(item => ({
          date: item.date,
          value: item.value,
          symbol: 'SPX'
        }))
      }

      console.log('Dados S&P 500 não encontrados no banco, buscando via Edge Function')
      
      // Usar Edge Function do Supabase com query parameters
      const { data: functionData, error: functionError } = await supabase.functions.invoke('benchmarks', {
        body: JSON.stringify({ benchmark: 'sp500', from, to }),
        method: 'POST'
      })
      
      if (!functionError && functionData) {
        return functionData
      }

      console.warn('Edge Function indisponível, usando dados simulados para S&P 500')
      return this.getSimulatedSP500(from, to)
      
    } catch (error) {
      console.error('Erro ao carregar dados S&P 500:', error)
      return this.getSimulatedSP500(from, to)
    }
  }

  // Fallback de dados simulados para S&P 500
  private getSimulatedSP500(from: string, to: string): BenchmarkData[] {
    const data: BenchmarkData[] = []
    const fromDate = new Date(from)
    const toDate = new Date(to)
    
    const currentDate = new Date(fromDate)
    let baseValue = 4500 // Valor aproximado do S&P 500
    
    while (currentDate <= toDate) {
      // Volatilidade simulada do S&P 500
      const randomChange = (Math.random() - 0.5) * 0.03 // ±1.5% diário max
      baseValue *= (1 + randomChange)
      
      data.push({
        date: currentDate.toISOString().split('T')[0]!,
        value: baseValue,
        symbol: 'SPX'
      })
      
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return data
  }

  // Obter dados de benchmark do Bitcoin
  async getBitcoinData(from: string, to: string): Promise<BenchmarkData[]> {
    try {
      // Tentar primeiro buscar dados reais da tabela benchmark_data
      const { data: dbData, error: dbError } = await supabase
        .from('benchmark_data')
        .select('date, value')
        .eq('symbol', 'BTC')
        .gte('date', from)
        .lte('date', to)
        .order('date')

      if (!dbError && dbData && dbData.length > 0) {
        return dbData.map(item => ({
          date: item.date,
          value: item.value,
          symbol: 'BTC'
        }))
      }

      console.log('Dados Bitcoin não encontrados no banco, buscando via Edge Function')
      
      // Usar Edge Function do Supabase com query parameters
      const { data: functionData, error: functionError } = await supabase.functions.invoke('benchmarks', {
        body: JSON.stringify({ benchmark: 'bitcoin', from, to }),
        method: 'POST'
      })
      
      if (!functionError && functionData) {
        return functionData
      }

      console.warn('Edge Function indisponível, usando dados simulados para Bitcoin')
      return this.getSimulatedBitcoin(from, to)
      
    } catch (error) {
      console.error('Erro ao carregar dados Bitcoin:', error)
      return this.getSimulatedBitcoin(from, to)
    }
  }

  // Fallback de dados simulados para Bitcoin
  private getSimulatedBitcoin(from: string, to: string): BenchmarkData[] {
    const data: BenchmarkData[] = []
    const fromDate = new Date(from)
    const toDate = new Date(to)
    
    const currentDate = new Date(fromDate)
    let baseValue = 43000 // Valor aproximado do BTC em USD
    
    while (currentDate <= toDate) {
      // Volatilidade alta típica do Bitcoin
      const randomChange = (Math.random() - 0.5) * 0.08 // ±4% diário max
      baseValue *= (1 + randomChange)
      
      data.push({
        date: currentDate.toISOString().split('T')[0]!,
        value: baseValue,
        symbol: 'BTC'
      })
      
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    return data
  }

  // Método principal para obter qualquer benchmark
  async getBenchmarkData(benchmark: string, from: string, to: string): Promise<BenchmarkData[]> {
    switch (benchmark.toLowerCase()) {
      case 'cdi':
      case 'selic':
        return this.getCDIData(from, to)
      case 'ibov':
      case 'ibovespa':
        return this.getIBOVData(from, to)
      case 'sp500':
      case 's&p500':
        return this.getSP500Data(from, to)
      case 'bitcoin':
      case 'btc':
        return this.getBitcoinData(from, to)
      default:
        console.warn(`Benchmark '${benchmark}' não suportado`)
        return []
    }
  }

  // Calcular performance relativa vs benchmark
  calculateRelativePerformance(
    portfolioData: Array<{ date: string; total_value: number }>, 
    benchmarkData: BenchmarkData[]
  ): Array<{ date: string; portfolio_return: number; benchmark_return: number; relative_performance: number }> {
    if (!portfolioData.length || !benchmarkData.length) return []

    const results = []
    const portfolioStart = portfolioData[0]?.total_value
    const benchmarkStart = benchmarkData[0]?.value

    if (!portfolioStart || !benchmarkStart) return []

    for (let i = 0; i < portfolioData.length; i++) {
      const portfolioItem = portfolioData[i]
      if (!portfolioItem) continue
      
      const benchmarkItem = benchmarkData.find(b => b.date === portfolioItem.date)

      if (benchmarkItem) {
        const portfolioReturn = ((portfolioItem.total_value - portfolioStart) / portfolioStart) * 100
        const benchmarkReturn = ((benchmarkItem.value - benchmarkStart) / benchmarkStart) * 100
        const relativePerformance = portfolioReturn - benchmarkReturn

        results.push({
          date: portfolioItem.date,
          portfolio_return: portfolioReturn,
          benchmark_return: benchmarkReturn,
          relative_performance: relativePerformance
        })
      }
    }

    return results
  }
}

// Instância singleton do serviço
export const benchmarkService = new BenchmarkService()