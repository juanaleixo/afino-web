// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14.21.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
  apiVersion: '2025-08-27.basil',
  httpClient: Stripe.createFetchHttpClient(),
})

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Subscription status types
type SubscriptionStatus = 
  | 'active' 
  | 'canceled' 
  | 'incomplete' 
  | 'incomplete_expired' 
  | 'past_due' 
  | 'trialing' 
  | 'unpaid'

Deno.serve(async (req) => {
  // Security: Only allow POST requests
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const signature = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  // Security: Ensure signature header exists
  if (!signature) {
    console.error('Missing stripe-signature header')
    return new Response('Missing stripe-signature header', { status: 400 })
  }

  // Security: Validate required environment variables
  if (!webhookSecret) {
    console.error('STRIPE_WEBHOOK_SECRET not configured')
    return new Response('Webhook not properly configured', { status: 500 })
  }

  try {
    const body = await req.text()
    
    // Security: Verify webhook signature from Stripe
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
    console.log(`🎣 Webhook received: ${event.type}`)

    // Store webhook event for idempotency and debugging (if table exists)
    try {
      await storeWebhookEvent(event)
    } catch (error) {
      console.log('ℹ️ Webhook events table not available, continuing without storage')
    }

    // Process the event
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription)
        break
      
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break
      
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break
      
      default:
        console.log(`🤷 Unhandled event type: ${event.type}`)
    }

    // Mark webhook as processed (if table exists)
    try {
      await markWebhookAsProcessed(event.id)
    } catch (error) {
      console.log('ℹ️ Webhook events table not available for marking as processed')
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (err: any) {
    console.error('❌ Webhook error:', err.message || err)
    return new Response(`Webhook error: ${err.message || 'Unknown error'}`, { status: 400 })
  }
})

// Helper functions for idempotency and event storage
async function storeWebhookEvent(event: Stripe.Event) {
  try {
    await supabase
      .from('webhook_events')
      .insert({
        stripe_event_id: event.id,
        event_type: event.type,
        data: event.data,
        processed: false
      })
  } catch (error: any) {
    // If event already exists, that's okay (idempotency)
    if (!error.message?.includes('duplicate key')) {
      throw error
    }
  }
}

async function markWebhookAsProcessed(eventId: string) {
  await supabase
    .from('webhook_events')
    .update({ 
      processed: true,
      processed_at: new Date().toISOString()
    })
    .eq('stripe_event_id', eventId)
}

async function getUserIdFromCustomerId(customerId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (!error && data) {
    return data.user_id
  }

  console.log('User not found by customer ID, will try by email in webhook handler')
  return null
}

