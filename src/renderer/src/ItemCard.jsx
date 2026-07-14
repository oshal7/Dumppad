import React from 'react'

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

const NOTE_STYLE = {
  text: 'card--note-text',
  link: 'card--note-link',
  code: 'card--note-code',
}

export default function ItemCard({ item, onOpen, onCopy, onDelete }) {
  const isNote = item.kind === 'text' || item.kind === 'link' || item.kind === 'code'

  return (
    <div className={`card ${isNote ? `card--note ${NOTE_STYLE[item.kind]}` : ''}`}>
      {item.kind === 'image' ? (
        <img className="card__image" src={item.fileUrl} alt={item.originalName || 'Saved image'} draggable={false} loading="lazy" />
      ) : item.kind === 'file' ? (
        <div className="card__file">
          <svg viewBox="0 0 16 16" fill="currentColor" width="26" height="26">
            <path d="M9.293 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.707A1 1 0 0 0 13.707 4L10 .293A1 1 0 0 0 9.293 0zM9.5 3.5v-2l3 3h-2a1 1 0 0 1-1-1z" />
          </svg>
          <span className="card__file-name">{item.originalName}</span>
        </div>
      ) : (
        <p className={`card__note-text ${item.kind === 'code' ? 'card__note-text--code' : ''}`}>
          {item.content.length > 480 ? `${item.content.slice(0, 480)}…` : item.content}
        </p>
      )}

      {item.aiDescription && item.kind !== 'text' && item.kind !== 'link' && item.kind !== 'code' && (
        <p className="card__ai-desc">{item.aiDescription}</p>
      )}

      <div className="card__footer">
        <span className="card__time">{formatRelativeTime(item.timestamp)}</span>
        <div className="card__actions">
          {(item.kind === 'image' || item.kind === 'file') && (
            <button className="card__btn" onClick={() => onOpen(item.id)} title="Reveal in Finder">
              <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M8.5 1.5A.5.5 0 0 1 9 1h5a.5.5 0 0 1 .5.5v5a.5.5 0 0 1-1 0V2.707L8.354 8.854a.5.5 0 1 1-.708-.708L13.793 2H9a.5.5 0 0 1-.5-.5z"/><path d="M4.5 3a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5h9a.5.5 0 0 0 .5-.5V8a.5.5 0 0 1 1 0v4.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 3 12.5v-9A1.5 1.5 0 0 1 4.5 2H9a.5.5 0 0 1 0 1H4.5z"/></svg>
            </button>
          )}
          {item.kind !== 'file' && (
            <button className="card__btn" onClick={() => onCopy(item.id)} title="Copy">
              <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M13 0H6a2 2 0 0 0-2 2 2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2 2 2 0 0 0 2-2V2a2 2 0 0 0-2-2zm0 13V4a2 2 0 0 0-2-2H5a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1zM3 4a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4z"/></svg>
            </button>
          )}
          <button className="card__btn card__btn--danger" onClick={() => onDelete(item.id)} title="Delete">
            <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12">
              <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z" />
              <path fillRule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
