import { createClient } from '@supabase/supabase-js'

/**
 * Supabase admin client with service role key
 * ONLY use for server-side operations that require bypassing RLS
 * NEVER expose this client to client-side code
 */
export const supabaseAdmin = (() => {
  if (typeof window !== 'undefined') {
    // Return a dummy client that throws when used
    return new Proxy({}, {
      get() {
        throw new Error('Admin client should not be used on client-side')
      }
    }) as any
  }
  
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
})()

/**
 * Validates that the admin client is properly configured
 * Should be called on server startup or in API routes that need admin access
 */
export function validateAdminClient(): void {
  if (typeof window !== 'undefined') {
    throw new Error('Admin client should not be used on client-side')
  }
  
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY.trim() === '') {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for admin operations')
  }
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL.trim() === '') {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required')
  }
}