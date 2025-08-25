/**
 * Currency and number formatting utilities for pt-BR locale
 */

/**
 * Parse decimal input accepting both pt-BR (comma) and en-US (dot) formats
 * @param value - Input string value
 * @returns Parsed number
 */
export function parseDecimalInput(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return 0
  }

  if (typeof value === 'number') {
    return value
  }

  // Clean and normalize the input
  const cleaned = value.trim()
  
  // Detect format: if has comma after dot, it's pt-BR format (1.234,56)
  const hasDotBeforeComma = cleaned.lastIndexOf('.') < cleaned.lastIndexOf(',')
  
  let normalized: string
  if (hasDotBeforeComma) {
    // pt-BR format: remove dots (thousand separator) and replace comma with dot
    normalized = cleaned.replace(/\./g, '').replace(',', '.')
  } else {
    // en-US format or no thousand separator
    normalized = cleaned.replace(/,/g, '')
  }

  const parsed = parseFloat(normalized)
  return isNaN(parsed) ? 0 : parsed
}

/**
 * Format number as currency in pt-BR locale
 * @param value - Number value
 * @param currency - Currency code (default: BRL)
 * @returns Formatted currency string
 */
export function formatCurrency(value: number, currency: string = 'BRL'): string {
  const formatter = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  
  return formatter.format(value)
}

/**
 * Format number in pt-BR locale
 * @param value - Number value
 * @param decimals - Number of decimal places (optional)
 * @returns Formatted number string
 */
export function formatNumber(value: number, decimals?: number): string {
  const options: Intl.NumberFormatOptions = {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }
  
  return new Intl.NumberFormat('pt-BR', options).format(value)
}

/**
 * Format percentage in pt-BR locale
 * @param value - Number value (0.1 = 10%)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted percentage string
 */
export function formatPercentage(value: number, decimals: number = 2): string {
  const formatter = new Intl.NumberFormat('pt-BR', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
  
  return formatter.format(value)
}