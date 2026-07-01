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

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const KIND_LABEL = { link: 'Link', code: 'Code', text: 'Text', image: 'Image', file: 'File' }

export default function ItemCard({ item, onOpen, onCopy, onDelete }) {
  return (
    <div className="card">
      <div className="card__preview">
        {item.kind === 'image' ? (
          <img className="card__image" src={item.fileUrl} alt={item.originalName || 'Saved image'} draggable={false} />
        ) : item.kind === 'file' ? (
          <div className="card__file-icon">
            <svg viewBox="0 0 16 16" fill="currentColor" width="28" height="28">
              <path d="M9.293 0H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V4.707A1 1 0 0 0 13.707 4L10 .293A1 1 0 0 0 9.293 0zM9.5 3.5v-2l3 3h-2a1 1 0 0 1-1-1z" />
            </svg>
            <span className="card__file-name">{item.originalName}</span>
          </div>
        ) : (
          <p className={`card__text ${item.kind === 'code' ? 'card__text--code' : ''}`}>
            {item.content.slice(0, 260)}
          </p>
        )}
      </div>

      <div className="card__footer">
        <div className="card__meta">
          <span className="card__badge">{KIND_LABEL[item.kind]}</span>
          {item.size ? <span className="card__size">{formatSize(item.size)}</span> : null}
          <span className="card__time">{formatRelativeTime(item.timestamp)}</span>
        </div>
        {item.aiDescription && item.kind !== 'text' && item.kind !== 'link' && item.kind !== 'code' && (
          <p className="card__ai-desc">{item.aiDescription}</p>
        )}
        <div className="card__actions">
          <button className="card__btn" onClick={() => onOpen(item.id)}>
            {item.kind === 'image' || item.kind === 'file' ? 'Reveal' : 'Copy'}
          </button>
          {item.kind !== 'file' && (
            <button className="card__btn" onClick={() => onCopy(item.id)}>Copy</button>
          )}
          <button className="card__btn card__btn--danger" onClick={() => onDelete(item.id)}>Delete</button>
        </div>
      </div>
    </div>
  )
}
