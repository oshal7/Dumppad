"use strict";
const fs = require("fs");
const pathModule = require("path");
const MAX_IMAGE_DATA_URL = 1.5 * 1024 * 1024;
const DEFAULT_HISTORY_LIMIT = 100;
class Storage {
  constructor(userDataPath) {
    this.filePath = pathModule.join(userDataPath, "clipboard-history.json");
    this.data = this._load();
  }
  _load() {
    try {
      if (fs.existsSync(this.filePath)) {
        return JSON.parse(fs.readFileSync(this.filePath, "utf-8"));
      }
    } catch (e) {
      console.error("[Storage] load failed:", e.message);
    }
    return { items: [], settings: { historyLimit: DEFAULT_HISTORY_LIMIT } };
  }
  _save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), "utf-8");
    } catch (e) {
      console.error("[Storage] save failed:", e.message);
    }
  }
  getItems() {
    return this.data.items;
  }
  getSettings() {
    return { historyLimit: DEFAULT_HISTORY_LIMIT, ...this.data.settings };
  }
  updateSettings(newSettings) {
    this.data.settings = { ...this.getSettings(), ...newSettings };
    const limit = this.data.settings.historyLimit;
    const pinned = this.data.items.filter((i) => i.isPinned);
    const fresh = this.data.items.filter((i) => !i.isPinned);
    if (fresh.length > limit) {
      this.data.items = [...pinned, ...fresh.slice(0, limit)];
    }
    this._save();
    return { settings: this.data.settings, items: this.data.items };
  }
  addItem(item) {
    const limit = this.getSettings().historyLimit;
    const unpinned = this.data.items.filter((i) => !i.isPinned);
    const last = unpinned[0];
    if (last) {
      if (item.type === "image" && last.type === "image") {
        if (item.content.slice(0, 150) === last.content.slice(0, 150)) return false;
      } else if (item.type !== "image" && last.type !== "image") {
        if (item.content === last.content) return false;
      }
    }
    this.data.items.unshift(item);
    const pinned = this.data.items.filter((i) => i.isPinned);
    const fresh = this.data.items.filter((i) => !i.isPinned);
    if (fresh.length > limit) {
      this.data.items = [...pinned, ...fresh.slice(0, limit)];
    }
    this._save();
    return true;
  }
  togglePin(id) {
    const item = this.data.items.find((i) => i.id === id);
    if (item) {
      item.isPinned = !item.isPinned;
      this._save();
    }
    return this.data.items;
  }
  deleteItem(id) {
    this.data.items = this.data.items.filter((i) => i.id !== id);
    this._save();
    return this.data.items;
  }
  clearHistory() {
    this.data.items = this.data.items.filter((i) => i.isPinned);
    this._save();
    return this.data.items;
  }
}
const crypto = require("crypto");
const MAX_TEXT_BYTES = 1024 * 1024;
const POLL_INTERVAL_MS = 800;
class ClipboardMonitor {
  constructor(clipboardModule, nativeImageModule, onNewItem) {
    this.clipboard = clipboardModule;
    this.nativeImage = nativeImageModule;
    this.onNewItem = onNewItem;
    this.lastTextContent = "";
    this.lastImageSignature = "";
    this.interval = null;
    this.isPaused = false;
  }
  start() {
    this.lastTextContent = this.clipboard.readText();
    try {
      const img = this.clipboard.readImage();
      this.lastImageSignature = img.isEmpty() ? "" : img.toDataURL().slice(0, 150);
    } catch {
      this.lastImageSignature = "";
    }
    this.interval = setInterval(() => this._poll(), POLL_INTERVAL_MS);
  }
  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }
  pause() {
    this.isPaused = true;
  }
  resume() {
    this.isPaused = false;
  }
  async _poll() {
    if (this.isPaused) return;
    const formats = this.clipboard.availableFormats();
    const hasImage = formats.some(
      (f) => f.startsWith("image/") || [
        "public.png",
        "public.tiff",
        "public.jpeg",
        "com.apple.tiff",
        "NSFilenamesPboardType"
      ].includes(f)
    );
    if (hasImage) {
      let img;
      try {
        img = this.clipboard.readImage();
      } catch {
      }
      if (img && !img.isEmpty()) {
        const dataURL = img.toDataURL();
        const signature = dataURL.slice(0, 150);
        if (signature !== this.lastImageSignature) {
          this.lastImageSignature = signature;
          this.lastTextContent = "";
          if (dataURL.length > MAX_IMAGE_DATA_URL) return;
          const sourceApp2 = await this._getActiveApp();
          this.onNewItem({
            id: crypto.randomUUID(),
            content: dataURL,
            type: "image",
            sourceApp: sourceApp2,
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            isPinned: false
          });
          return;
        }
      }
    }
    let content;
    try {
      content = this.clipboard.readText();
    } catch {
      return;
    }
    if (content === this.lastTextContent) return;
    this.lastTextContent = content;
    this.lastImageSignature = "";
    if (!content || content.trim() === "") return;
    if (Buffer.byteLength(content, "utf-8") > MAX_TEXT_BYTES) return;
    const trimmed = content.trim();
    const sourceApp = await this._getActiveApp();
    this.onNewItem({
      id: crypto.randomUUID(),
      content: trimmed,
      type: this._detectType(trimmed),
      sourceApp,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      isPinned: false
    });
  }
  _detectType(content) {
    if (/^https?:\/\//i.test(content)) return "link";
    if (content.includes("\n") && /[{};=>\(\)<>]/.test(content)) return "code";
    return "text";
  }
  _getActiveApp() {
    const { exec: exec2 } = require("child_process");
    return new Promise((resolve) => {
      exec2(
        `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`,
        { timeout: 500 },
        (err, stdout) => resolve(err ? "Unknown" : stdout.trim())
      );
    });
  }
}
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
  dialog
} = require("electron");
const path = require("path");
const { exec } = require("child_process");
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}
let panelWindow = null;
let tray = null;
let isVisible = false;
let isPaused = false;
let previousApp = "Finder";
let monitor = null;
let storage = null;
const appTracker = setInterval(() => {
  if (!isVisible) {
    exec(
      `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`,
      { timeout: 500 },
      (err, stdout) => {
        if (!err && stdout.trim()) previousApp = stdout.trim();
      }
    );
  }
}, 700);
function writeItemToClipboard(item) {
  if (item.type === "image") {
    clipboard.writeImage(nativeImage.createFromDataURL(item.content));
  } else {
    clipboard.writeText(item.content);
  }
}
function createPanelWindow() {
  const primary = screen.getPrimaryDisplay();
  const { x, y, width, height } = primary.workArea;
  panelWindow = new BrowserWindow({
    width,
    height,
    x,
    y,
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
      preload: path.join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });
  panelWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  panelWindow.setAlwaysOnTop(true, "screen-saver");
  if (process.env["ELECTRON_RENDERER_URL"]) {
    panelWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    panelWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
function showPanel() {
  if (!panelWindow) return;
  panelWindow.show();
  panelWindow.focus();
  isVisible = true;
  panelWindow.webContents.send("panel-show", { items: storage.getItems(), isPaused, settings: storage.getSettings() });
}
function hidePanel() {
  if (!panelWindow || !isVisible) return;
  isVisible = false;
  panelWindow.webContents.send("panel-hide");
  setTimeout(() => {
    if (!isVisible) panelWindow.hide();
  }, 320);
}
function togglePanel() {
  isVisible ? hidePanel() : showPanel();
}
function createTray() {
  const img = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
  );
  img.setTemplateImage(true);
  tray = new Tray(img);
  tray.setToolTip("Memory Panel  —  ⌘P");
  rebuildTrayMenu();
  tray.on("click", togglePanel);
}
function rebuildTrayMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: "Show / Hide Panel", accelerator: "CmdOrCtrl+P", click: togglePanel },
    { type: "separator" },
    {
      label: isPaused ? "Resume Tracking" : "Pause Tracking",
      click: () => {
        isPaused = !isPaused;
        isPaused ? monitor.pause() : monitor.resume();
        if (panelWindow && isVisible) panelWindow.webContents.send("tracking-state", isPaused);
        rebuildTrayMenu();
      }
    },
    {
      label: "Clear History",
      click: () => {
        const items = storage.clearHistory();
        if (panelWindow && isVisible) panelWindow.webContents.send("items-updated", items);
      }
    },
    { type: "separator" },
    { label: "Quit Memory Panel", click: () => app.quit() }
  ]));
}
app.whenReady().then(() => {
  if (app.dock) app.dock.hide();
  storage = new Storage(app.getPath("userData"));
  monitor = new ClipboardMonitor(clipboard, nativeImage, (item) => {
    const added = storage.addItem(item);
    if (added && isVisible && panelWindow) {
      panelWindow.webContents.send("items-updated", storage.getItems());
    }
  });
  monitor.start();
  createPanelWindow();
  createTray();
  if (!globalShortcut.register("CommandOrControl+P", togglePanel)) {
    console.warn("[Shortcuts] Cmd+P could not be registered");
  }
});
app.on("will-quit", () => {
  globalShortcut.unregisterAll();
  clearInterval(appTracker);
  if (monitor) monitor.stop();
});
app.on("window-all-closed", (e) => e.preventDefault());
ipcMain.on("close-panel", () => hidePanel());
ipcMain.on("overlay-click", () => hidePanel());
ipcMain.handle("get-items", () => storage.getItems());
ipcMain.handle("paste-item", (_, id) => {
  const item = storage.getItems().find((i) => i.id === id);
  if (!item) return;
  writeItemToClipboard(item);
  hidePanel();
  const target = previousApp;
  setTimeout(() => {
    exec(`osascript -e 'tell application "${target}" to activate'`, { timeout: 1e3 }, () => {
      setTimeout(() => {
        exec(`osascript -e 'tell application "System Events" to keystroke "v" using command down'`, { timeout: 1e3 });
      }, 120);
    });
  }, 340);
});
ipcMain.handle("copy-item", (_, id) => {
  const item = storage.getItems().find((i) => i.id === id);
  if (item) writeItemToClipboard(item);
  hidePanel();
});
ipcMain.handle("toggle-pin", (_, id) => storage.togglePin(id));
ipcMain.handle("delete-item", (_, id) => storage.deleteItem(id));
ipcMain.handle("clear-history", () => storage.clearHistory());
ipcMain.handle("get-settings", () => storage.getSettings());
ipcMain.handle("update-settings", (_, newSettings) => storage.updateSettings(newSettings));
ipcMain.on("toggle-pause", (_, paused) => {
  isPaused = paused;
  paused ? monitor.pause() : monitor.resume();
  rebuildTrayMenu();
});
ipcMain.handle("copy-multiple", (_, ids) => {
  const allItems = storage.getItems();
  const textItems = ids.map((id) => allItems.find((i) => i.id === id)).filter((i) => i && i.type !== "image");
  if (textItems.length === 0) return { success: false, reason: "no-text-items" };
  const combined = textItems.map((i) => i.content).join("\n\n---\n\n");
  clipboard.writeText(combined);
  hidePanel();
  return { success: true, count: textItems.length };
});
ipcMain.handle("save-item", async (_, id) => {
  const item = storage.getItems().find((i) => i.id === id);
  if (!item) return { success: false, error: "Item not found" };
  try {
    if (item.type === "image") {
      const { canceled, filePath } = await dialog.showSaveDialog(panelWindow, {
        defaultPath: `clipboard-image-${Date.now()}.png`,
        filters: [{ name: "PNG Image", extensions: ["png"] }]
      });
      if (canceled || !filePath) return { success: false };
      const base64Data = item.content.replace(/^data:image\/\w+;base64,/, "");
      fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));
      return { success: true, filePath };
    } else {
      const { canceled, filePath } = await dialog.showSaveDialog(panelWindow, {
        defaultPath: `clipboard-${item.type}-${Date.now()}.txt`,
        filters: [{ name: "Text File", extensions: ["txt"] }]
      });
      if (canceled || !filePath) return { success: false };
      fs.writeFileSync(filePath, item.content, "utf-8");
      return { success: true, filePath };
    }
  } catch (err) {
    console.error("[save-item] error:", err.message);
    return { success: false, error: err.message };
  }
});
