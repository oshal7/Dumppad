"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("electronAPI", {
  // ── Inbound events (main → renderer) ──────────────────────────────────────
  onPanelShow: (cb) => ipcRenderer.on("panel-show", (_, data) => cb(data)),
  onPanelHide: (cb) => ipcRenderer.on("panel-hide", () => cb()),
  onItemsUpdated: (cb) => ipcRenderer.on("items-updated", (_, items) => cb(items)),
  onTrackingState: (cb) => ipcRenderer.on("tracking-state", (_, paused) => cb(paused)),
  // Remove all listeners (call on unmount to prevent leaks)
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
  // ── Outbound messages (renderer → main) ───────────────────────────────────
  closePanel: () => ipcRenderer.send("close-panel"),
  overlayClick: () => ipcRenderer.send("overlay-click"),
  togglePause: (paused) => ipcRenderer.send("toggle-pause", paused),
  // ── Invocations (renderer → main, with response) ──────────────────────────
  getItems: () => ipcRenderer.invoke("get-items"),
  pasteItem: (id) => ipcRenderer.invoke("paste-item", id),
  copyItem: (id) => ipcRenderer.invoke("copy-item", id),
  togglePin: (id) => ipcRenderer.invoke("toggle-pin", id),
  deleteItem: (id) => ipcRenderer.invoke("delete-item", id),
  clearHistory: () => ipcRenderer.invoke("clear-history"),
  copyMultiple: (ids) => ipcRenderer.invoke("copy-multiple", ids),
  saveItem: (id) => ipcRenderer.invoke("save-item", id),
  getSettings: () => ipcRenderer.invoke("get-settings"),
  updateSettings: (settings) => ipcRenderer.invoke("update-settings", settings)
});
