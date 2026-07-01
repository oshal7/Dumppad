import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const DEFAULT_SETTINGS = {
  aiEnabled: true,
  ollamaBaseUrl: 'http://localhost:11434',
  embedModel: 'nomic-embed-text',
  visionModel: 'moondream',
  chatModel: 'llama3.2',
}

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic', '.bmp', '.tiff'])

function kindForExt(ext) {
  return IMAGE_EXTS.has(ext.toLowerCase()) ? 'image' : 'file'
}

export class Storage {
  constructor(userDataPath) {
    this.dataPath = path.join(userDataPath, 'carpet-data.json')
    this.filesDir = path.join(userDataPath, 'library', 'files')
    fs.mkdirSync(this.filesDir, { recursive: true })
    this.data = this._load()
  }

  _load() {
    try {
      if (fs.existsSync(this.dataPath)) {
        const parsed = JSON.parse(fs.readFileSync(this.dataPath, 'utf-8'))
        return { items: parsed.items || [], settings: { ...DEFAULT_SETTINGS, ...parsed.settings } }
      }
    } catch (e) {
      console.error('[Storage] load failed:', e.message)
    }
    return { items: [], settings: { ...DEFAULT_SETTINGS } }
  }

  _save() {
    try {
      fs.writeFileSync(this.dataPath, JSON.stringify(this.data, null, 2), 'utf-8')
    } catch (e) {
      console.error('[Storage] save failed:', e.message)
    }
  }

  getItems() {
    return [...this.data.items].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }

  getItem(id) {
    return this.data.items.find((i) => i.id === id)
  }

  getSettings() {
    return { ...this.data.settings }
  }

  updateSettings(patch) {
    this.data.settings = { ...this.data.settings, ...patch }
    this._save()
    return this.data.settings
  }

  getFileAbsolutePath(item) {
    if (item.kind !== 'image' && item.kind !== 'file') return null
    return path.join(this.filesDir, item.content)
  }

  addTextItem({ content, kind, sourceApp }) {
    const item = {
      id: crypto.randomUUID(),
      kind, // 'text' | 'link' | 'code'
      content,
      originalName: null,
      searchText: content.toLowerCase(),
      aiDescription: null,
      embedding: null,
      sourceApp: sourceApp || null,
      timestamp: new Date().toISOString(),
      size: null,
    }
    this.data.items.unshift(item)
    this._save()
    return item
  }

  addFileItem({ sourcePath, originalName, sourceApp }) {
    const ext = path.extname(originalName || sourcePath)
    const storedName = `${crypto.randomUUID()}${ext}`
    const destPath = path.join(this.filesDir, storedName)
    fs.copyFileSync(sourcePath, destPath)
    const stat = fs.statSync(destPath)

    const item = {
      id: crypto.randomUUID(),
      kind: kindForExt(ext),
      content: storedName,
      originalName: originalName || path.basename(sourcePath),
      searchText: (originalName || '').toLowerCase(),
      aiDescription: null,
      embedding: null,
      sourceApp: sourceApp || null,
      timestamp: new Date().toISOString(),
      size: stat.size,
    }
    this.data.items.unshift(item)
    this._save()
    return item
  }

  updateItem(id, patch) {
    const item = this.data.items.find((i) => i.id === id)
    if (!item) return null
    Object.assign(item, patch)
    this._save()
    return item
  }

  deleteItem(id) {
    const item = this.data.items.find((i) => i.id === id)
    if (!item) return this.getItems()
    if (item.kind === 'image' || item.kind === 'file') {
      const abs = this.getFileAbsolutePath(item)
      fs.unlink(abs, () => {})
    }
    this.data.items = this.data.items.filter((i) => i.id !== id)
    this._save()
    return this.getItems()
  }
}

export { DEFAULT_SETTINGS }
