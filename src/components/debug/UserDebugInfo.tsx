'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/lib/auth'
import { useUserContextFromProvider } from '@/contexts/UserContextProvider'
import { supabase } from '@/lib/supabase'

export function UserDebugInfo() {
  const { user } = useAuth()
  const { userContext } = useUserContextFromProvider()
  const isPremium = userContext.is_premium
  const plan = userContext.plan
  const [debugInfo, setDebugInfo] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const testAPI = async () => {
    setLoading(true)
    try {
      // Get the session to access the JWT token
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      
      const response = await fetch('/api/auth/user', {
        headers: {
          'Authorization': `Bearer ${token || 'no-token'}`
        }
      })
      const data = await response.json()
      setDebugInfo({ status: response.status, data })
    } catch (error) {
      setDebugInfo({ error: error instanceof Error ? error.message : 'Unknown error' })
    } finally {
      setLoading(false)
    }
  }


  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>🐛 Debug Info</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="font-semibold">Auth Context:</h3>
          <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
            {JSON.stringify({
              user: user ? {
                id: user.id,
                email: user.email,
                aud: user.aud,
                role: user.role
              } : null
            }, null, 2)}
          </pre>
        </div>

        <div>
          <h3 className="font-semibold">User Plan Context:</h3>
          <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
            {JSON.stringify({ isPremium, plan }, null, 2)}
          </pre>
        </div>

        <div className="space-x-2">
          <Button onClick={testAPI} disabled={loading}>
            {loading ? 'Testing...' : 'Test API Auth'}
          </Button>
        </div>

        {debugInfo && (
          <div>
            <h3 className="font-semibold">API Test Result:</h3>
            <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto">
              {JSON.stringify(debugInfo, null, 2)}
            </pre>
          </div>
        )}
      </CardContent>
    </Card>
  )
}