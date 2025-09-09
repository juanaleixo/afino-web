import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { SUBSCRIPTION_PLANS, type PlanType } from '@/lib/stripe'

export interface Subscription {
  id: string
  user_id: string
  stripe_subscription_id?: string
  stripe_customer_id?: string
  stripe_price_id?: string
  stripe_product_id?: string
  status: SubscriptionStatus
  current_period_start?: string
  current_period_end?: string
  trial_start?: string
  trial_end?: string
  cancel_at_period_end?: boolean
  canceled_at?: string
  created_at: string
  updated_at: string
}

export type SubscriptionStatus = 
  | 'active' 
  | 'canceled' 
  | 'incomplete' 
  | 'incomplete_expired' 
  | 'past_due' 
  | 'trialing' 
  | 'unpaid'


class SubscriptionService {
  /**
   * Get user's current subscription
   * LOGIC: No user_profile = free user, Has user_profile = premium user
   */
  async getUserSubscription(userId: string): Promise<Subscription | null> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('premium_expires_at, stripe_customer_id, stripe_subscription_id, subscription_status')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching user subscription:', error)
        return null
      }

      // No profile = free user (no subscription)
      if (!data) {
        return null
      }

      // Has profile = premium user, return subscription data
      return {
        id: data.stripe_subscription_id,
        user_id: userId,
        stripe_subscription_id: data.stripe_subscription_id,
        stripe_customer_id: data.stripe_customer_id,
        status: data.subscription_status,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      } as Subscription
    } catch (error) {
      console.error('Error fetching user subscription:', error)
      return null
    }
  }

  /**
   * Check if user has premium access
   * LOGIC: No user_profile = free, Has user_profile = check expiration
   */
  async isPremiumUser(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('premium_expires_at')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        console.error('Error checking premium status:', error)
        return false
      }

      // No profile = free user
      if (!data) {
        return false
      }

      // Has profile = premium user, check if expired
      if (data.premium_expires_at) {
        return new Date(data.premium_expires_at) > new Date()
      }

      // No expiration = lifetime premium
      return true
    } catch (error) {
      console.error('Error checking premium status:', error)
      return false
    }
  }

  /**
   * User profiles are only created for premium users
   * Free users don't need profiles in this system
   */

  /**
   * Create or update subscription from Stripe data
   * Uses admin client only when called from server-side (webhooks)
   */
  async upsertSubscription(subscriptionData: {
    user_id: string
    stripe_subscription_id: string
    stripe_customer_id?: string
    stripe_price_id: string
    stripe_product_id?: string
    status: SubscriptionStatus
    current_period_start: string
    current_period_end: string
    trial_start?: string
    trial_end?: string
    cancel_at_period_end?: boolean
    canceled_at?: string
  }): Promise<Subscription> {
    try {
      const { data, error } = await supabaseAdmin
        .from('pay.subscriptions')
        .upsert(
          {
            ...subscriptionData,
            updated_at: new Date().toISOString()
          },
          { 
            onConflict: 'stripe_subscription_id',
            ignoreDuplicates: false 
          }
        )
        .select()
        .single()

      if (error) throw error

      // Also update user profile premium status
      await this.updateUserPremiumStatus(subscriptionData.user_id, subscriptionData.status)

      return data
    } catch (error) {
      console.error('Error upserting subscription')
      throw error
    }
  }

  /**
   * Cancel subscription
   * Uses admin client only when called from server-side (webhooks)
   */
  async cancelSubscription(userId: string): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('pay.subscriptions')
        .update({ 
          status: 'canceled',
          canceled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .in('status', ['active', 'trialing', 'past_due'])

      if (error) throw error

      // Update user profile premium status
      await this.updateUserPremiumStatus(userId, 'canceled')

      return true
    } catch (error) {
      console.error('Error canceling subscription')
      return false
    }
  }



  /**
   * Get user's Stripe customer ID
   * LOGIC: Only premium users (with profiles) have Stripe customers
   */
  async getUserStripeCustomerId(userId: string): Promise<string | null> {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('stripe_customer_id')
        .eq('user_id', userId)
        .maybeSingle()

      if (error) {
        console.error('Error fetching user Stripe customer ID:', error)
        return null
      }

      // No profile = free user (no Stripe customer)
      if (!data) {
        return null
      }

      return data.stripe_customer_id
    } catch (error) {
      console.error('Error fetching user Stripe customer ID:', error)
      return null
    }
  }

  /**
   * Update user premium status based on subscription status
   * Uses admin client to bypass RLS for webhook operations
   */
  private async updateUserPremiumStatus(userId: string, status: SubscriptionStatus): Promise<void> {
    try {
      const isPremium = ['active', 'trialing'].includes(status)
      const premiumExpiresAt = isPremium ? null : new Date().toISOString()

      await supabaseAdmin
        .from('user_profiles')
        .upsert({
          user_id: userId,
          is_premium: isPremium,
          premium_expires_at: premiumExpiresAt,
          plan: isPremium ? 'premium' : 'free',
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id',
          ignoreDuplicates: false
        })
    } catch (error) {
      console.error('Error updating user premium status:', error)
      // Don't throw error here to avoid breaking webhook processing
    }
  }
}

// Export singleton instance
export const subscriptionService = new SubscriptionService()