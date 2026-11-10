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

export interface UserMerchantRule {
  keyword: string
  description?: string
  categoryId: string
}

export interface ResolvedMerchant {
  description: string
  categoryId?: string
  /** 'rule' = household master list, 'builtin' = shipped default, 'none' = unknown merchant. */
  source: 'rule' | 'builtin' | 'none'
}

/**
 * Classifies a raw merchant string. The household's master rules win (longest matching keyword =
 * most specific); otherwise the shipped defaults above are used, with their category looked up by
 * name in the household's categories.
 */
export function resolveWithRules(
  merchant: string,
  rules: UserMerchantRule[],
  categories: { categoryId: string; name: string }[]
): ResolvedMerchant {
  const haystack = merchant.toLowerCase()
  const hit = rules
    .filter((r) => r.keyword.trim() && haystack.includes(r.keyword.trim().toLowerCase()))
    .sort((a, b) => b.keyword.trim().length - a.keyword.trim().length)[0]
  if (hit) return { description: hit.description?.trim() || merchant, categoryId: hit.categoryId, source: 'rule' }

  const builtin = resolveMerchant(merchant)
  if (builtin.categoryName) {
    const categoryId = categories.find((c) => c.name === builtin.categoryName)?.categoryId
    return { description: builtin.description, categoryId, source: categoryId ? 'builtin' : 'none' }
  }
  return { description: merchant, source: 'none' }
}
