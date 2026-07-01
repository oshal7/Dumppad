import React, { useCallback, useEffect, useRef, useState } from 'react'
import ItemCard from './ItemCard'

export default function App() {
  const [items, setItems] = useState([])
  const [query, setQuery] = useState('')
  const [aiAvailable, setAiAvailable] = useState(null) // null = unknown yet
  const [askInput, setAskInput] = useState('')
  const [askLoading, setAskLoading] = useState(false)
  const [askAnswer, setAskAnswer] = useState(null)
  const [askSources, setAskSources] = useState([])
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState(null)
  const debounceRef = useRef(null)

  const runSearch = useCallback(async (q) => {
    const result = await window.carpetAPI.searchItems(q)
    setItems(result)
  }, [])

  useEffect(() => {
    runSearch('')
    window.carpetAPI.getAiStatus().then(setAiAvailable)
    window.carpetAPI.getSettings().then(setSettings)

    window.carpetAPI.onItemsUpdated((updated) => {
      setItems((prev) => (query ? prev : updated))
    })

    const poll = setInterval(() => {
      window.carpetAPI.getAiStatus().then(setAiAvailable)
    }, 15000)
    return () => clearInterval(poll)
  }, [])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => runSearch(query), 220)
    return () => clearTimeout(debounceRef.current)
  }, [query, runSearch])

  const handleOpen = useCallback(async (id) => {
    await window.carpetAPI.openItem(id)
  }, [])

  const handleCopy = useCallback(async (id) => {
    await window.carpetAPI.copyItem(id)
  }, [])

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
    if (result.unavailable) {
      setAskAnswer('Local AI is unavailable — make sure Ollama is running.')
    } else if (!result.answer) {
      setAskAnswer("I couldn't find anything relevant in your Carpet yet.")
    } else {
      setAskAnswer(result.answer)
      setAskSources(result.sources || [])
    }
  }, [askInput, askLoading])

  const handleSettingsChange = useCallback(async (patch) => {
    const updated = await window.carpetAPI.updateSettings(patch)
    setSettings(updated)
  }, [])

  return (
    <div className="app">
      <header className="header">
        <div className="header__brand">
          <span className="header__logo-dot" />
          <h1>Carpet</h1>
        </div>
        <div className="header__search">
          <input
            type="text"
            placeholder="Search everything you've saved…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="header__right">
          <span className={`ai-pill ${aiAvailable ? 'ai-pill--on' : 'ai-pill--off'}`}>
            {aiAvailable === null ? 'Checking AI…' : aiAvailable ? 'Local AI on' : 'Local AI off'}
          </span>
          <button className="icon-btn" title="Settings" onClick={() => setShowSettings((v) => !v)}>
            <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16">
              <path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.858z" />
            </svg>
          </button>
        </div>
      </header>

      {showSettings && settings && (
        <SettingsDrawer settings={settings} onChange={handleSettingsChange} onClose={() => setShowSettings(false)} />
      )}

      <section className="ask">
        <form onSubmit={handleAsk} className="ask__form">
          <input
            type="text"
            placeholder={aiAvailable ? 'Ask Carpet about something you saved…' : 'Ask Carpet (needs local AI)'}
            value={askInput}
            onChange={(e) => setAskInput(e.target.value)}
            disabled={!aiAvailable}
          />
          <button type="submit" disabled={!aiAvailable || askLoading}>{askLoading ? 'Thinking…' : 'Ask'}</button>
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

      <main className="grid-wrap">
        {items.length === 0 ? (
          <div className="empty">
            <p className="empty__title">{query ? 'No results' : 'Your Carpet is empty'}</p>
            <p className="empty__sub">
              {query ? 'Try a different search term.' : 'Copy an article and click "Keep", or drag a file onto the notch.'}
            </p>
          </div>
        ) : (
          <div className="grid">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} onOpen={handleOpen} onCopy={handleCopy} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

function SettingsDrawer({ settings, onChange, onClose }) {
  return (
    <div className="settings">
      <div className="settings__row">
        <label>
          <input
            type="checkbox"
            checked={settings.aiEnabled}
            onChange={(e) => onChange({ aiEnabled: e.target.checked })}
          />
          Enable local AI (Ollama)
        </label>
      </div>
      <div className="settings__row">
        <label>Ollama URL</label>
        <input
          type="text"
          value={settings.ollamaBaseUrl}
          onChange={(e) => onChange({ ollamaBaseUrl: e.target.value })}
        />
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
