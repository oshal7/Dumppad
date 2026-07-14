import {
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
} from 'electron'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

import { Storage } from './storage.js'
import { ClipboardMonitor } from './clipboardMonitor.js'
import { AIClient, cosineSimilarity } from './ai.js'
import { extractText } from './textExtract.js'

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) { app.quit(); process.exit(0) }

// ─── State ───────────────────────────────────────────────────────────────────
let panelWindow = null
let tray = null
let storage = null
let ai = null
let monitor = null
let isPaused = false

let panelState = 'collapsed' // 'collapsed' | 'expanded'
let pinned = false
let pendingToast = null // { tempId, content, kind, sourceApp }
let toastTimer = null
let hoverEnterTimer = null
let hoverLeaveTimer = null

const COLLAPSED_WIDTH = 22
const EXPANDED_WIDTH = 460

// ─── Panel window (docked to the right edge) ────────────────────────────────

function panelBounds(state) {
  const primary = screen.getPrimaryDisplay()
  const width = state === 'expanded' ? EXPANDED_WIDTH : COLLAPSED_WIDTH
  const x = Math.round(primary.bounds.x + primary.bounds.width - width)
  return { x, y: primary.bounds.y, width, height: primary.bounds.height }
}

function sendPanelState() {
  if (panelWindow) panelWindow.webContents.send('panel-state', { state: panelState, pinned })
}

function expand() {
  panelState = 'expanded'
  if (panelWindow) panelWindow.setBounds(panelBounds('expanded'))
  sendPanelState()
}

function collapse() {
  if (pinned || pendingToast) return
  panelState = 'collapsed'
  if (panelWindow) panelWindow.setBounds(panelBounds('collapsed'))
  sendPanelState()
}

function togglePin() {
  pinned = !pinned
  pinned ? expand() : collapse()
  rebuildTrayMenu()
}

function createPanelWindow() {
  panelWindow = new BrowserWindow({
    ...panelBounds('collapsed'),
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
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  })

  panelWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  panelWindow.setAlwaysOnTop(true, 'screen-saver')

  if (process.env['ELECTRON_RENDERER_URL']) {
    panelWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    panelWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  panelWindow.once('ready-to-show', () => panelWindow.show())
}

function notifyItemsRefresh() {
  if (panelWindow && !panelWindow.isDestroyed()) {
    panelWindow.webContents.send('items-updated', storage.getItems().map(itemForRenderer))
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
      storage.updateItem(item.id, { aiDescription: description, embedding, searchText: description.toLowerCase() })
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
    notifyItemsRefresh()
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
  tray.on('click', togglePin)
}

function rebuildTrayMenu() {
  if (!tray) return
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: pinned ? 'Close Carpet' : 'Open Carpet', accelerator: 'CmdOrCtrl+Shift+L', click: togglePin },
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
  expand()
  if (panelWindow) panelWindow.webContents.send('toast-updated', pendingToast)

  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    if (pendingToast) {
      pendingToast = null
      if (panelWindow) panelWindow.webContents.send('toast-updated', null)
      // The toast auto-expanded the panel; if the user never actually
      // hovered it, no mouseleave will ever fire to collapse it again.
      collapse()
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

  createPanelWindow()
  createTray()

  if (!globalShortcut.register('CommandOrControl+Shift+L', togglePin)) {
    console.warn('[Shortcuts] Cmd+Shift+L could not be registered')
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  if (monitor) monitor.stop()
})

app.on('window-all-closed', (e) => e.preventDefault())

// ─── IPC: panel hover / drag / pin ───────────────────────────────────────────

ipcMain.on('panel-hover-enter', () => {
  clearTimeout(hoverLeaveTimer)
  clearTimeout(hoverEnterTimer)
  hoverEnterTimer = setTimeout(expand, 120)
})

ipcMain.on('panel-hover-leave', () => {
  clearTimeout(hoverEnterTimer)
  clearTimeout(hoverLeaveTimer)
  hoverLeaveTimer = setTimeout(collapse, 350)
})

ipcMain.on('panel-drag-enter', () => {
  clearTimeout(hoverEnterTimer)
  clearTimeout(hoverLeaveTimer)
  expand()
})

ipcMain.on('panel-toggle-pin', () => togglePin())

ipcMain.handle('panel-drop-files', async (_, filePaths) => {
  const added = []
  for (const filePath of filePaths) {
    try {
      const item = storage.addFileItem({ sourcePath: filePath, originalName: path.basename(filePath), sourceApp: null })
      added.push(item)
      enrichItem(item)
    } catch (e) {
      console.error('[panel-drop-files] failed for', filePath, e.message)
    }
  }
  notifyItemsRefresh()
  return { count: added.length }
})

ipcMain.handle('panel-keep-toast', () => {
  if (!pendingToast) return null
  clearTimeout(toastTimer)
  const { content, kind, sourceApp } = pendingToast
  pendingToast = null
  if (panelWindow) panelWindow.webContents.send('toast-updated', null)
  const item = storage.addTextItem({ content, kind, sourceApp })
  enrichItem(item)
  notifyItemsRefresh()
  return item
})

ipcMain.handle('panel-dismiss-toast', () => {
  clearTimeout(toastTimer)
  pendingToast = null
  if (panelWindow) panelWindow.webContents.send('toast-updated', null)
})

// ─── IPC: library/board ──────────────────────────────────────────────────────

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
  const merged = [...scored.map((s) => s.item), ...keywordMatches.filter((i) => !rankedIds.has(i.id))]
  return merged.map(itemForRenderer)
})

ipcMain.handle('ask-ai', async (_, question) => {
  const available = await ai.isAvailable()
  if (!available) return { unavailable: true }

  const queryEmbedding = await ai.embed(question)
  const items = storage.getItems().filter((i) => i.embedding)
  if (!queryEmbedding || items.length === 0) return { answer: null, sources: [] }

  const top = items
    .map((i) => ({ item: i, score: cosineSimilarity(queryEmbedding, i.embedding) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .filter((s) => s.score > 0.2)

  if (top.length === 0) return { answer: null, sources: [] }

  const context = top.map(({ item }) => {
    if (item.kind === 'image' || item.kind === 'file') return `${item.originalName || 'File'}: ${item.aiDescription || ''}`
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
