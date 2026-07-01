import React, { useState, useEffect, useRef, useCallback } from 'react'
import ClipboardItem from './components/ClipboardItem'

const FILTERS = [
  { id: 'all',   label: 'All' },
  { id: 'text',  label: 'Text' },
  { id: 'link',  label: 'Links' },
  { id: 'code',  label: 'Code' },
  { id: 'image', label: 'Images' },
]

const LIMIT_OPTIONS = [
  { value: 7,   label: '7' },
  { value: 15,  label: '15' },
  { value: 30,  label: '30' },
  { value: 100, label: 'All' },
]

export default function App() {
  const [items, setItems] = useState([])
  const [isOpen, setIsOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [isPaused, setIsPaused] = useState(false)
  const [activeFilter, setActiveFilter] = useState('all')
  const [isSelectMode, setIsSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [copyFeedback, setCopyFeedback] = useState(null)
  const [historyLimit, setHistoryLimit] = useState(100)
  const searchRef = useRef(null)

  // ── IPC listeners ───────────────────────────────────────────────────────────
  useEffect(() => {
    const api = window.electronAPI

    api.onPanelShow((data) => {
      setItems(data.items)
      setIsPaused(data.isPaused)
      setHistoryLimit(data.settings?.historyLimit ?? 100)
      setSearchQuery('')
      setActiveFilter('all')
      setIsSelectMode(false)
      setSelectedIds(new Set())
      setIsOpen(true)
      setTimeout(() => searchRef.current?.focus(), 80)
    })

    api.onPanelHide(() => {
      setIsOpen(false)
      setIsSelectMode(false)
      setSelectedIds(new Set())
    })

    api.onItemsUpdated((updated) => {
      setItems(updated)
    })

    api.onTrackingState((paused) => {
      setIsPaused(paused)
    })

    return () => {
      ;['panel-show', 'panel-hide', 'items-updated', 'tracking-state'].forEach(
        api.removeAllListeners,
      )
    }
  }, [])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        if (isSelectMode) {
          setIsSelectMode(false)
          setSelectedIds(new Set())
        } else {
          handleClose()
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSelectMode])

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleClose = useCallback(() => {
    setIsOpen(false)
    window.electronAPI.closePanel()
  }, [])

  const handleTogglePause = useCallback(() => {
    const next = !isPaused
    setIsPaused(next)
    window.electronAPI.togglePause(next)
  }, [isPaused])

  const handleClearHistory = useCallback(async () => {
    const updated = await window.electronAPI.clearHistory()
    setItems(updated)
  }, [])

  const handleToggleSelect = useCallback((id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const handleEnterSelectMode = useCallback(() => {
    setIsSelectMode(true)
    setSelectedIds(new Set())
  }, [])

  const handleExitSelectMode = useCallback(() => {
    setIsSelectMode(false)
    setSelectedIds(new Set())
  }, [])

  const handleLimitChange = useCallback(async (limit) => {
    setHistoryLimit(limit)
    const result = await window.electronAPI.updateSettings({ historyLimit: limit })
    setItems(result.items)
  }, [])

  const handleCopySelected = useCallback(async () => {
    const ids = [...selectedIds]
    const result = await window.electronAPI.copyMultiple(ids)
    if (result.success) {
      setCopyFeedback(`Copied ${result.count} item${result.count !== 1 ? 's' : ''}`)
      setTimeout(() => setCopyFeedback(null), 2500)
      handleExitSelectMode()
    } else if (result.reason === 'no-text-items') {
      setCopyFeedback('Images cannot be combined — select text items')
      setTimeout(() => setCopyFeedback(null), 3000)
    }
  }, [selectedIds, handleExitSelectMode])

  // ── Filtering ───────────────────────────────────────────────────────────────
  const q = searchQuery.toLowerCase()
  const filtered = items.filter((item) => {
    if (activeFilter !== 'all' && item.type !== activeFilter) return false
    if (!q) return true
    if (item.type === 'image') {
      return (item.sourceApp || '').toLowerCase().includes(q) || 'image'.includes(q)
    }
    return item.content.toLowerCase().includes(q)
  })
  const pinnedItems = filtered.filter((i) => i.isPinned)
  const recentItems = filtered.filter((i) => !i.isPinned)

  const selectedTextCount = [...selectedIds].filter((id) => {
    const item = items.find((i) => i.id === id)
    return item && item.type !== 'image'
  }).length

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="root">
      {/* Dimmed backdrop */}
      <div
        className={`overlay ${isOpen ? 'overlay--visible' : ''}`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Sliding panel */}
      <aside className={`panel ${isOpen ? 'panel--open' : ''}`}>
        {/* Header */}
        <div className="panel__header">
          <div className="panel__title-row">
            <span className="panel__logo">
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z" />
                <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z" />
              </svg>
            </span>
            <h1 className="panel__title">Memory Panel</h1>
          </div>
          <div className="panel__header-actions">
            <button
              className={`icon-btn ${isSelectMode ? 'icon-btn--active' : ''}`}
              onClick={isSelectMode ? handleExitSelectMode : handleEnterSelectMode}
              title={isSelectMode ? 'Exit selection mode' : 'Select multiple items'}
            >
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
                <path d="M10.97 4.97a.75.75 0 0 1 1.071 1.05l-3.992 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.235.235 0 0 1 .02-.022z"/>
              </svg>
            </button>
            <button
              className={`icon-btn ${isPaused ? 'icon-btn--warning' : ''}`}
              onClick={handleTogglePause}
              title={isPaused ? 'Resume tracking' : 'Pause tracking'}
            >
              {isPaused ? (
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M10.804 8 5 4.633v6.734L10.804 8zm.792-.696a.802.802 0 0 1 0 1.392l-6.363 3.692C4.713 12.69 4 12.345 4 11.692V4.308c0-.653.713-.998 1.233-.696l6.363 3.692z" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M6 3.5a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5zm4 0a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5z" />
                </svg>
              )}
            </button>
            <button className="icon-btn" onClick={handleClose} title="Close panel (Esc)">
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="panel__search">
          <svg className="search__icon" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
          </svg>
          <input
            ref={searchRef}
            type="text"
            className="search__input"
            placeholder="Search clipboard history…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            spellCheck={false}
          />
          {searchQuery && (
            <button className="search__clear" onClick={() => setSearchQuery('')} title="Clear">
              <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
              </svg>
            </button>
          )}
        </div>

        {/* Type filter bar */}
        <div className="filter-bar">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`filter-btn ${activeFilter === f.id ? 'filter-btn--active' : ''}`}
              onClick={() => setActiveFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Paused banner */}
        {isPaused && (
          <div className="pause-banner">
            <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
              <path d="M6 3.5a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5zm4 0a.5.5 0 0 1 .5.5v8a.5.5 0 0 1-1 0V4a.5.5 0 0 1 .5-.5z" />
            </svg>
            Tracking paused
          </div>
        )}

        {/* Select mode banner */}
        {isSelectMode && (
          <div className="select-banner">
            <svg viewBox="0 0 16 16" fill="currentColor" width="13" height="13">
              <path d="M14 1a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1h12zM2 0a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V2a2 2 0 0 0-2-2H2z"/>
              <path d="M10.97 4.97a.75.75 0 0 1 1.071 1.05l-3.992 4.99a.75.75 0 0 1-1.08.02L4.324 8.384a.75.75 0 1 1 1.06-1.06l2.094 2.093 3.473-4.425a.235.235 0 0 1 .02-.022z"/>
            </svg>
            Tap items to select • Esc to cancel
          </div>
        )}

        {/* Content */}
        <div className="panel__content">
          {filtered.length === 0 && (
            <div className="empty-state">
              <div className="empty-state__icon">
                {searchQuery || activeFilter !== 'all' ? (
                  <svg viewBox="0 0 16 16" fill="currentColor">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.099zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z" />
                    <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z" />
                  </svg>
                )}
              </div>
              {searchQuery || activeFilter !== 'all' ? (
                <>
                  <p className="empty-state__title">No results</p>
                  <p className="empty-state__sub">Try a different search term or filter</p>
                </>
              ) : (
                <>
                  <p className="empty-state__title">Nothing copied yet</p>
                  <p className="empty-state__sub">Copy text or images and they'll appear here instantly</p>
                </>
              )}
            </div>
          )}

          {pinnedItems.length > 0 && (
            <section className="section">
              <div className="section__label">
                <svg viewBox="0 0 16 16" fill="currentColor" width="11" height="11">
                  <path d="M4.146.146A.5.5 0 0 1 4.5 0h7a.5.5 0 0 1 .5.5c0 .68-.342 1.174-.646 1.479-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 0 1-.5.5h-4v4.5c0 .276-.224 1.5-.5 1.5s-.5-1.224-.5-1.5V10h-4a.5.5 0 0 1-.5-.5c0-.973.64-1.725 1.17-2.189A5.921 5.921 0 0 1 5 6.708V2.277a2.77 2.77 0 0 1-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 0 1 .146-.354z" />
                </svg>
                Pinned
              </div>
              {pinnedItems.map((item) => (
                <ClipboardItem
                  key={item.id}
                  item={item}
                  onItemsChange={setItems}
                  isSelectMode={isSelectMode}
                  isSelected={selectedIds.has(item.id)}
                  onToggleSelect={handleToggleSelect}
                />
              ))}
            </section>
          )}

          {recentItems.length > 0 && (
            <section className="section">
              <div className="section__label">
                <svg viewBox="0 0 16 16" fill="currentColor" width="11" height="11">
                  <path d="M8 3.5a.5.5 0 0 0-1 0V9a.5.5 0 0 0 .252.434l3.5 2a.5.5 0 0 0 .496-.868L8 8.71V3.5z" />
                  <path d="M8 16A8 8 0 1 0 8 0a8 8 0 0 0 0 16zm7-8A7 7 0 1 1 1 8a7 7 0 0 1 14 0z" />
                </svg>
                Recent
              </div>
              {recentItems.map((item) => (
                <ClipboardItem
                  key={item.id}
                  item={item}
                  onItemsChange={setItems}
                  isSelectMode={isSelectMode}
                  isSelected={selectedIds.has(item.id)}
                  onToggleSelect={handleToggleSelect}
                />
              ))}
            </section>
          )}
        </div>

        {/* Multi-select action bar */}
        {isSelectMode && (
          <div className="select-bar">
            {copyFeedback ? (
              <span className="select-bar__feedback">{copyFeedback}</span>
            ) : (
              <>
                <span className="select-bar__count">
                  {selectedIds.size} selected
                  {selectedIds.size > 0 && selectedTextCount < selectedIds.size && (
                    <span className="select-bar__note"> ({selectedIds.size - selectedTextCount} image{selectedIds.size - selectedTextCount !== 1 ? 's' : ''} will be skipped)</span>
                  )}
                </span>
                <div className="select-bar__actions">
                  <button
                    className="select-bar__btn select-bar__btn--cancel"
                    onClick={handleExitSelectMode}
                  >
                    Cancel
                  </button>
                  <button
                    className="select-bar__btn select-bar__btn--copy"
                    onClick={handleCopySelected}
                    disabled={selectedIds.size === 0}
                  >
                    <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
                      <path d="M13 0H6a2 2 0 0 0-2 2 2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2 2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zm0 13V4a2 2 0 0 0-2-2H5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1zM3 4a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4z" />
                    </svg>
                    Copy Combined
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Footer */}
        {!isSelectMode && (
          <div className="panel__footer">
            <div className="footer__top-row">
              <span className="footer__count">
                {items.filter((i) => !i.isPinned).length} / {historyLimit === 100 ? 'All' : historyLimit} items
              </span>
              <button className="footer__clear-btn" onClick={handleClearHistory}>
                Clear History
              </button>
            </div>
            <div className="footer__limit-row">
              <span className="footer__limit-label">Keep last:</span>
              <div className="footer__limit-pills">
                {LIMIT_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    className={`limit-pill ${historyLimit === opt.value ? 'limit-pill--active' : ''}`}
                    onClick={() => handleLimitChange(opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </aside>
    </div>
  )
}
