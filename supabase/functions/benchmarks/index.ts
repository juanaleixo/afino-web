import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BenchmarkData {
  date: string
  value: number
  symbol: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let benchmark, from, to

    if (req.method === 'GET') {
      const url = new URL(req.url)
      benchmark = url.searchParams.get('benchmark')
      from = url.searchParams.get('from')
      to = url.searchParams.get('to')
    } else if (req.method === 'POST') {
      const body = await req.json()
      benchmark = body.benchmark
      from = body.from
      to = body.to
    } else {
      return new Response(
        JSON.stringify({ error: 'Método não suportado' }),
        { 
          status: 405, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    if (!benchmark || !from || !to) {
      return new Response(
        JSON.stringify({ error: 'Parâmetros benchmark, from e to são obrigatórios' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    let data: BenchmarkData[]

    // First try to get data from database
    const { data: dbData, error: dbError } = await supabase
      .from('benchmark_data')
      .select('date, value')
      .eq('symbol', benchmark.toUpperCase())
      .gte('date', from)
      .lte('date', to)
      .order('date')

    if (!dbError && dbData && dbData.length > 0) {
      data = dbData.map(item => ({
        date: item.date,
        value: item.value,
        symbol: benchmark.toUpperCase()
      }))
    } else {
      // Fetch from external APIs if not in database
      switch (benchmark.toLowerCase()) {
        case 'cdi':
          data = await getCDIData(from, to)
          break
        case 'ibov':
        case 'ibovespa':
          data = await getIBOVData(from, to)
          break
        case 'sp500':
          data = await getSP500Data(from, to)
          break
        case 'bitcoin':
        case 'btc':
          data = await getBitcoinData(from, to)
          break
        default:
          return new Response(
            JSON.stringify({ error: `Benchmark '${benchmark}' não suportado` }),
            { 
              status: 400, 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            }
          )
      }
    }

    return new Response(
      JSON.stringify(data),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Erro ao buscar dados de benchmark:', error)
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function getCDIData(from: string, to: string): Promise<BenchmarkData[]> {
  try {
    // API do Banco Central - Série 4389 (Taxa CDI)
    const bcbUrl = `https://api.bcb.gov.br/dados/serie/bcdata.sgs.4389/dados?formato=json&dataInicial=${from.replace(/-/g, '/')}&dataFinal=${to.replace(/-/g, '/')}`
    
    const response = await fetch(bcbUrl, {
      headers: {
        'User-Agent': 'Afino-Portfolio-App/1.0'
      }
    })

    if (!response.ok) {
      throw new Error('Erro na API do BCB')
    }

    const bcbData = await response.json()
    
    if (Array.isArray(bcbData) && bcbData.length > 0) {
      let cumulativeReturn = 0
      return bcbData.map((item: any) => {
        const dailyRate = parseFloat(item.valor) / 100 / 252 // Taxa anual para diária
        cumulativeReturn += dailyRate
        return {
          date: item.data.split('/').reverse().join('-'), // DD/MM/YYYY para YYYY-MM-DD
          value: cumulativeReturn * 100, // Retorno acumulado em %
          symbol: 'CDI'
        }
      })
    }

    throw new Error('Dados CDI inválidos')
  } catch (error) {
    console.error('Erro ao buscar CDI:', error)
    return getSimulatedCDI(from, to)
  }
}

async function getIBOVData(from: string, to: string): Promise<BenchmarkData[]> {
  try {
    // Yahoo Finance API para IBOVESPA (^BVSP)
    const fromTimestamp = Math.floor(new Date(from).getTime() / 1000)
    const toTimestamp = Math.floor(new Date(to).getTime() / 1000)
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/%5EBVSP?period1=${fromTimestamp}&period2=${toTimestamp}&interval=1d`
    
    const response = await fetch(yahooUrl, {
      headers: {
        'User-Agent': 'Afino-Portfolio-App/1.0'
      }
    })

    if (!response.ok) {
      throw new Error('Erro na API do Yahoo Finance')
    }

    const yahooData = await response.json()
    const chartData = yahooData?.chart?.result?.[0]
    
    if (chartData?.timestamp && chartData?.indicators?.quote?.[0]?.close) {
      const timestamps = chartData.timestamp
      const closes = chartData.indicators.quote[0].close
      const baseValue = closes[0] || 120000
      
      return timestamps.map((timestamp: number, index: number) => {
        const value = closes[index] || baseValue
        const returnPercent = ((value - baseValue) / baseValue) * 100
        return {
          date: new Date(timestamp * 1000).toISOString().split('T')[0],
          value: returnPercent,
          symbol: 'IBOV'
        }
      }).filter((item: any) => item.date)
    }

    throw new Error('Dados IBOV inválidos')
  } catch (error) {
    console.error('Erro ao buscar IBOV:', error)
    return getSimulatedIBOV(from, to)
  }
}

async function getSP500Data(from: string, to: string): Promise<BenchmarkData[]> {
  try {
    // Yahoo Finance API para S&P 500 (^GSPC)
    const fromTimestamp = Math.floor(new Date(from).getTime() / 1000)
    const toTimestamp = Math.floor(new Date(to).getTime() / 1000)
    const yahooUrl = `https://query1.finance.yahoo.com/v8/finance/chart/%5EGSPC?period1=${fromTimestamp}&period2=${toTimestamp}&interval=1d`
    
    const response = await fetch(yahooUrl, {
      headers: {
        'User-Agent': 'Afino-Portfolio-App/1.0'
      }
    })

    if (!response.ok) {
      throw new Error('Erro na API do Yahoo Finance')
    }

    const yahooData = await response.json()
    const chartData = yahooData?.chart?.result?.[0]
    
    if (chartData?.timestamp && chartData?.indicators?.quote?.[0]?.close) {
      const timestamps = chartData.timestamp
      const closes = chartData.indicators.quote[0].close
      const baseValue = closes[0] || 4500
      
      return timestamps.map((timestamp: number, index: number) => {
        const value = closes[index] || baseValue
        const returnPercent = ((value - baseValue) / baseValue) * 100
        return {
          date: new Date(timestamp * 1000).toISOString().split('T')[0],
          value: returnPercent,
          symbol: 'SPX'
        }
      }).filter((item: any) => item.date)
    }

    throw new Error('Dados S&P 500 inválidos')
  } catch (error) {
    console.error('Erro ao buscar S&P 500:', error)
    return getSimulatedSP500(from, to)
  }
}

async function getBitcoinData(from: string, to: string): Promise<BenchmarkData[]> {
  try {
    // CoinGecko API para Bitcoin
    const fromTimestamp = Math.floor(new Date(from).getTime() / 1000)
    const toTimestamp = Math.floor(new Date(to).getTime() / 1000)
    const geckoUrl = `https://api.coingecko.com/api/v3/coins/bitcoin/market_chart/range?vs_currency=usd&from=${fromTimestamp}&to=${toTimestamp}`
    
    const response = await fetch(geckoUrl, {
      headers: {
        'User-Agent': 'Afino-Portfolio-App/1.0'
      }
    })

    if (!response.ok) {
      throw new Error('Erro na API do CoinGecko')
    }

    const geckoData = await response.json()
    
    if (geckoData?.prices && Array.isArray(geckoData.prices)) {
      const baseValue = geckoData.prices[0]?.[1] || 43000
      
      return geckoData.prices.map((price: [number, number]) => {
        const returnPercent = ((price[1] - baseValue) / baseValue) * 100
        return {
          date: new Date(price[0]).toISOString().split('T')[0],
          value: returnPercent,
          symbol: 'BTC'
        }
      })
    }

    throw new Error('Dados Bitcoin inválidos')
  } catch (error) {
    console.error('Erro ao buscar Bitcoin:', error)
    return getSimulatedBitcoin(from, to)
  }
}

// Funções de fallback com dados simulados
function getSimulatedCDI(from: string, to: string): BenchmarkData[] {
  const data: BenchmarkData[] = []
  const fromDate = new Date(from)
  const toDate = new Date(to)
  const currentDate = new Date(fromDate)
  let cumulativeReturn = 0
  const dailyRate = 0.105 / 365 // ~10.5% ao ano
  
  while (currentDate <= toDate) {
    cumulativeReturn += dailyRate
    data.push({
      date: currentDate.toISOString().split('T')[0],
      value: cumulativeReturn * 100,
      symbol: 'CDI'
    })
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  return data
}

function getSimulatedIBOV(from: string, to: string): BenchmarkData[] {
  const data: BenchmarkData[] = []
  const fromDate = new Date(from)
  const toDate = new Date(to)
  const currentDate = new Date(fromDate)
  let cumulativeReturn = 0
  
  while (currentDate <= toDate) {
    const randomChange = (Math.random() - 0.5) * 0.04 // ±2% diário
    cumulativeReturn += randomChange
    data.push({
      date: currentDate.toISOString().split('T')[0],
      value: cumulativeReturn * 100,
      symbol: 'IBOV'
    })
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  return data
}

function getSimulatedSP500(from: string, to: string): BenchmarkData[] {
  const data: BenchmarkData[] = []
  const fromDate = new Date(from)
  const toDate = new Date(to)
  const currentDate = new Date(fromDate)
  let cumulativeReturn = 0
  
  while (currentDate <= toDate) {
    const randomChange = (Math.random() - 0.5) * 0.03 // ±1.5% diário
    cumulativeReturn += randomChange
    data.push({
      date: currentDate.toISOString().split('T')[0],
      value: cumulativeReturn * 100,
      symbol: 'SPX'
    })
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  return data
}

function getSimulatedBitcoin(from: string, to: string): BenchmarkData[] {
  const data: BenchmarkData[] = []
  const fromDate = new Date(from)
  const toDate = new Date(to)
  const currentDate = new Date(fromDate)
  let cumulativeReturn = 0
  
  while (currentDate <= toDate) {
    const randomChange = (Math.random() - 0.5) * 0.08 // ±4% diário
    cumulativeReturn += randomChange
    data.push({
      date: currentDate.toISOString().split('T')[0],
      value: cumulativeReturn * 100,
      symbol: 'BTC'
    })
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  return data
}