async function findOrCreateUserByEmail(email: string, customerId: string): Promise<string | null> {
  console.log(`🔍 Searching for user by email: ${email}`)
  
  try {
    // Search user by email using listUsers
    const { data: authUsers, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      console.error('❌ Error listing users:', authError)
      return null
    }
    
    const authUser = authUsers?.users?.find(user => user.email === email)
    
    if (authUser) {
      console.log(`✅ Found existing auth user: ${authUser.id}`)
      
      // Check if user profile exists
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', authUser.id)
        .maybeSingle() // Use maybeSingle instead of single to handle no rows gracefully

      console.log(`🔍 Profile check for user ${authUser.id}:`, { profile, profileError })

      if (profileError) {
        console.error('❌ Error checking user profile:', profileError)
        // Continue anyway, try to create profile
      }

      // Use upsert to handle both create and update cases atomically
      console.log(`🔄 Upserting user profile for: ${authUser.id}`)
      
      // Prepare user data from auth user with better fallbacks
      const userData = {
        email: authUser.email || null,
        full_name: authUser.user_metadata?.full_name || 
                  authUser.user_metadata?.name || 
                  authUser.user_metadata?.display_name ||
                  authUser.email?.split('@')[0] || // Use email prefix as fallback
                  null,
        avatar_url: authUser.user_metadata?.avatar_url || 
                    authUser.user_metadata?.picture || 
                    authUser.user_metadata?.profile_picture ||
                    null
      }
      
      console.log(`👤 Auth user data:`, userData)
      
      const { error: upsertProfileError } = await supabase
        .from('user_profiles')
        .upsert({
          user_id: authUser.id,
          stripe_customer_id: customerId,
          subscription_status: 'active',
          ...userData,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        })

      if (upsertProfileError) {
        console.error('❌ Error upserting profile for existing user:', upsertProfileError)
      } else {
        console.log(`✅ Profile upserted for user: ${authUser.id}`)
      }

      return authUser.id
    }

    // If no auth user found, create a new one
    console.log(`👤 Creating new user for email: ${email}`)
    const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
      email: email,
      email_confirm: true, // Auto-confirm email
      user_metadata: {
        created_via: 'stripe_webhook',
        stripe_customer_id: customerId
      }
    })

    if (createUserError || !newUser.user) {
      console.error('❌ Error creating new user:', createUserError)
      return null
    }

    console.log(`✅ Created new user: ${newUser.user.id}`)

    // Create user profile
    console.log(`📝 Creating user profile for new user: ${newUser.user.id}`)
    const { data: newProfile, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        user_id: newUser.user.id,
        stripe_customer_id: customerId,
        subscription_status: 'active',
        updated_at: new Date().toISOString()
      })
      .select()
      .single()

    if (profileError) {
      console.error('❌ Error creating profile for new user:', profileError)
      console.error('Profile error details:', JSON.stringify(profileError, null, 2))
    } else {
      console.log(`✅ Profile created for new user: ${newUser.user.id}`)
      console.log('Profile data:', newProfile)
    }

    return newUser.user.id

  } catch (error) {
    console.error('❌ Error in findOrCreateUserByEmail:', error)
    return null
  }
}

// Subscription service functions adapted for Edge Function
async function updateUserSubscription(userId: string, subscriptionData: {
  stripe_subscription_id: string
  stripe_customer_id: string
  status: SubscriptionStatus
  cancel_at_period_end?: boolean
  canceled_at?: string | number | null
  current_period_end?: string | number
}) {
  console.log(`💾 Updating user subscription: ${userId}`)
  
  // Check if subscription is canceled or will be canceled
  const isCanceled = subscriptionData.cancel_at_period_end || 
                    (subscriptionData.canceled_at && subscriptionData.canceled_at !== null)
  
  // Premium is active if status is active/trialing AND not canceled
  const isPremium = ['active', 'trialing'].includes(subscriptionData.status) && !isCanceled
  
  // If canceled but still active, set expiry to period end, otherwise immediate
  let premiumExpiresAt: string | null = null
  if (isCanceled) {
    if (subscriptionData.current_period_end) {
      const periodEnd = typeof subscriptionData.current_period_end === 'number' 
        ? subscriptionData.current_period_end * 1000 
        : new Date(subscriptionData.current_period_end).getTime()
      premiumExpiresAt = new Date(periodEnd).toISOString()
    } else {
      premiumExpiresAt = new Date().toISOString()
    }
  }
  
  console.log(`🔄 Subscription analysis:`)
  console.log(`   Status: ${subscriptionData.status}`)
  console.log(`   Cancel at period end: ${subscriptionData.cancel_at_period_end}`)
  console.log(`   Canceled at: ${subscriptionData.canceled_at}`)
  console.log(`   Is canceled: ${isCanceled}`)
  console.log(`   Is premium: ${isPremium}`)
  console.log(`   Expires at: ${premiumExpiresAt}`)
  
  // Get user data from auth.users to populate profile
  console.log(`📋 Fetching user data for: ${userId}`)
  const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(userId)
  
  if (authError) {
    console.error('❌ Error fetching auth user data:', authError)
  }
  
  // Extract user data with better fallbacks
  const userData = authUser?.user ? {
    email: authUser.user.email || null,
    full_name: authUser.user.user_metadata?.full_name || 
              authUser.user.user_metadata?.name || 
              authUser.user.user_metadata?.display_name ||
              authUser.user.email?.split('@')[0] || // Use email prefix as fallback
              null,
    avatar_url: authUser.user.user_metadata?.avatar_url || 
                authUser.user.user_metadata?.picture || 
                authUser.user.user_metadata?.profile_picture ||
                null
  } : {}
  
  console.log(`👤 User data extracted:`, userData)
  console.log(`💳 Premium status: ${isPremium ? 'active' : 'expired'}, expires_at: ${premiumExpiresAt}`)
  
  const { error } = await supabase
    .from('user_profiles')
    .upsert({
      user_id: userId,
      stripe_customer_id: subscriptionData.stripe_customer_id,
      stripe_subscription_id: subscriptionData.stripe_subscription_id,
      subscription_status: subscriptionData.status,
      premium_expires_at: premiumExpiresAt,
      ...userData,
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id'
    })

  if (error) {
    console.error('❌ Error updating user subscription:', error)
    throw error
  }

  console.log(`✅ User subscription updated: ${userId} - ${subscriptionData.status}`)
}

