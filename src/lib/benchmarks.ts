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

      console.warn('Dados CDI não encontrados no banco, usando API do Banco Central como fallback')
      
      // Fallback: API do Banco Central do Brasil (BCB)
      // Série 4389 = Taxa CDI
      const bcbUrl = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados?formato=json&dataInicial=${from.replace(/-/g, '/')}&dataFinal=${to.replace(/-/g, '/')}`
      
      const response = await fetch(bcbUrl)
      if (!response.ok) throw new Error('Erro na API do BCB')
      
      const bcbData = await response.json()
      
      if (Array.isArray(bcbData) && bcbData.length > 0) {
        let cumulativeReturn = 1.0
        return bcbData.map((item: any) => {
          const dailyRate = parseFloat(item.valor) / 100 / 252 // Taxa anual para diária
          cumulativeReturn *= (1 + dailyRate)
          return {
            date: item.data.split('/').reverse().join('-'), // DD/MM/YYYY para YYYY-MM-DD
            value: (cumulativeReturn - 1) * 100, // Retorno acumulado
            symbol: 'CDI'
          }
        })
      }

      // Fallback final: dados simulados
      console.warn('API do BCB indisponível, usando dados simulados para CDI')
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
    let cumulativeReturn = 1.0
    const dailyRate = 0.105 / 365 // ~10.5% ao ano
    
    while (currentDate <= toDate) {
      cumulativeReturn *= (1 + dailyRate)
      data.push({
        date: currentDate.toISOString().split('T')[0]!,
        value: (cumulativeReturn - 1) * 100,
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

      console.warn('Dados IBOVESPA não encontrados no banco, usando Yahoo Finance como fallback')
      
      // Fallback: Yahoo Finance API para IBOVESPA (^BVSP)
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/%5EBVSP?period1=${Math.floor(new Date(from).getTime() / 1000)}&period2=${Math.floor(new Date(to).getTime() / 1000)}&interval=1d`
      
      const response = await fetch(yahooUrl)
      if (!response.ok) throw new Error('Erro na API do Yahoo Finance')
      
      const yahooData = await response.json()
      const chartData = yahooData?.chart?.result?.[0]
      
      if (chartData?.timestamp && chartData?.indicators?.quote?.[0]?.close) {
        const timestamps = chartData.timestamp
        const closes = chartData.indicators.quote[0].close
        
        return timestamps.map((timestamp: number, index: number) => ({
          date: new Date(timestamp * 1000).toISOString().split('T')[0],
          value: closes[index] || 0,
          symbol: 'IBOV'
        })).filter((item: BenchmarkData) => item.value > 0)
      }

      // Fallback final: dados simulados
      console.warn('Yahoo Finance indisponível, usando dados simulados para IBOVESPA')
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

      console.warn('Dados S&P 500 não encontrados no banco, usando Yahoo Finance como fallback')
      
      // Fallback: Yahoo Finance API para S&P 500 (^GSPC)
      const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?period1=${Math.floor(new Date(from).getTime() / 1000)}&period2=${Math.floor(new Date(to).getTime() / 1000)}&interval=1d`
      
      const response = await fetch(yahooUrl)
      if (!response.ok) throw new Error('Erro na API do Yahoo Finance')
      
      const yahooData = await response.json()
      const chartData = yahooData?.chart?.result?.[0]
      
      if (chartData?.timestamp && chartData?.indicators?.quote?.[0]?.close) {
        const timestamps = chartData.timestamp
        const closes = chartData.indicators.quote[0].close
        
        return timestamps.map((timestamp: number, index: number) => ({
          date: new Date(timestamp * 1000).toISOString().split('T')[0],
          value: closes[index] || 0,
          symbol: 'SPX'
        })).filter((item: BenchmarkData) => item.value > 0)
      }

      // Fallback final: dados simulados
      console.warn('Yahoo Finance indisponível, usando dados simulados para S&P 500')
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

      console.warn('Dados Bitcoin não encontrados no banco, usando CoinGecko como fallback')
      
      // Fallback: CoinGecko API para Bitcoin
      const fromTimestamp = Math.floor(new Date(from).getTime() / 1000)
      const toTimestamp = Math.floor(new Date(to).getTime() / 1000)
      const geckoUrl = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from=${fromTimestamp}&to=${toTimestamp}`
      
      const response = await fetch(geckoUrl)
      if (!response.ok) throw new Error('Erro na API do CoinGecko')
      
      const geckoData = await response.json()
      
      if (geckoData?.prices && Array.isArray(geckoData.prices)) {
        return geckoData.prices.map((price: [number, number]) => ({
          date: new Date(price[0]).toISOString().split('T')[0],
          value: price[1],
          symbol: 'BTC'
        }))
      }

      // Fallback final: dados simulados
      console.warn('CoinGecko indisponível, usando dados simulados para Bitcoin')
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