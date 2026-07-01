import { exec } from 'child_process'

const POLL_INTERVAL_MS = 700
const MIN_PROMPT_LENGTH = 25
const MAX_TEXT_BYTES = 1024 * 1024

function detectKind(content) {
  if (/^https?:\/\/\S+$/i.test(content.trim())) return 'link'
  if (content.includes('\n') && /[{};=>\(\)<>]/.test(content)) return 'code'
  return 'text'
}

function getActiveApp() {
  return new Promise((resolve) => {
    exec(
      `osascript -e 'tell application "System Events" to get name of first application process whose frontmost is true'`,
      { timeout: 500 },
      (err, stdout) => resolve(err ? null : stdout.trim()),
    )
  })
}

// Watches the system clipboard for new *text* copies and surfaces "candidates"
// worth prompting the user about. Images/files are captured separately via
// drag-and-drop onto the notch, not through this monitor.
export class ClipboardMonitor {
  constructor(clipboardModule, onCandidate) {
    this.clipboard = clipboardModule
    this.onCandidate = onCandidate
    this.lastContent = ''
    this.interval = null
    this.isPaused = false
  }

  start() {
    this.lastContent = this._safeReadText()
    this.interval = setInterval(() => this._poll(), POLL_INTERVAL_MS)
  }

  stop() {
    if (this.interval) { clearInterval(this.interval); this.interval = null }
  }

  pause() { this.isPaused = true }
  resume() { this.isPaused = false }

  _safeReadText() {
    try { return this.clipboard.readText() } catch { return '' }
  }

  async _poll() {
    if (this.isPaused) return

    const content = this._safeReadText()
    if (content === this.lastContent) return
    this.lastContent = content

    if (!content) return
    const trimmed = content.trim()
    if (!trimmed) return
    if (Buffer.byteLength(trimmed, 'utf-8') > MAX_TEXT_BYTES) return

    const kind = detectKind(trimmed)
    const worthPrompting = kind === 'link' || trimmed.length >= MIN_PROMPT_LENGTH
    if (!worthPrompting) return

    const sourceApp = await getActiveApp()
    this.onCandidate({ content: trimmed, kind, sourceApp })
  }
}
