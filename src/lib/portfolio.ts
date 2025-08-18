import { supabase, PortfolioDaily, PortfolioMonthly, HoldingAt, HoldingAccount, UserProfile } from './supabase'

// Serviço para as funções RPC do portfólio
export class PortfolioService {
  private userId: string
  private userPlan: 'free' | 'premium' = 'free'

  constructor(userId: string) {
    this.userId = userId
  }

  // Inicializar o plano do usuário
  async initialize() {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('plan')
        .eq('user_id', this.userId)
        .single()

      if (error) {
        console.warn('Erro ao carregar plano do usuário, usando free como padrão:', error)
        this.userPlan = 'free'
      } else {
        this.userPlan = data?.plan || 'free'
      }
    } catch (error) {
      console.warn('Erro ao verificar plano do usuário, usando free como padrão:', error)
      this.userPlan = 'free'
    }
  }

  // Verificar se o usuário tem acesso premium
  private checkPremiumAccess(feature: string) {
    if (this.userPlan !== 'premium') {
      throw new Error(`Funcionalidade ${feature} requer plano premium`)
    }
  }

  // Série diária do patrimônio (premium)
  async getDailySeries(from: string, to: string): Promise<PortfolioDaily[]> {
    this.checkPremiumAccess('série diária')
    
    const { data, error } = await supabase.rpc('api_portfolio_daily', {
      p_from: from,
      p_to: to
    })

    if (error) {
      console.error('Erro ao carregar série diária:', error)
      throw new Error('Erro ao carregar dados diários do portfólio')
    }

    return data || []
  }

  // Série mensal do patrimônio (free/premium)
  async getMonthlySeries(from: string, to: string): Promise<PortfolioMonthly[]> {
    const { data, error } = await supabase.rpc('api_portfolio_monthly', {
      p_from: from,
      p_to: to
    })

    if (error) {
      console.error('Erro ao carregar série mensal:', error)
      throw new Error('Erro ao carregar dados mensais do portfólio')
    }

    return data || []
  }

  // Snapshot por ativo (free/premium)
  async getHoldingsAt(date: string): Promise<HoldingAt[]> {
    const { data, error } = await supabase.rpc('api_holdings_at', {
      p_date: date
    })

    if (error) {
      console.error('Erro ao carregar holdings:', error)
      throw new Error('Erro ao carregar posições do portfólio')
    }

    return data || []
  }

  // Snapshot por conta+ativo (premium)
  async getHoldingsAccounts(date: string): Promise<HoldingAccount[]> {
    this.checkPremiumAccess('detalhamento por conta')
    
    const { data, error } = await supabase.rpc('api_holdings_accounts', {
      p_date: date
    })

    if (error) {
      console.error('Erro ao carregar holdings por conta:', error)
      throw new Error('Erro ao carregar posições detalhadas do portfólio')
    }

    return data || []
  }

  // Obter dados do portfólio baseado no plano
  async getPortfolioData(dateRange: { from: string; to: string }, date: string) {
    await this.initialize()

    const [monthlySeries, holdingsAt] = await Promise.all([
      this.getMonthlySeries(dateRange.from, dateRange.to),
      this.getHoldingsAt(date)
    ])

    const result = {
      monthlySeries,
      holdingsAt,
      dailySeries: null as PortfolioDaily[] | null,
      holdingsAccounts: null as HoldingAccount[] | null
    }

    // Adicionar dados premium se disponível
    if (this.userPlan === 'premium') {
      try {
        const [dailySeries, holdingsAccounts] = await Promise.all([
          this.getDailySeries(dateRange.from, dateRange.to),
          this.getHoldingsAccounts(date)
        ])
        
        result.dailySeries = dailySeries
        result.holdingsAccounts = holdingsAccounts
      } catch (error) {
        console.warn('Erro ao carregar dados premium:', error)
      }
    }

    return result
  }

  // Obter estatísticas do portfólio
  async getPortfolioStats(date: string) {
    const holdings = await this.getHoldingsAt(date)
    
    const totalValue = holdings.reduce((sum, holding) => sum + holding.value, 0)
    const totalAssets = holdings.length
    
    return {
      totalValue,
      totalAssets,
      holdings
    }
  }
}

// Hook para usar o serviço de portfólio
export const usePortfolioService = (userId: string) => {
  const service = new PortfolioService(userId)
  
  return {
    service,
    getPortfolioData: (dateRange: { from: string; to: string }, date: string) => 
      service.getPortfolioData(dateRange, date),
    getPortfolioStats: (date: string) => service.getPortfolioStats(date),
    getDailySeries: (from: string, to: string) => service.getDailySeries(from, to),
    getMonthlySeries: (from: string, to: string) => service.getMonthlySeries(from, to),
    getHoldingsAt: (date: string) => service.getHoldingsAt(date),
    getHoldingsAccounts: (date: string) => service.getHoldingsAccounts(date)
  }
} 