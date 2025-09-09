import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { subscriptionService } from '@/lib/services/subscription-service'
import { STRIPE_WEBHOOK_EVENTS } from '@/lib/stripe'
import { supabaseAdmin, validateAdminClient } from '@/lib/supabase-admin'

export const dynamic = 'force-dynamic'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil'
})

export async function POST(request: NextRequest) {
  // Security: Validate admin client configuration
  try {
    validateAdminClient()
  } catch (error) {
    console.error('Admin client validation failed:', error)
    return NextResponse.json(
      { error: 'Server configuration error' },
      { status: 500 }
    )
  }

  // Security: Only allow POST requests
  if (request.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
  }

  const body = await request.text()
  const signature = request.headers.get('stripe-signature')

  // Security: Ensure signature header exists
  if (!signature) {
    console.error('Missing stripe-signature header')
    return NextResponse.json(
      { error: 'Missing stripe-signature header' },
      { status: 400 }
    )
  }

  // Security: Validate required environment variables
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET not configured')
    return NextResponse.json(
      { error: 'Webhook not properly configured' },
      { status: 500 }
    )
  }

  let event: Stripe.Event

  try {
    // Security: Verify webhook signature from Stripe
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    )
  } catch (err) {
    console.error('Webhook signature verification failed:', err instanceof Error ? err.message : 'Unknown error')
    return NextResponse.json(
      { error: 'Webhook signature verification failed' },
      { status: 400 }
    )
  }

  try {
    // Store webhook event for idempotency and debugging
    await storeWebhookEvent(event)

    // Process the event
    switch (event.type) {
      case STRIPE_WEBHOOK_EVENTS.CUSTOMER_SUBSCRIPTION_CREATED:
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription)
        break

      case STRIPE_WEBHOOK_EVENTS.CUSTOMER_SUBSCRIPTION_UPDATED:
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case STRIPE_WEBHOOK_EVENTS.CUSTOMER_SUBSCRIPTION_DELETED:
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case STRIPE_WEBHOOK_EVENTS.INVOICE_PAYMENT_SUCCEEDED:
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice)
        break

      case STRIPE_WEBHOOK_EVENTS.INVOICE_PAYMENT_FAILED:
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    // Mark webhook as processed
    await markWebhookAsProcessed(event.id)

    return NextResponse.json({ received: true })

  } catch (error) {
    console.error('Error processing webhook')
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function storeWebhookEvent(event: Stripe.Event) {
  try {
    await supabaseAdmin
      .from('pay.webhook_events')
      .insert({
        stripe_event_id: event.id,
        event_type: event.type,
        data: event.data,
        processed: false
      })
  } catch (error) {
    // If event already exists, that's okay (idempotency)
    if (!(error instanceof Error) || !error.message?.includes('duplicate key')) {
      throw error
    }
  }
}

async function markWebhookAsProcessed(eventId: string) {
  await supabaseAdmin
    .from('pay.webhook_events')
    .update({ 
      processed: true,
      processed_at: new Date().toISOString()
    })
    .eq('stripe_event_id', eventId)
}

async function getUserIdFromCustomerId(customerId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('user_profiles')
    .select('user_id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (error || !data) {
    console.error('Error finding user by Stripe customer ID')
    return null
  }

  return data.user_id
}

async function handleSubscriptionCreated(subscription: Stripe.Subscription) {
  const userId = await getUserIdFromCustomerId(subscription.customer as string)
  if (!userId) return

  const priceId = subscription.items.data[0]?.price.id
  const productId = subscription.items.data[0]?.price.product as string
  if (!priceId) return

  await subscriptionService.upsertSubscription({
    user_id: userId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer as string,
    stripe_price_id: priceId,
    stripe_product_id: productId,
    status: subscription.status as any,
    current_period_start: new Date((subscription as any).current_period_start * 1000).toISOString(),
    current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
    ...(subscription.trial_start && {
      trial_start: new Date(subscription.trial_start * 1000).toISOString()
    }),
    ...(subscription.trial_end && {
      trial_end: new Date(subscription.trial_end * 1000).toISOString()
    }),
    cancel_at_period_end: subscription.cancel_at_period_end,
  })

  console.log(`Subscription created for user ${userId}: ${subscription.id}`)
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const userId = await getUserIdFromCustomerId(subscription.customer as string)
  if (!userId) return

  const priceId = subscription.items.data[0]?.price.id
  const productId = subscription.items.data[0]?.price.product as string
  if (!priceId) return

  await subscriptionService.upsertSubscription({
    user_id: userId,
    stripe_subscription_id: subscription.id,
    stripe_customer_id: subscription.customer as string,
    stripe_price_id: priceId,
    stripe_product_id: productId,
    status: subscription.status as any,
    current_period_start: new Date((subscription as any).current_period_start * 1000).toISOString(),
    current_period_end: new Date((subscription as any).current_period_end * 1000).toISOString(),
    ...(subscription.trial_start && {
      trial_start: new Date(subscription.trial_start * 1000).toISOString()
    }),
    ...(subscription.trial_end && {
      trial_end: new Date(subscription.trial_end * 1000).toISOString()
    }),
    cancel_at_period_end: subscription.cancel_at_period_end,
    ...(subscription.canceled_at && {
      canceled_at: new Date(subscription.canceled_at * 1000).toISOString()
    }),
  })

  console.log(`Subscription updated for user ${userId}: ${subscription.id}`)
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const userId = await getUserIdFromCustomerId(subscription.customer as string)
  if (!userId) return

  await subscriptionService.cancelSubscription(userId)

  console.log(`Subscription deleted for user ${userId}: ${subscription.id}`)
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  const userId = await getUserIdFromCustomerId(invoice.customer as string)
  if (!userId) return

  // Update subscription status to active if it was past_due
  const subscriptionId = (invoice as any).subscription
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId as string)
    await handleSubscriptionUpdated(subscription)
  }

  console.log(`Invoice payment succeeded for user ${userId}: ${invoice.id}`)
}

async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const userId = await getUserIdFromCustomerId(invoice.customer as string)
  if (!userId) return

  // Update subscription status based on the current subscription state
  const subscriptionId = (invoice as any).subscription
  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId as string)
    await handleSubscriptionUpdated(subscription)
  }

  console.log(`Invoice payment failed for user ${userId}: ${invoice.id}`)
}