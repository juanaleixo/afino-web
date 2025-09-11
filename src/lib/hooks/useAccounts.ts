/**
 * Hook otimizado para contas que usa dados já carregados do userContext
 * Em vez de fazer queries separadas para accounts, usa os dados já disponíveis
 */

import { useUserContextFromProvider } from '@/contexts/UserContextProvider'

export function useAccounts() {
  const { userContext, isLoading, error } = useUserContextFromProvider()
  
  return {
    accounts: userContext.accounts || [],
    isLoading,
    error
  }
}

