// Friendly names (and suggested categories) for raw card-notification merchant strings.
// First matching rule wins. `categoryName` is matched against the household's category names;
// if there is no such category the import falls back to the category chosen on screen.

export interface MerchantRule {
  pattern: RegExp
  description: string
  categoryName?: string
}

export const MERCHANT_RULES: MerchantRule[] = [
  { pattern: /LP_BTS/i, description: 'ค่าเดินทาง BTS', categoryName: 'เดินทาง' },
  { pattern: /LP_BRT/i, description: 'ค่าเดินทาง BRT', categoryName: 'เดินทาง' },
  { pattern: /BSS\*BTS/i, description: 'ค่าเดินทาง BTS', categoryName: 'เดินทาง' },
  { pattern: /MRT-BEM/i, description: 'ค่าเดินทาง MRT', categoryName: 'เดินทาง' },
  { pattern: /GRAB/i, description: 'ค่าเดินทาง Grab', categoryName: 'เดินทาง' },
  { pattern: /FAST FOOD/i, description: 'อาหาร', categoryName: 'อาหาร' },
  { pattern: /7-?11/, description: 'อาหาร 7-11', categoryName: 'อาหาร' }
]

export function resolveMerchant(merchant: string): { description: string; categoryName?: string } {
  const rule = MERCHANT_RULES.find((r) => r.pattern.test(merchant))
  return rule ? { description: rule.description, categoryName: rule.categoryName } : { description: merchant }
}
