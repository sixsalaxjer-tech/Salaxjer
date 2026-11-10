import { fragmentsToLines, type TextFragment } from '@/domain/rules/pdfText'

/** Reads a PDF in the browser and returns its text as lines (page by page). pdf.js is loaded on
 * demand so it never weighs down the main bundle. Throws if the PDF is password-protected. */
export async function extractPdfLines(file: File): Promise<string[]> {
  const pdfjs = await import('pdfjs-dist')
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise
  const lines: string[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const content = await (await pdf.getPage(p)).getTextContent()
    const fragments: TextFragment[] = []
    for (const item of content.items) {
      if ('str' in item) fragments.push({ text: item.str, x: item.transform[4], y: item.transform[5] })
    }
    lines.push(...fragmentsToLines(fragments))
  }
  return lines
}
