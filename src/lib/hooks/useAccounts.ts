/**
 * Hook otimizado para contas que usa dados já carregados do userContext
 * Em vez de fazer queries separadas para accounts, usa os dados já disponíveis
 */

import { useUserContext } from './useUserContext'

export function useAccounts() {
  const { userContext, isLoading, error } = useUserContext()
  
  return {
    accounts: userContext.accounts || [],
    isLoading,
    error
  }
}

// Hook para compatibilidade com componentes que esperam o formato antigo
export function useAccountsLegacy() {
  const { accounts, isLoading, error } = useAccounts()
  
  return {
    data: accounts,
    isLoading,
    error,
    refetch: () => {} // No-op pois dados vêm do contexto
  }
}