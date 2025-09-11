'use client'

import { useEffect } from 'react'

interface StripePricingTableProps {
  pricingTableId?: string
  publishableKey?: string
  className?: string
}

export function StripePricingTable({ 
  pricingTableId = "prctbl_1S5cB6RoLfRNm058jPcuywiG",
  publishableKey = "pk_test_51S3lbrRoLfRNm058GELj6Gbum8spMJ4Nm3iQOoldhDrnnmthPNXdpeHymDbWvMsSZZOyQlSNycOqtEpXFASGGuvM00VcR0eY9B",
  className = ""
}: StripePricingTableProps) {
  useEffect(() => {
    // Check if script is already loaded
    if (document.querySelector('script[src="https://js.stripe.com/v3/pricing-table.js"]')) {
      return
    }

    // Create and load Stripe pricing table script
    const script = document.createElement('script')
    script.src = 'https://js.stripe.com/v3/pricing-table.js'
    script.async = true
    document.head.appendChild(script)

    return () => {
      // Cleanup script if component unmounts
      const existingScript = document.querySelector('script[src="https://js.stripe.com/v3/pricing-table.js"]')
      if (existingScript) {
        document.head.removeChild(existingScript)
      }
    }
  }, [])

  return (
    <div className={className}>
      <stripe-pricing-table 
        pricing-table-id={pricingTableId}
        publishable-key={publishableKey}
      />
    </div>
  )
}

// TypeScript declaration for the custom element
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      'stripe-pricing-table': {
        'pricing-table-id': string
        'publishable-key': string
      }
    }
  }
}