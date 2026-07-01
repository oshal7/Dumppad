const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('carpetAPI', {
  // ── Inbound (main → renderer) ───────────────────────────────────────────
  onPanelState: (cb) => ipcRenderer.on('panel-state', (_, data) => cb(data)),
  onToastUpdated: (cb) => ipcRenderer.on('toast-updated', (_, toast) => cb(toast)),
  onItemsUpdated: (cb) => ipcRenderer.on('items-updated', (_, items) => cb(items)),

  // ── Outbound (fire-and-forget) ───────────────────────────────────────────
  hoverEnter: () => ipcRenderer.send('panel-hover-enter'),
  hoverLeave: () => ipcRenderer.send('panel-hover-leave'),
  dragEnter: () => ipcRenderer.send('panel-drag-enter'),
  togglePin: () => ipcRenderer.send('panel-toggle-pin'),

  // ── Invocations ──────────────────────────────────────────────────────────
  dropFiles: (paths) => ipcRenderer.invoke('panel-drop-files', paths),
  keepToast: () => ipcRenderer.invoke('panel-keep-toast'),
  dismissToast: () => ipcRenderer.invoke('panel-dismiss-toast'),

  getItems: () => ipcRenderer.invoke('get-items'),
  searchItems: (query) => ipcRenderer.invoke('search-items', query),
  deleteItem: (id) => ipcRenderer.invoke('delete-item', id),
  openItem: (id) => ipcRenderer.invoke('open-item', id),
  copyItem: (id) => ipcRenderer.invoke('copy-item', id),
  askAI: (question) => ipcRenderer.invoke('ask-ai', question),
  getAiStatus: () => ipcRenderer.invoke('get-ai-status'),
  getSettings: () => ipcRenderer.invoke('get-settings'),
  updateSettings: (patch) => ipcRenderer.invoke('update-settings', patch),

  // ── Helpers ──────────────────────────────────────────────────────────────
  getPathForFile: (file) => webUtils.getPathForFile(file),
})
