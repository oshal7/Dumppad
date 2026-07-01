const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('carpetAPI', {
  // ── Inbound ──────────────────────────────────────────────────────────────
  onItemsUpdated: (cb) => ipcRenderer.on('items-updated', (_, items) => cb(items)),

  // ── Invocations ──────────────────────────────────────────────────────────
  getItems: () => ipcRenderer.invoke('get-items'),
  searchItems: (query) => ipcRenderer.invoke('search-items', query),
  deleteItem: (id) => ipcRenderer.invoke('delete-item', id),
  openItem: (id) => ipcRenderer.invoke('open-item', id),
  copyItem: (id) => ipcRenderer.invoke('copy-item', id),
  askAI: (question) => ipcRenderer.invoke('ask-ai', question),
  getAiStatus: () => ipcRenderer.invoke('get-ai-status'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (patch) => ipcRenderer.invoke('update-settings', patch),
})
