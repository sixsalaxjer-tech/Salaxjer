/**
 * Parses a quick-entry amount field into one or more individual amounts, e.g. for logging
 * several same-category expenses in one line: "15+15+15+15" -> four separate ฿15 records
 * instead of one ฿60 record. Accepts "+" or "," as separators. Non-numeric or non-positive
 * pieces are silently dropped so a stray trailing separator doesn't break entry.
 */
export function parseAmountList(text: string): number[] {
  return text
    .split(/[+,]/)
    .map((piece) => piece.trim())
    .filter(Boolean)
    .map((piece) => Number(piece))
    .filter((n) => Number.isFinite(n) && n > 0)
}