async function upsertSubscription(subscriptionData: {
  user_id: string
  stripe_subscription_id: string
  stripe_customer_id: string
  stripe_price_id: string
  stripe_product_id: string
  status: SubscriptionStatus
  current_period_start: string
  current_period_end: string
  trial_start?: string
  trial_end?: string
  cancel_at_period_end: boolean
  canceled_at?: string
}) {
  console.log(`💾 Processing subscription: ${subscriptionData.stripe_subscription_id}`)
  
  // Only update user profile since subscriptions table doesn't exist anymore
  await updateUserSubscription(subscriptionData.user_id, {
    stripe_subscription_id: subscriptionData.stripe_subscription_id,
    stripe_customer_id: subscriptionData.stripe_customer_id,
    status: subscriptionData.status,
    cancel_at_period_end: subscriptionData.cancel_at_period_end,
    canceled_at: subscriptionData.canceled_at,
    current_period_end: subscriptionData.current_period_end
  })

  console.log(`✅ Subscription processed: ${subscriptionData.stripe_subscription_id}`)
}


async function getEmailFromCustomer(customerId: string): Promise<string | null> {
  try {
    console.log(`🔍 Retrieving customer from Stripe: ${customerId}`)
    const customer = await stripe.customers.retrieve(customerId)
    
    console.log(`📊 Customer data:`, {
      id: customer.id,
      email: customer.email,
      deleted: customer.deleted,
      object: customer.object
    })
    
    if (customer && !customer.deleted && customer.email) {
      console.log(`✅ Found customer email: ${customer.email}`)
      return customer.email
    }
    
    console.log(`❌ Customer has no email or is deleted`)
    return null
  } catch (error) {
    console.error('❌ Error retrieving customer from Stripe:', error)
    console.error('❌ Error details:', JSON.stringify(error, null, 2))
    return null
  }
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  console.log(`💳 Processing subscription created: ${subscription.id}`)
  console.log(`📋 Subscription details:`, {
    id: subscription.id,
    customer: subscription.customer,
    status: subscription.status,
    metadata: subscription.metadata
  })
  
  let userId = await getUserIdFromCustomerId(subscription.customer as string)
  
  if (!userId) {
    console.log('🔍 User not found by customer ID, trying to find/create by email')
    
    // Try to get email from customer first
    let email = await getEmailFromCustomer(subscription.customer as string)
    
    // If customer is deleted or has no email, check subscription metadata
    if (!email && subscription.metadata?.email) {
      console.log(`📧 Found email in subscription metadata: ${subscription.metadata.email}`)
      email = subscription.metadata.email
    }
    
    if (email) {
      console.log(`📧 Using email: ${email}`)
      userId = await findOrCreateUserByEmail(email, subscription.customer as string)
    } else {
      console.error('❌ No email found in customer or subscription metadata')
      console.log('💡 Suggestion: Add customer email to subscription metadata in Stripe')
      return
    }
  }

  if (!userId) {
    console.error('❌ No user found in auth.users - canceling subscription')
    console.log('🚫 Subscription will be canceled because user is not registered in the system')
    
    try {
      // Cancel the subscription in Stripe
      await stripe.subscriptions.update(subscription.id, {
        cancel_at_period_end: true,
        metadata: {
          canceled_reason: 'user_not_found_in_auth',
          canceled_at: new Date().toISOString()
        }
      })
      
      console.log(`✅ Subscription marked for cancellation: ${subscription.id}`)
      console.log('📧 User must sign up first, then subscribe again')
      
    } catch (cancelError) {
      console.error('❌ Error canceling subscription:', cancelError)
    }
    
    // Throw error to indicate webhook processing failed
    throw new Error(`Subscription ${subscription.id} canceled: User not found in auth.users`)
  }

  const priceId = subscription.items.data[0]?.price.id
  if (!priceId) {
    console.error('❌ No price ID found in subscription')
    return
  }

  await updateUserSubscription(userId, {
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer as string,
    status: subscription.status as SubscriptionStatus,
    cancel_at_period_end: subscription.cancel_at_period_end,
    canceled_at: subscription.canceled_at,
    current_period_end: subscription.current_period_end
  })

  console.log(`✅ Subscription created for user ${userId}: ${subscription.id}`)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  console.log(`🔄 Processing subscription updated: ${subscription.id}`)
  
  let userId = await getUserIdFromCustomerId(subscription.customer as string)
  
  if (!userId) {
    console.log('🔍 User not found by customer ID, trying to find/create by email')
    
    // Try to get email from customer first
    let email = await getEmailFromCustomer(subscription.customer as string)
    
    // If customer is deleted or has no email, check subscription metadata
    if (!email && subscription.metadata?.email) {
      console.log(`📧 Found email in subscription metadata: ${subscription.metadata.email}`)
      email = subscription.metadata.email
    }
    
    if (email) {
      console.log(`📧 Using email: ${email}`)
      userId = await findOrCreateUserByEmail(email, subscription.customer as string)
    } else {
      console.error('❌ No email found in customer or subscription metadata')
      console.log('💡 Suggestion: Add customer email to subscription metadata in Stripe')
      return
    }
  }

  if (!userId) {
    console.error('❌ Could not find or create user')
    return
  }

  const priceId = subscription.items.data[0]?.price.id
  const productId = subscription.items.data[0]?.price.product as string
  if (!priceId) {
    console.error('❌ No price ID found in subscription')
    return
  }

  await upsertSubscription({
    user_id: userId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer as string,
    stripe_price_id: priceId,
    stripe_product_id: productId,
    status: subscription.status as SubscriptionStatus,
    current_period_start: subscription.current_period_start ? new Date(subscription.current_period_start * 1000).toISOString() : new Date().toISOString(),
    current_period_end: subscription.current_period_end ? new Date(subscription.current_period_end * 1000).toISOString() : new Date(Date.now() + 30*24*60*60*1000).toISOString(),
    ...(subscription.trial_start && {
      trial_start: new Date(subscription.trial_start * 1000).toISOString()
    }),
    ...(subscription.trial_end && {
      trial_end: new Date(subscription.trial_end * 1000).toISOString()
    }),
    cancel_at_period_end: subscription.cancel_at_period_end,
    ...(subscription.canceled_at && {
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : new Date().toISOString()
    }),
  })

  console.log(`✅ Subscription updated for user ${userId}: ${subscription.id}`)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = await getUserIdFromCustomerId(subscription.customer as string)
  if (!userId) return

  try {
    console.log(`🗑️ Processing subscription deletion for user: ${userId}`)
    
    // Update user profile to canceled status
    await updateUserSubscription(userId, {
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      status: 'canceled'
    })
    
    console.log(`✅ User profile updated to canceled status: ${userId}`)
    
  } catch (error) {
    console.error('❌ Error canceling subscription:', JSON.stringify(error, null, 2))
    console.error('❌ Error type:', typeof error)
    console.error('❌ Error constructor:', error?.constructor?.name)
    if (error instanceof Error) {
      console.error('❌ Error message:', error.message)
      console.error('❌ Error stack:', error.stack)
    }
  }

  console.log(`Subscription deleted for user ${userId}: ${subscription.id}`)
}

