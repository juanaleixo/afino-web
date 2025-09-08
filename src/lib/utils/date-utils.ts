/**
 * Utility functions for date handling with proper UTC/timezone management
 * Ensures consistent date handling across the application
 */

/**
 * Creates a UTC date from date parts, avoiding timezone issues
 */
export const createUTCDate = (year: number, month: number, day: number): Date => {
  return new Date(Date.UTC(year, month, day))
}

/**
 * Gets current date in UTC (start of day)
 */
export const getCurrentUTCDate = (): Date => {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/**
 * Converts any date to UTC date string (YYYY-MM-DD)
 */
export const toUTCDateString = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return dateObj.toISOString().split('T')[0]!
}

/**
 * Parses date string ensuring it's treated as UTC
 */
export const parseUTCDate = (dateString: string): Date => {
  // Ensure the date is parsed as UTC by adding 'T00:00:00.000Z'
  if (dateString.includes('T')) return new Date(dateString)
  return new Date(dateString + 'T00:00:00.000Z')
}

/**
 * Calculates date range for portfolio data (always in UTC)
 */
export const calculateUTCDateRange = (
  period: '1M' | '3M' | '6M' | '1Y' | '2Y' | 'ALL' | 'CUSTOM',
  customFrom?: string,
  customTo?: string
) => {
  const todayUTC = getCurrentUTCDate()
  const endDate = customTo || toUTCDateString(todayUTC)
  
  let startDate: string
  
  switch (period) {
    case '1M':
      startDate = toUTCDateString(new Date(todayUTC.getTime() - 30 * 24 * 60 * 60 * 1000))
      break
    case '3M':
      startDate = toUTCDateString(new Date(todayUTC.getTime() - 90 * 24 * 60 * 60 * 1000))
      break
    case '6M':
      startDate = toUTCDateString(new Date(todayUTC.getTime() - 180 * 24 * 60 * 60 * 1000))
      break
    case '1Y':
      startDate = toUTCDateString(new Date(todayUTC.getTime() - 365 * 24 * 60 * 60 * 1000))
      break
    case '2Y':
      startDate = toUTCDateString(new Date(todayUTC.getTime() - 730 * 24 * 60 * 60 * 1000))
      break
    case 'ALL':
      startDate = toUTCDateString(createUTCDate(2020, 0, 1))
      break
    case 'CUSTOM':
      startDate = customFrom || toUTCDateString(new Date(todayUTC.getTime() - 365 * 24 * 60 * 60 * 1000))
      break
    default:
      startDate = toUTCDateString(new Date(todayUTC.getTime() - 365 * 24 * 60 * 60 * 1000))
  }
  
  return { from: startDate, to: endDate }
}