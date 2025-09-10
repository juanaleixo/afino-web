import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Getting current user info')
    
    // Get Authorization header
    const authHeader = request.headers.get('Authorization')
    console.log('📝 Auth header present:', !!authHeader)
    
    if (!authHeader) {
      return NextResponse.json({ error: 'No authorization header' }, { status: 401 })
    }
    
    // Extract the JWT token
    const token = authHeader.replace('Bearer ', '')
    console.log('🎫 Token present:', !!token)
    
    // Verify the JWT token
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error) {
      console.error('❌ Error verifying token:', error)
      return NextResponse.json({ error: 'Invalid token', details: error.message }, { status: 401 })
    }
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    console.log('✅ User verified:', { id: user.id, email: user.email })
    
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at
      }
    })
    
  } catch (error) {
    console.error('💥 Unexpected error:', error)
    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}