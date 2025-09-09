import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { subscriptionService } from '@/lib/services/subscription-service'
import { SUBSCRIPTION_PLANS } from '@/lib/stripe'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil'
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const { priceId, userId, successUrl, cancelUrl } = await request.json()

    if (!priceId || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Get user info from auth.users for email
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId)
    if (authError || !authUser.user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Check if user already is premium (has user_profile)
    const isPremium = await subscriptionService.isPremiumUser(userId)
    if (isPremium) {
      return NextResponse.json(
        { error: 'User already has premium access' },
        { status: 400 }
      )
    }

    // Create Stripe customer (we'll store customer_id in user_profiles when subscription is created)
    const customer = await stripe.customers.create({
      email: authUser.user.email || '',
      metadata: { userId }
    })

    // Validate price ID
    const plan = Object.values(SUBSCRIPTION_PLANS).find(p => p.priceId === priceId)
    if (!plan) {
      return NextResponse.json(
        { error: 'Invalid price ID' },
        { status: 400 }
      )
    }

    // Create checkout session
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/subscription?success=true`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/pricing?canceled=true`,
      metadata: {
        userId: userId,
        priceId: priceId,
      },
      subscription_data: {
        metadata: {
          userId: userId,
        },
      },
    }

    // Add trial period if applicable
    if (plan.trialDays) {
      sessionParams.subscription_data = {
        ...sessionParams.subscription_data,
        trial_period_days: plan.trialDays,
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams)

    return NextResponse.json({
      sessionId: session.id,
      url: session.url
    })

  } catch (error) {
    console.error('Error creating checkout session')
    
    return NextResponse.json(
      { 
        error: 'Internal server error'
      },
      { status: 500 }
    )
  }
}