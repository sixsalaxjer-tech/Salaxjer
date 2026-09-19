// Supported currencies (FR-001 validation: "สกุลเงินต้องอยู่ในรายการที่รองรับ").
// Decimal places matter for rounding (BR-011): JPY has 0 minor units, most others have 2.
export interface CurrencyDef {
  code: string
  label: string
  decimals: number
  symbol: string
}

export const SUPPORTED_CURRENCIES: CurrencyDef[] = [
  { code: 'THB', label: 'บาทไทย', decimals: 2, symbol: '฿' },
  { code: 'USD', label: 'US Dollar', decimals: 2, symbol: '$' },
  { code: 'EUR', label: 'Euro', decimals: 2, symbol: '€' },
  { code: 'SGD', label: 'Singapore Dollar', decimals: 2, symbol: 'S$' },
  { code: 'JPY', label: 'Japanese Yen', decimals: 0, symbol: '¥' }
]

export function getCurrencyDef(code: string): CurrencyDef {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code) ?? SUPPORTED_CURRENCIES[0]
}

export function isSupportedCurrency(code: string): boolean {
  return SUPPORTED_CURRENCIES.some((c) => c.code === code)
}
