const {
  app,
  BrowserWindow,
  globalShortcut,
  ipcMain,
  clipboard,
  screen,
  Tray,
  Menu,
  nativeImage,
  shell,
} = require('electron')
const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

const { Storage } = require('./storage')
const { ClipboardMonitor } = require('./clipboardMonitor')
const { AIClient, cosineSimilarity } = require('./ai')
const { extractText } = require('./textExtract')

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) { app.quit(); process.exit(0) }

// ─── State ───────────────────────────────────────────────────────────────────
let notchWindow = null
let libraryWindow = null
let tray = null
let storage = null
let ai = null
let monitor = null
let isPaused = false

// The notch window's OS-level bounds only ever have two sizes: 'base' (its
// permanent resting size, big enough to be a real drag-and-drop target) and
// 'toast' (briefly taller, to show the "keep this?" prompt). Everything else
// — idle look, drag-hover highlight, drop confirmation, click-to-open — is a
// pure CSS/state change inside the renderer, because resizing the actual OS
// window mid-drag is a race condition: Chromium does not fire `mouseenter`
// during a native external drag, only `dragenter`/`dragover`/`drop`, so a
// resize-on-hover scheme can miss the drag entirely.
let notchState = 'base' // 'base' | 'toast'
let pendingToast = null // { tempId, content, kind, sourceApp }
let toastTimer = null

const NOTCH_SIZES = {
  base: { width: 220, height: 44 },
  toast: { width: 380, height: 108 },
}

// ─── Notch window ────────────────────────────────────────────────────────────

function notchBounds(state) {
  const primary = screen.getPrimaryDisplay()
  const { width, height } = NOTCH_SIZES[state]
  const x = Math.round(primary.bounds.x + (primary.bounds.width - width) / 2)
  return { x, y: primary.bounds.y, width, height }
}

function setNotchState(state, payload) {
  notchState = state
  if (!notchWindow) return
  notchWindow.setBounds(notchBounds(state))
  notchWindow.webContents.send('notch-state', { state, payload: payload || null })
}

function createNotchWindow() {
  notchWindow = new BrowserWindow({
    ...notchBounds('base'),
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    movable: false,
    hasShadow: false,
    show: false,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/notch.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  notchWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  notchWindow.setAlwaysOnTop(true, 'screen-saver')

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    notchWindow.loadURL(`${rendererUrl}/notch.html`)
  } else {
    notchWindow.loadFile(path.join(__dirname, '../renderer/notch.html'))
  }

  notchWindow.once('ready-to-show', () => notchWindow.show())
}

// ─── Library window ──────────────────────────────────────────────────────────

function createLibraryWindow() {
  libraryWindow = new BrowserWindow({
    width: 960,
    height: 660,
    minWidth: 700,
    minHeight: 480,
    show: false,
    title: 'Carpet',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, '../preload/library.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  const rendererUrl = process.env['ELECTRON_RENDERER_URL']
  if (rendererUrl) {
    libraryWindow.loadURL(`${rendererUrl}/library.html`)
  } else {
    libraryWindow.loadFile(path.join(__dirname, '../renderer/library.html'))
  }

  libraryWindow.on('close', (e) => {
    e.preventDefault()
    libraryWindow.hide()
  })
}

function toggleLibrary() {
  if (!libraryWindow) createLibraryWindow()
  if (libraryWindow.isVisible()) {
    libraryWindow.hide()
  } else {
    libraryWindow.show()
    libraryWindow.focus()
  }
}

function notifyLibraryRefresh() {
  if (libraryWindow && !libraryWindow.isDestroyed()) {
    libraryWindow.webContents.send('items-updated', storage.getItems())
  }
}

// ─── AI enrichment (async, best-effort) ─────────────────────────────────────

async function enrichItem(item) {
  const available = await ai.isAvailable()
  if (!available) return

  try {
    if (item.kind === 'image') {
      const abs = storage.getFileAbsolutePath(item)
      const base64 = fs.readFileSync(abs).toString('base64')
      const description = await ai.describeImage(base64)
      if (!description) return
      const embedding = await ai.embed(description)
      storage.updateItem(item.id, {
        aiDescription: description,
        embedding,
        searchText: description.toLowerCase(),
      })
    } else if (item.kind === 'file') {
      const abs = storage.getFileAbsolutePath(item)
      const text = await extractText(abs)
      if (!text) return
      const embedding = await ai.embed(text)
      storage.updateItem(item.id, {
        aiDescription: text.slice(0, 400),
        embedding,
        searchText: `${item.originalName || ''} ${text}`.toLowerCase(),
      })
    } else {
      const embedding = await ai.embed(item.content)
      if (embedding) storage.updateItem(item.id, { embedding })
    }
    notifyLibraryRefresh()
  } catch (e) {
    console.error('[enrichItem] failed:', e.message)
  }
}

// ─── Tray ────────────────────────────────────────────────────────────────────

function createTray() {
  const img = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  )
  img.setTemplateImage(true)
  tray = new Tray(img)
  tray.setToolTip('Carpet')
  rebuildTrayMenu()
  tray.on('click', toggleLibrary)
}

function rebuildTrayMenu() {
  if (!tray) return
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Library', accelerator: 'CmdOrCtrl+Shift+L', click: toggleLibrary },
    { type: 'separator' },
    {
      label: isPaused ? 'Resume Capturing' : 'Pause Capturing',
      click: () => {
        isPaused = !isPaused
        isPaused ? monitor.pause() : monitor.resume()
        rebuildTrayMenu()
      },
    },
    { label: 'Reveal Library Folder', click: () => shell.showItemInFolder(storage.filesDir) },
    { type: 'separator' },
    { label: 'Quit Carpet', click: () => app.quit() },
  ]))
}

