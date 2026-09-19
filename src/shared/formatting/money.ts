import { getCurrencyDef } from '@/shared/constants/currency'

/** Convert a decimal amount into integer minor units (e.g. cents/satang), rounding half-up. */
export function toMinorUnits(amount: number, currency: string): number {
  const { decimals } = getCurrencyDef(currency)
  const factor = 10 ** decimals
  return Math.round(amount * factor)
}

/** Convert integer minor units back into a decimal amount. */
export function fromMinorUnits(minor: number, currency: string): number {
  const { decimals } = getCurrencyDef(currency)
  const factor = 10 ** decimals
  return Math.round(minor) / factor
}

export function formatMoney(amount: number, currency: string): string {
  const { decimals, symbol } = getCurrencyDef(currency)
  const formatted = amount.toLocaleString('th-TH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  })
  return `${symbol}${formatted}`
}
