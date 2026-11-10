// Rebuilds text lines from the positioned text fragments a PDF reader returns, so the statement
// parser can work on plain lines. Pure, no PDF library imports.

export interface TextFragment {
  text: string
  x: number
  y: number
}

/** Groups fragments into lines (same baseline within `tolerance`), top-to-bottom, left-to-right. */
export function fragmentsToLines(fragments: TextFragment[], tolerance = 2): string[] {
  const rows: { y: number; items: TextFragment[] }[] = []
  for (const f of [...fragments].sort((a, b) => b.y - a.y || a.x - b.x)) {
    if (!f.text.trim()) continue
    const row = rows.find((r) => Math.abs(r.y - f.y) <= tolerance)
    if (row) row.items.push(f)
    else rows.push({ y: f.y, items: [f] })
  }
  return rows.map((r) =>
    r.items
      .sort((a, b) => a.x - b.x)
      .map((i) => i.text.trim())
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  )
}