// ─── Clipboard capture → keep-toast flow ────────────────────────────────────

function handleClipboardCandidate({ content, kind, sourceApp }) {
  pendingToast = { tempId: crypto.randomUUID(), content, kind, sourceApp }
  setNotchState('toast', pendingToast)

  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    if (pendingToast) {
      pendingToast = null
      setNotchState('base')
    }
  }, 3000)
}

// ─── App lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(() => {
  if (app.dock) app.dock.hide()

  storage = new Storage(app.getPath('userData'))
  ai = new AIClient(() => storage.getSettings())
  monitor = new ClipboardMonitor(clipboard, handleClipboardCandidate)
  monitor.start()

  createNotchWindow()
  createTray()

  if (!globalShortcut.register('CommandOrControl+Shift+L', toggleLibrary)) {
    console.warn('[Shortcuts] Cmd+Shift+L could not be registered')
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (monitor) monitor.stop()
})

app.on('window-all-closed', (e) => e.preventDefault())

// ─── IPC: notch ──────────────────────────────────────────────────────────────

ipcMain.on('notch-click', () => toggleLibrary())

ipcMain.handle('notch-drop-files', async (_, filePaths) => {
  const sourceApp = null
  const added = []
  for (const filePath of filePaths) {
    try {
      const item = storage.addFileItem({ sourcePath: filePath, originalName: path.basename(filePath), sourceApp })
      added.push(item)
      enrichItem(item)
    } catch (e) {
      console.error('[notch-drop-files] failed for', filePath, e.message)
    }
  }
  notifyLibraryRefresh()
  return { count: added.length }
})

ipcMain.handle('notch-keep-toast', () => {
  if (!pendingToast) return null
  clearTimeout(toastTimer)
  const { content, kind, sourceApp } = pendingToast
  pendingToast = null
  const item = storage.addTextItem({ content, kind, sourceApp })
  enrichItem(item)
  notifyLibraryRefresh()
  setNotchState('base')
  return item
})

ipcMain.on('notch-dismiss-toast', () => {
  clearTimeout(toastTimer)
  pendingToast = null
  setNotchState('base')
})

// ─── IPC: library ────────────────────────────────────────────────────────────

function itemForRenderer(item) {
  if (item.kind === 'image' || item.kind === 'file') {
    const abs = storage.getFileAbsolutePath(item)
    return { ...item, fileUrl: `file://${abs}` }
  }
  return item
}

ipcMain.handle('get-items', () => storage.getItems().map(itemForRenderer))

ipcMain.handle('get-ai-status', () => ai.isAvailable())

ipcMain.handle('get-settings', () => storage.getSettings())
ipcMain.handle('update-settings', (_, patch) => storage.updateSettings(patch))

ipcMain.handle('search-items', async (_, query) => {
  const items = storage.getItems()
  const q = (query || '').trim()
  if (!q) return items.map(itemForRenderer)

  const lower = q.toLowerCase()
  const keywordMatches = items.filter((i) => (i.searchText || '').includes(lower) || (i.content || '').toLowerCase().includes(lower))

  const available = await ai.isAvailable()
  if (!available) return keywordMatches.map(itemForRenderer)

  const queryEmbedding = await ai.embed(q)
  if (!queryEmbedding) return keywordMatches.map(itemForRenderer)

  const scored = items
    .filter((i) => i.embedding)
    .map((i) => ({ item: i, score: cosineSimilarity(queryEmbedding, i.embedding) }))
    .filter((s) => s.score > 0.35)
    .sort((a, b) => b.score - a.score)

  const rankedIds = new Set(scored.map((s) => s.item.id))
  const merged = [
    ...scored.map((s) => s.item),
    ...keywordMatches.filter((i) => !rankedIds.has(i.id)),
  ]
  return merged.map(itemForRenderer)
})

ipcMain.handle('ask-ai', async (_, question) => {
  const available = await ai.isAvailable()
  if (!available) return { unavailable: true }

  const queryEmbedding = await ai.embed(question)
  const items = storage.getItems().filter((i) => i.embedding)
  if (!queryEmbedding || items.length === 0) {
    return { answer: null, sources: [] }
  }

  const top = items
    .map((i) => ({ item: i, score: cosineSimilarity(queryEmbedding, i.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .filter((s) => s.score > 0.2)

  if (top.length === 0) return { answer: null, sources: [] }

  const context = top.map(({ item }) => {
    if (item.kind === 'image' || item.kind === 'file') {
      return `${item.originalName || 'File'}: ${item.aiDescription || ''}`
    }
    return item.content
  })

  const answer = await ai.ask(question, context)
  return { answer, sources: top.map(({ item }) => itemForRenderer(item)) }
})

ipcMain.handle('open-item', (_, id) => {
  const item = storage.getItem(id)
  if (!item) return { success: false }

  if (item.kind === 'image' || item.kind === 'file') {
    shell.showItemInFolder(storage.getFileAbsolutePath(item))
  } else {
    clipboard.writeText(item.content)
  }
  return { success: true }
})

ipcMain.handle('copy-item', (_, id) => {
  const item = storage.getItem(id)
  if (!item) return { success: false }

  if (item.kind === 'image') {
    clipboard.writeImage(nativeImage.createFromPath(storage.getFileAbsolutePath(item)))
  } else if (item.kind === 'file') {
    return { success: false, reason: 'not-copyable' }
  } else {
    clipboard.writeText(item.content)
  }
  return { success: true }
})

ipcMain.handle('delete-item', (_, id) => storage.deleteItem(id).map(itemForRenderer))
