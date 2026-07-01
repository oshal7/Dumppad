import React, { useCallback, useEffect, useRef, useState } from 'react'
import ItemCard from './ItemCard'

const KIND_LABEL = { link: 'Link', code: 'Code', text: 'Text' }

export default function App() {
  const [panelState, setPanelState] = useState('collapsed')
  const [pinned, setPinned] = useState(false)
  const [pendingToast, setPendingToast] = useState(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [dropStatus, setDropStatus] = useState(null) // null | 'saving' | 'saved'

  const [items, setItems] = useState([])
  const [query, setQuery] = useState('')
  const [aiAvailable, setAiAvailable] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState(null)
  const [showAsk, setShowAsk] = useState(false)
  const [askInput, setAskInput] = useState('')
  const [askLoading, setAskLoading] = useState(false)
  const [askAnswer, setAskAnswer] = useState(null)
  const [askSources, setAskSources] = useState([])

  const dragCounter = useRef(0)
  const debounceRef = useRef(null)

  const runSearch = useCallback(async (q) => {
    const result = await window.carpetAPI.searchItems(q)
    setItems(result)
  }, [])

  useEffect(() => {
    runSearch('')
    window.carpetAPI.getAiStatus().then(setAiAvailable)
    window.carpetAPI.getSettings().then(setSettings)

    window.carpetAPI.onPanelState(({ state, pinned }) => {
      setPanelState(state)
      setPinned(pinned)
    })

    window.carpetAPI.onToastUpdated((toast) => setPendingToast(toast))

    window.carpetAPI.onItemsUpdated((updated) => {
      setItems((prev) => (query ? prev : updated))
    })

    const poll = setInterval(() => window.carpetAPI.getAiStatus().then(setAiAvailable), 15000)
    return () => clearInterval(poll)
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(query), 220)
    return () => clearTimeout(debounceRef.current)
  }, [query, runSearch])

  // ── Hover / drag to expand ───────────────────────────────────────────────
  const handleMouseEnter = useCallback(() => window.carpetAPI.hoverEnter(), [])
  const handleMouseLeave = useCallback(() => window.carpetAPI.hoverLeave(), [])

  const handleDragEnter = useCallback((e) => {
    e.preventDefault()
    dragCounter.current += 1
    setIsDragOver(true)
    window.carpetAPI.dragEnter()
  }, [])

  const handleDragOver = useCallback((e) => e.preventDefault(), [])

  const handleDragLeave = useCallback(() => {
    dragCounter.current -= 1
    if (dragCounter.current <= 0) {
      dragCounter.current = 0
      setIsDragOver(false)
    }
  }, [])

  const handleDrop = useCallback(async (e) => {
    e.preventDefault()
    dragCounter.current = 0
    setIsDragOver(false)
    const files = [...e.dataTransfer.files]
    if (files.length === 0) return

    const paths = files.map((f) => window.carpetAPI.getPathForFile(f))
    setDropStatus('saving')
    await window.carpetAPI.dropFiles(paths)
    setDropStatus('saved')
    setTimeout(() => setDropStatus(null), 1400)
  }, [])

  // ── Toast (keep this?) ───────────────────────────────────────────────────
  const handleKeep = useCallback(() => window.carpetAPI.keepToast(), [])
  const handleDismiss = useCallback(() => window.carpetAPI.dismissToast(), [])

  // ── Item actions ─────────────────────────────────────────────────────────
  const handleOpen = useCallback((id) => window.carpetAPI.openItem(id), [])
  const handleCopy = useCallback((id) => window.carpetAPI.copyItem(id), [])
  const handleDelete = useCallback(async (id) => {
    const updated = await window.carpetAPI.deleteItem(id)
    setItems(updated)
  }, [])

  const handleAsk = useCallback(async (e) => {
    e.preventDefault()
    if (!askInput.trim() || askLoading) return
    setAskLoading(true)
    setAskAnswer(null)
    setAskSources([])
    const result = await window.carpetAPI.askAI(askInput.trim())
    setAskLoading(false)
    if (result.unavailable) setAskAnswer('Local AI is unavailable — make sure Ollama is running.')
    else if (!result.answer) setAskAnswer("Nothing relevant found in your Carpet yet.")
    else {
      setAskAnswer(result.answer)
      setAskSources(result.sources || [])
    }
  }, [askInput, askLoading])

  const handleSettingsChange = useCallback(async (patch) => {
    setSettings(await window.carpetAPI.updateSettings(patch))
  }, [])

  const isExpanded = panelState === 'expanded'

  return (
    <div
      className={`panel panel--${panelState} ${isDragOver ? 'panel--dragover' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {!isExpanded && (
        <div className="edge">
          {isDragOver ? (
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" className="edge__icon edge__icon--active">
              <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
              <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z" />
            </svg>
          ) : (
            <span className="edge__dot" />
          )}
        </div>
      )}

      {isExpanded && (
        <div className="board-root">
          <header className="header">
            <button className={`icon-btn ${pinned ? 'icon-btn--active' : ''}`} title={pinned ? 'Unpin' : 'Keep open'} onClick={() => window.carpetAPI.togglePin()}>
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                <path d="M4.146.146A.5.5 0 0 1 4.5 0h7a.5.5 0 0 1 .5.5c0 .68-.342 1.174-.646 1.479-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 0 1-.5.5h-4v4.5c0 .276-.224 1.5-.5 1.5s-.5-1.224-.5-1.5V10h-4a.5.5 0 0 1-.5-.5c0-.973.64-1.725 1.17-2.189A5.921 5.921 0 0 1 5 6.708V2.277a2.77 2.77 0 0 1-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 0 1 .146-.354z" />
              </svg>
            </button>
            <input
              type="text"
              className="header__search"
              placeholder="Search your Carpet…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <span className={`ai-dot ${aiAvailable ? 'ai-dot--on' : ''}`} title={aiAvailable ? 'Local AI on' : 'Local AI off'} />
            <button className="icon-btn" title="Ask AI" onClick={() => setShowAsk((v) => !v)}>
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z" />
                <path d="M5.255 5.786a.237.237 0 0 0 .241.247h.825c.138 0 .248-.113.266-.25.09-.656.54-1.134 1.342-1.134.686 0 1.314.343 1.314 1.168 0 .635-.374.927-.965 1.371-.673.489-1.206 1.06-1.168 1.987l.003.217a.25.25 0 0 0 .25.246h.811a.25.25 0 0 0 .25-.25v-.105c0-.718.273-.927 1.01-1.486.609-.463 1.244-.977 1.244-2.056 0-1.511-1.276-2.241-2.673-2.241-1.267 0-2.655.59-2.75 2.286zm1.557 5.763c0 .533.425.927 1.01.927.609 0 1.028-.394 1.028-.927 0-.552-.42-.94-1.029-.94-.584 0-1.009.388-1.009.94z" />
              </svg>
            </button>
            <button className="icon-btn" title="Settings" onClick={() => setShowSettings((v) => !v)}>
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z" />
              </svg>
            </button>
          </header>

          {showSettings && settings && (
            <SettingsDrawer settings={settings} onChange={handleSettingsChange} onClose={() => setShowSettings(false)} />
          )}

          {showAsk && (
            <section className="ask">
              <form onSubmit={handleAsk} className="ask__form">
                <input
                  type="text"
                  placeholder={aiAvailable ? 'Ask about something you saved…' : 'Needs local AI (Ollama)'}
                  value={askInput}
                  onChange={(e) => setAskInput(e.target.value)}
                  disabled={!aiAvailable}
                />
                <button type="submit" disabled={!aiAvailable || askLoading}>{askLoading ? '…' : 'Ask'}</button>
              </form>
              {askAnswer && (
                <div className="ask__answer">
                  <p>{askAnswer}</p>
                  {askSources.length > 0 && (
                    <div className="ask__sources">
                      {askSources.map((s) => (
                        <span key={s.id} className="ask__source-chip">
                          {s.kind === 'image' || s.kind === 'file' ? s.originalName : s.content.slice(0, 40)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {pendingToast && (
            <div className="toast">
              <div className="toast__row">
                {KIND_LABEL[pendingToast.kind] && <span className="toast__badge">{KIND_LABEL[pendingToast.kind]}</span>}
                <span className="toast__preview">{pendingToast.content.slice(0, 160)}</span>
              </div>
              <div className="toast__actions">
                <button className="toast__btn toast__btn--dismiss" onClick={handleDismiss}>Dismiss</button>
                <button className="toast__btn toast__btn--keep" onClick={handleKeep}>Keep</button>
              </div>
              <div className="toast__timer-track"><div key={pendingToast.tempId} className="toast__timer-bar" /></div>
            </div>
          )}

          <main className="board-scroll">
            {isDragOver && (
              <div className="dropzone-overlay">
                <svg viewBox="0 0 16 16" fill="currentColor" width="28" height="28">
                  <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
                  <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z" />
                </svg>
                <span>Drop to save to Carpet</span>
              </div>
            )}
            {dropStatus === 'saved' && <div className="drop-toast">Saved to Carpet</div>}

            {items.length === 0 ? (
              <div className="empty">
                <p className="empty__title">{query ? 'No results' : 'Your Carpet is empty'}</p>
                <p className="empty__sub">
                  {query ? 'Try a different search term.' : 'Drag a file or image here, or copy an article and click Keep.'}
                </p>
              </div>
            ) : (
              <div className="board">
                {items.map((item) => (
                  <ItemCard key={item.id} item={item} onOpen={handleOpen} onCopy={handleCopy} onDelete={handleDelete} />
                ))}
              </div>
            )}
          </main>
        </div>
      )}
    </div>
  )
}

function SettingsDrawer({ settings, onChange, onClose }) {
  return (
    <div className="settings">
      <div className="settings__row">
        <label>
          <input type="checkbox" checked={settings.aiEnabled} onChange={(e) => onChange({ aiEnabled: e.target.checked })} />
          Enable local AI (Ollama)
        </label>
      </div>
      <div className="settings__row">
        <label>Ollama URL</label>
        <input type="text" value={settings.ollamaBaseUrl} onChange={(e) => onChange({ ollamaBaseUrl: e.target.value })} />
      </div>
      <div className="settings__row">
        <label>Embedding model</label>
        <input type="text" value={settings.embedModel} onChange={(e) => onChange({ embedModel: e.target.value })} />
      </div>
      <div className="settings__row">
        <label>Vision model</label>
        <input type="text" value={settings.visionModel} onChange={(e) => onChange({ visionModel: e.target.value })} />
      </div>
      <div className="settings__row">
        <label>Chat model</label>
        <input type="text" value={settings.chatModel} onChange={(e) => onChange({ chatModel: e.target.value })} />
      </div>
      <button className="settings__close" onClick={onClose}>Done</button>
    </div>
  )
}
