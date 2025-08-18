import { supabase } from './supabase'

export interface WaitlistEntry {
  id: string
  email: string
  name?: string
  source: string
  created_at: string
  updated_at: string
}

export class WaitlistService {
  // Adicionar email à waitlist
  static async addToWaitlist(email: string, name?: string, source: string = 'preview'): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from('waitlist')
        .insert({
          email: email.toLowerCase().trim(),
          name: name?.trim(),
          source
        })

      if (error) {
        if (error.code === '23505') { // Unique constraint violation
          return { success: false, error: 'Este email já está na nossa lista de espera!' }
        }
        return { success: false, error: 'Erro ao adicionar email. Tente novamente.' }
      }

      return { success: true }
    } catch (error) {
      console.error('Erro ao adicionar à waitlist:', error)
      return { success: false, error: 'Erro interno. Tente novamente.' }
    }
  }

  // Obter estatísticas da waitlist (apenas para usuários autenticados)
  static async getWaitlistStats(): Promise<{ total: number; recent: number; error?: string }> {
    try {
      const { data, error } = await supabase
        .from('waitlist')
        .select('created_at')

      if (error) {
        return { total: 0, recent: 0, error: 'Erro ao carregar estatísticas' }
      }

      const total = data?.length || 0
      const oneWeekAgo = new Date()
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
      
      const recent = data?.filter(entry => 
        new Date(entry.created_at) > oneWeekAgo
      ).length || 0

      return { total, recent }
    } catch (error) {
      console.error('Erro ao obter estatísticas da waitlist:', error)
      return { total: 0, recent: 0, error: 'Erro interno' }
    }
  }

  // Validar formato de email
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }
}
