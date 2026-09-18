/**
 * ZYRAXON X - PDF Reader
 * Extracts text from PDFs for knowledge system
 * Uses pdf.js (pdfjs-dist) for cross-platform PDF parsing
 */

export type PDFTextResult = {
  text: string
  numPages: number
  title?: string
  info?: Record<string, any>
}

export class PDFReader {
  private _pdfjsLib: any = null

  async init(): Promise<boolean> {
    try {
      if (typeof window !== "undefined") {
        this._pdfjsLib = await import("pdfjs-dist")
        this._pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${this._pdfjsLib.version}/pdf.worker.min.mjs`
      } else {
        this._pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs")
      }
      return true
    } catch (e) {
      console.warn("PDFReader: pdfjs-dist not available, using fallback", e)
      return false
    }
  }

  async extractText(data: ArrayBuffer): Promise<PDFTextResult> {
    if (!this._pdfjsLib) {
      return this.fallbackExtract(data)
    }
    try {
      const pdf = await this._pdfjsLib.getDocument({ data }).promise
      const pages: string[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        const pageText = content.items.map((item: any) => item.str).join(" ")
        pages.push(pageText)
      }
      const metadata = await pdf.getMetadata()
      return {
        text: pages.join("\n\n"),
        numPages: pdf.numPages,
        title: (metadata.info as any)?.Title || undefined,
        info: metadata.info as any,
      }
    } catch (e) {
      return this.fallbackExtract(data)
    }
  }

  async extractFromBlob(blob: Blob): Promise<PDFTextResult> {
    const buffer = await blob.arrayBuffer()
    return this.extractText(buffer)
  }

  async extractFromUrl(url: string): Promise<PDFTextResult> {
    const resp = await fetch(url)
    if (!resp.ok) throw new Error(`Failed to fetch PDF: ${resp.status}`)
    const buffer = await resp.arrayBuffer()
    return this.extractText(buffer)
  }

  async extractFromFile(file: File): Promise<PDFTextResult> {
    const buffer = await file.arrayBuffer()
    return this.extractText(buffer)
  }

  private async fallbackExtract(data: ArrayBuffer): Promise<PDFTextResult> {
    const bytes = new Uint8Array(data)
    let text = ""
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] >= 32 && bytes[i] <= 126) {
        text += String.fromCharCode(bytes[i])
      } else if (bytes[i] === 10 || bytes[i] === 13) {
        text += "\n"
      } else {
        text += " "
      }
    }
    const cleaned = text
      .replace(/\s+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\n\s*\n/g, "\n\n")
      .trim()
    return { text: cleaned, numPages: 0 }
  }

  chunkText(text: string, chunkSize = 2000, overlap = 200): string[] {
    const chunks: string[] = []
    let start = 0
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length)
      chunks.push(text.substring(start, end))
      start = end - overlap
      if (start + overlap >= text.length) break
    }
    return chunks
  }

  extractSections(text: string): Array<{ title: string; content: string }> {
    const sections: Array<{ title: string; content: string }> = []
    const lines = text.split("\n")
    let currentTitle = "Introduction"
    let currentContent = ""
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.length > 0 && trimmed.length < 100 && trimmed === trimmed.toUpperCase() && !trimmed.match(/^\d+$/)) {
        if (currentContent.trim()) {
          sections.push({ title: currentTitle, content: currentContent.trim() })
        }
        currentTitle = trimmed
        currentContent = ""
      } else {
        currentContent += line + "\n"
      }
    }
    if (currentContent.trim()) {
      sections.push({ title: currentTitle, content: currentContent.trim() })
    }
    return sections
  }
}
