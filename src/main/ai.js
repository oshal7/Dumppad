// Thin client for a locally-running Ollama server (https://ollama.com).
// Everything here talks to 127.0.0.1 only — no data ever leaves the machine.
// All calls fail soft: if Ollama isn't running or a model isn't pulled yet,
// callers get null/false back instead of a thrown error, so the app keeps
// working with plain keyword search.

const AVAILABILITY_CACHE_MS = 15000
const REQUEST_TIMEOUT_MS = 30000

class AIClient {
  constructor(getSettings) {
    this.getSettings = getSettings
    this._availableCache = { value: false, checkedAt: 0 }
  }

  async _fetch(pathname, body) {
    const { ollamaBaseUrl } = this.getSettings()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
    try {
      const res = await fetch(`${ollamaBaseUrl}${pathname}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) return null
      return await res.json()
    } catch (e) {
      return null
    } finally {
      clearTimeout(timer)
    }
  }

  async isAvailable(force = false) {
    const settings = this.getSettings()
    if (!settings.aiEnabled) return false

    const now = Date.now()
    if (!force && now - this._availableCache.checkedAt < AVAILABILITY_CACHE_MS) {
      return this._availableCache.value
    }

    let ok = false
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), 2000)
      const res = await fetch(`${settings.ollamaBaseUrl}/api/tags`, { signal: controller.signal })
      clearTimeout(timer)
      ok = res.ok
    } catch {
      ok = false
    }
    this._availableCache = { value: ok, checkedAt: now }
    return ok
  }

  async embed(text) {
    if (!text || !text.trim()) return null
    const { embedModel } = this.getSettings()
    const result = await this._fetch('/api/embeddings', { model: embedModel, prompt: text.slice(0, 8000) })
    return result?.embedding || null
  }

  async describeImage(base64Data) {
    const { visionModel } = this.getSettings()
    const result = await this._fetch('/api/generate', {
      model: visionModel,
      prompt: 'Describe this image in one or two concise sentences, mentioning any visible text, people, or notable objects. Focus on details someone might later search for.',
      images: [base64Data],
      stream: false,
    })
    return result?.response?.trim() || null
  }

  async ask(question, contextChunks) {
    const { chatModel } = this.getSettings()
    const context = contextChunks
      .map((c, i) => `[${i + 1}] ${c}`)
      .join('\n\n')
    const prompt = `You are answering a question using only the notes below, which the user previously saved. If the answer isn't in the notes, say so plainly.\n\nNotes:\n${context}\n\nQuestion: ${question}\n\nAnswer concisely, and reference which note number(s) you used.`
    const result = await this._fetch('/api/generate', { model: chatModel, prompt, stream: false })
    return result?.response?.trim() || null
  }
}

function cosineSimilarity(a, b) {
  if (!a || !b || a.length !== b.length) return -1
  let dot = 0, normA = 0, normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i]
    normA += a[i] * a[i]
    normB += b[i] * b[i]
  }
  if (normA === 0 || normB === 0) return -1
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

module.exports = { AIClient, cosineSimilarity }
