import fs from 'fs'
import path from 'path'
import pdfParse from 'pdf-parse'

const MAX_EXTRACT_CHARS = 20000
const TEXT_EXTS = new Set(['.txt', '.md', '.markdown', '.json', '.csv', '.log'])

// Best-effort local text extraction for indexing. Returns null when the file
// type isn't supported — those items just fall back to filename search.
export async function extractText(filePath) {
  const ext = path.extname(filePath).toLowerCase()

  try {
    if (ext === '.pdf') {
      const buffer = fs.readFileSync(filePath)
      const data = await pdfParse(buffer)
      return (data.text || '').trim().slice(0, MAX_EXTRACT_CHARS) || null
    }

    if (TEXT_EXTS.has(ext)) {
      const content = fs.readFileSync(filePath, 'utf-8')
      return content.trim().slice(0, MAX_EXTRACT_CHARS) || null
    }
  } catch (e) {
    console.error('[textExtract] failed for', filePath, e.message)
  }

  return null
}
