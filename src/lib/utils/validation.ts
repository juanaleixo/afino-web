import { z } from 'zod'

/**
 * Data validation utilities for Afino Finance
 * Provides schema validation and type safety for critical data
 */

// Common validation schemas
export const schemas = {
  // Currency validation
  currency: z.enum(['BRL', 'USD', 'EUR', 'GBP', 'JPY']),
  
  // Date validation
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  
  // Positive number validation
  positiveNumber: z.number().positive('Value must be positive'),
  
  // Non-negative number validation
  nonNegativeNumber: z.number().nonnegative('Value cannot be negative'),
  
  // UUID validation
  uuid: z.string().uuid('Invalid UUID format'),
  
  // Event types
  eventKind: z.enum(['deposit', 'withdraw', 'buy', 'sell', 'dividend', 'balance', 'valuation']),
  
  // Asset classes
  assetClass: z.enum([
    'cash', 'stock', 'etf', 'fund', 'bond', 'crypto', 
    'commodity', 'reit', 'option', 'future', 'other'
  ]),
  
  // Plan types
  planType: z.enum(['free', 'premium', 'enterprise']),
}

// Event validation schema
export const eventSchema = z.object({
  id: schemas.uuid.optional(),
  kind: schemas.eventKind,
  tstamp: z.string().datetime(),
  asset_id: schemas.uuid,
  account_id: schemas.uuid,
  units_delta: z.number(),
  price_close: schemas.positiveNumber.optional(),
  notes: z.string().optional(),
})

// Account validation schema
export const accountSchema = z.object({
  id: schemas.uuid.optional(),
  label: z.string().min(1, 'Account name is required').max(100),
  currency: schemas.currency,
  is_active: z.boolean().default(true),
})

// Asset validation schema
export const assetSchema = z.object({
  id: schemas.uuid.optional(),
  symbol: z.string().min(1).max(20),
  class: schemas.assetClass,
  label: z.string().min(1).max(200),
  label_ptbr: z.string().min(1).max(200).optional(),
  currency: schemas.currency,
  manual_price: schemas.positiveNumber.optional().nullable(),
})

// Portfolio query validation
export const portfolioQuerySchema = z.object({
  from: schemas.date,
  to: schemas.date,
  account_id: schemas.uuid.optional(),
  asset_id: schemas.uuid.optional(),
})

// Validation helper functions
export function validateEvent(data: unknown) {
  return eventSchema.parse(data)
}

export function validateAccount(data: unknown) {
  return accountSchema.parse(data)
}

export function validateAsset(data: unknown) {
  return assetSchema.parse(data)
}

export function validatePortfolioQuery(data: unknown) {
  return portfolioQuerySchema.parse(data)
}

// Safe validation with error handling
export function safeValidate<T>(
  schema: z.ZodType<T>,
  data: unknown
): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data)
  if (result.success) {
    return { success: true, data: result.data }
  }
  return { success: false, errors: result.error }
}

// Type guards
export function isValidUUID(value: string): boolean {
  const result = schemas.uuid.safeParse(value)
  return result.success
}

export function isValidDate(value: string): boolean {
  const result = schemas.date.safeParse(value)
  return result.success
}

export function isValidCurrency(value: string): value is 'BRL' | 'USD' | 'EUR' | 'GBP' | 'JPY' {
  const result = schemas.currency.safeParse(value)
  return result.success
}

// Format validation errors for display
export function formatValidationErrors(error: z.ZodError): string[] {
  return error.issues.map(issue => {
    const path = issue.path.join('.')
    return path ? `${path}: ${issue.message}` : issue.message
  })
}

// Validate and transform dates
export function validateDateRange(from: string, to: string): { from: string; to: string } {
  const fromDate = new Date(from)
  const toDate = new Date(to)
  
  if (fromDate > toDate) {
    throw new Error('Start date must be before end date')
  }
  
  return {
    from: schemas.date.parse(from),
    to: schemas.date.parse(to)
  }
}

// Validate financial amounts
export function validateAmount(
  amount: number,
  options: { 
    allowNegative?: boolean
    maxDecimals?: number
    min?: number
    max?: number
  } = {}
): number {
  const { allowNegative = false, maxDecimals = 2, min, max } = options
  
  if (!allowNegative && amount < 0) {
    throw new Error('Amount cannot be negative')
  }
  
  if (min !== undefined && amount < min) {
    throw new Error(`Amount must be at least ${min}`)
  }
  
  if (max !== undefined && amount > max) {
    throw new Error(`Amount cannot exceed ${max}`)
  }
  
  // Check decimal places
  const decimalPlaces = (amount.toString().split('.')[1] || '').length
  if (decimalPlaces > maxDecimals) {
    throw new Error(`Amount cannot have more than ${maxDecimals} decimal places`)
  }
  
  return amount
}