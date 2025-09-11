"use client"

import { createContext, useContext, ReactNode } from 'react'
import { useUserContext } from '@/lib/hooks/useUserContext'
import type { UserContext } from '@/lib/hooks/useUserContext'

interface UserContextProviderType {
  userContext: UserContext
  isLoading: boolean
  error: string | null
  refresh: () => void
}

const UserContextContext = createContext<UserContextProviderType | undefined>(undefined)

interface UserContextProviderProps {
  children: ReactNode
}

export function UserContextProvider({ children }: UserContextProviderProps) {
  const contextData = useUserContext()

  return (
    <UserContextContext.Provider value={contextData}>
      {children}
    </UserContextContext.Provider>
  )
}

export function useUserContextFromProvider(): UserContextProviderType {
  const context = useContext(UserContextContext)
  if (context === undefined) {
    throw new Error('useUserContextFromProvider must be used within a UserContextProvider')
  }
  return context
}