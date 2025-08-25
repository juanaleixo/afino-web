import { formatCurrency, parseCurrency, formatNumber, formatCompactNumber } from '../currency'

describe('Currency Utils', () => {
  describe('parseDecimalInput', () => {
    it('should parse pt-BR format with comma', () => {
      expect(parseDecimalInput('1.234,56')).toBe(1234.56)
      expect(parseDecimalInput('25,30')).toBe(25.30)
      expect(parseDecimalInput('1.000,00')).toBe(1000.00)
    })

    it('should parse en-US format with dot', () => {
      expect(parseDecimalInput('1234.56')).toBe(1234.56)
      expect(parseDecimalInput('25.30')).toBe(25.30)
      expect(parseDecimalInput('1000.00')).toBe(1000.00)
    })

    it('should handle edge cases', () => {
      expect(parseDecimalInput('')).toBe(0)
      expect(parseDecimalInput('0')).toBe(0)
      expect(parseDecimalInput('  25,30  ')).toBe(25.30)
      expect(parseDecimalInput('invalid')).toBe(0)
      expect(parseDecimalInput(null as any)).toBe(0)
      expect(parseDecimalInput(undefined as any)).toBe(0)
    })

    it('should handle numbers without decimals', () => {
      expect(parseDecimalInput('1000')).toBe(1000)
      expect(parseDecimalInput('25')).toBe(25)
    })
  })

  describe('formatCurrency', () => {
    it('should format BRL currency correctly', () => {
      expect(formatCurrency(1234.56)).toBe('R$ 1.234,56')
      expect(formatCurrency(1000)).toBe('R$ 1.000,00')
      expect(formatCurrency(25.3)).toBe('R$ 25,30')
    })

    it('should handle zero and negative values', () => {
      expect(formatCurrency(0)).toBe('R$ 0,00')
      expect(formatCurrency(-100)).toBe('-R$ 100,00')
    })

    it('should handle custom currency', () => {
      expect(formatCurrency(100, 'USD')).toBe('$ 100,00')
      expect(formatCurrency(100, 'EUR')).toBe('€ 100,00')
    })
  })

  describe('formatNumber', () => {
    it('should format numbers with pt-BR locale', () => {
      expect(formatNumber(1234.56)).toBe('1.234,56')
      expect(formatNumber(1000)).toBe('1.000')
      expect(formatNumber(25.3)).toBe('25,3')
    })

    it('should handle decimals parameter', () => {
      expect(formatNumber(1234.567, 2)).toBe('1.234,57')
      expect(formatNumber(1234.5, 2)).toBe('1.234,50')
      expect(formatNumber(1234, 2)).toBe('1.234,00')
    })
  })
})