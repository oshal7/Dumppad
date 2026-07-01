const { contextBridge, ipcRenderer, webUtils } = require('electron')

contextBridge.exposeInMainWorld('carpetAPI', {
  // ── Inbound ──────────────────────────────────────────────────────────────
  onNotchState: (cb) => ipcRenderer.on('notch-state', (_, data) => cb(data)),

  // ── Outbound (fire-and-forget) ───────────────────────────────────────────
  click: () => ipcRenderer.send('notch-click'),
  dismissToast: () => ipcRenderer.send('notch-dismiss-toast'),

  // ── Invocations ──────────────────────────────────────────────────────────
  keepToast: () => ipcRenderer.invoke('notch-keep-toast'),
  dropFiles: (paths) => ipcRenderer.invoke('notch-drop-files', paths),

  // ── Helpers ──────────────────────────────────────────────────────────────
  getPathForFile: (file) => webUtils.getPathForFile(file),
})
