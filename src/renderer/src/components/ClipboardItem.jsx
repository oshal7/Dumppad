import React, { useState } from 'react'

const TEXT_PREVIEW_LENGTH = 200

function formatRelativeTime(isoString) {
  const diff = Date.now() - new Date(isoString).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function TypeBadge({ type }) {
  const map = {
    link:  { label: 'Link',  color: '#1a7bbf' },
    code:  { label: 'Code',  color: '#2a8c4a' },
    image: { label: 'Image', color: '#b96f00' },
    text:  { label: null,    color: null },
  }
  const t = map[type] || map.text
  if (!t.label) return null
  return (
    <span className="type-badge" style={{ color: t.color, borderColor: `${t.color}40`, background: `${t.color}14` }}>
      {t.label}
    </span>
  )
}

function TextPreview({ item }) {
  const preview = item.content.length > TEXT_PREVIEW_LENGTH
    ? item.content.slice(0, TEXT_PREVIEW_LENGTH) + '…'
    : item.content

  return (
    <pre className={`item__preview ${item.type === 'code' ? 'item__preview--code' : ''}`}>
      {item.type === 'link' ? (
        <span className="item__link">{preview}</span>
      ) : preview}
    </pre>
  )
}

function ImagePreview({ dataURL }) {
  return (
    <div className="item__image-wrap">
      <img className="item__image" src={dataURL} alt="Clipboard image" draggable={false} />
    </div>
  )
}

export default function ClipboardItem({ item, onItemsChange, isSelectMode, isSelected, onToggleSelect }) {
  const [hovering, setHovering] = useState(false)
  const [pressing, setPressing] = useState(false)
  const [saveState, setSaveState] = useState(null) // null | 'saving' | 'saved' | 'error'

  async function handlePaste(e) {
    e.stopPropagation()
    await window.electronAPI.pasteItem(item.id)
  }

  async function handleCopy(e) {
    e.stopPropagation()
    await window.electronAPI.copyItem(item.id)
  }

  async function handleTogglePin(e) {
    e.stopPropagation()
    const updated = await window.electronAPI.togglePin(item.id)
    onItemsChange(updated)
  }

  async function handleDelete(e) {
    e.stopPropagation()
    const updated = await window.electronAPI.deleteItem(item.id)
    onItemsChange(updated)
  }

  async function handleSave(e) {
    e.stopPropagation()
    setSaveState('saving')
    const result = await window.electronAPI.saveItem(item.id)
    if (result.success) {
      setSaveState('saved')
      setTimeout(() => setSaveState(null), 2000)
    } else {
      setSaveState('error')
      setTimeout(() => setSaveState(null), 2000)
    }
  }

  function handleItemClick(e) {
    if (isSelectMode) {
      e.stopPropagation()
      onToggleSelect(item.id)
    } else {
      handlePaste(e)
    }
  }

  return (
    <div
      className={[
        'item',
        item.isPinned ? 'item--pinned' : '',
        pressing ? 'item--pressing' : '',
        isSelectMode ? 'item--selectable' : '',
        isSelected ? 'item--selected' : '',
      ].filter(Boolean).join(' ')}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => { setHovering(false); setPressing(false) }}
      onMouseDown={() => setPressing(true)}
      onMouseUp={() => setPressing(false)}
      onClick={handleItemClick}
    >
      {/* Selection checkbox */}
      {isSelectMode && (
        <div className={`item__checkbox ${isSelected ? 'item__checkbox--checked' : ''}`}>
          {isSelected && (
            <svg viewBox="0 0 16 16" fill="currentColor" width="10" height="10">
              <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
            </svg>
          )}
        </div>
      )}

      {/* Top meta row */}
      <div className="item__meta-row">
        <div className="item__meta-left">
          {item.isPinned && (
            <svg className="item__pin-dot" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.146.146A.5.5 0 0 1 4.5 0h7a.5.5 0 0 1 .5.5c0 .68-.342 1.174-.646 1.479-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 0 1-.5.5h-4v4.5c0 .276-.224 1.5-.5 1.5s-.5-1.224-.5-1.5V10h-4a.5.5 0 0 1-.5-.5c0-.973.64-1.725 1.17-2.189A5.921 5.921 0 0 1 5 6.708V2.277a2.77 2.77 0 0 1-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 0 1 .146-.354z" />
            </svg>
          )}
          <TypeBadge type={item.type} />
          {item.sourceApp && item.sourceApp !== 'Unknown' && (
            <span className="item__source">{item.sourceApp}</span>
          )}
        </div>
        <span className="item__time">{formatRelativeTime(item.timestamp)}</span>
      </div>

      {/* Content preview */}
      {item.type === 'image' ? (
        <ImagePreview dataURL={item.content} />
      ) : (
        <TextPreview item={item} />
      )}

      {/* Hover action bar — hidden in select mode */}
      {hovering && !isSelectMode && (
        <div className="item__actions" onClick={(e) => e.stopPropagation()}>
          <button className="action-btn action-btn--primary" onClick={handlePaste}>
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 1.5H3a2 2 0 0 0-2 2V14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V3.5a2 2 0 0 0-2-2h-1v1h1a1 1 0 0 1 1 1V14a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V3.5a1 1 0 0 1 1-1h1v-1z" />
              <path d="M9.5 1a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5h3zm-3-1A1.5 1.5 0 0 0 5 1.5v1A1.5 1.5 0 0 0 6.5 4h3A1.5 1.5 0 0 0 11 2.5v-1A1.5 1.5 0 0 0 9.5 0h-3z" />
            </svg>
            Paste
          </button>
          <button className="action-btn" onClick={handleCopy}>
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M13 0H6a2 2 0 0 0-2 2 2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2 2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zm0 13V4a2 2 0 0 0-2-2H5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1zM3 4a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4z" />
            </svg>
            Copy
          </button>
          <button
            className={`action-btn ${saveState === 'saved' ? 'action-btn--saved' : saveState === 'error' ? 'action-btn--danger' : ''}`}
            onClick={handleSave}
            disabled={saveState === 'saving'}
            title={item.type === 'image' ? 'Save as PNG' : 'Save as .txt'}
          >
            {saveState === 'saved' ? (
              <>
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
                </svg>
                Saved
              </>
            ) : saveState === 'error' ? (
              <>
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16z"/>
                  <path d="M7.002 11a1 1 0 1 1 2 0 1 1 0 0 1-2 0zM7.1 4.995a.905.905 0 1 1 1.8 0l-.35 3.507a.552.552 0 0 1-1.1 0L7.1 4.995z"/>
                </svg>
                Error
              </>
            ) : (
              <>
                <svg viewBox="0 0 16 16" fill="currentColor">
                  <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z"/>
                  <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z"/>
                </svg>
                Save
              </>
            )}
          </button>
          <button className={`action-btn ${item.isPinned ? 'action-btn--active' : ''}`} onClick={handleTogglePin}>
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.146.146A.5.5 0 0 1 4.5 0h7a.5.5 0 0 1 .5.5c0 .68-.342 1.174-.646 1.479-.126.125-.25.224-.354.298v4.431l.078.048c.203.127.476.314.751.555C12.36 7.775 13 8.527 13 9.5a.5.5 0 0 1-.5.5h-4v4.5c0 .276-.224 1.5-.5 1.5s-.5-1.224-.5-1.5V10h-4a.5.5 0 0 1-.5-.5c0-.973.64-1.725 1.17-2.189A5.921 5.921 0 0 1 5 6.708V2.277a2.77 2.77 0 0 1-.354-.298C4.342 1.674 4 1.179 4 .5a.5.5 0 0 1 .146-.354z" />
            </svg>
            {item.isPinned ? 'Unpin' : 'Pin'}
          </button>
          <button className="action-btn action-btn--danger" onClick={handleDelete}>
            <svg viewBox="0 0 16 16" fill="currentColor">
              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
              <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
            </svg>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
