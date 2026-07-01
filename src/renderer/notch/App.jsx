import React, { useCallback, useEffect, useRef, useState } from 'react'

const KIND_LABEL = { link: 'Link', code: 'Code', text: 'Text' }

export default function App() {
  const [notchState, setNotchState] = useState('base')
  const [payload, setPayload] = useState(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [dropResult, setDropResult] = useState(null) // null | 'saving' | 'saved'
  const dragCounter = useRef(0)
  const resetTimer = useRef(null)

  useEffect(() => {
    window.carpetAPI.onNotchState(({ state, payload }) => {
      setNotchState(state)
      setPayload(payload)
    })
  }, [])

  const handleClick = useCallback(() => {
    if (notchState === 'base' && !isDragOver) window.carpetAPI.click()
  }, [notchState, isDragOver])

  // dragenter/dragover/drop are native browser drag events, delivered even
  // while the OS drag session originates from another app (e.g. Finder).
  const handleDragEnter = useCallback((e) => {
    e.preventDefault()
    dragCounter.current += 1
    setIsDragOver(true)
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
    setDropResult('saving')
    await window.carpetAPI.dropFiles(paths)
    setDropResult('saved')
    clearTimeout(resetTimer.current)
    resetTimer.current = setTimeout(() => setDropResult(null), 1400)
  }, [])

  const handleKeep = useCallback(() => window.carpetAPI.keepToast(), [])
  const handleDismiss = useCallback(() => window.carpetAPI.dismissToast(), [])

  return (
    <div
      className={`notch notch--${notchState} ${isDragOver ? 'notch--dragover' : ''}`}
      onClick={handleClick}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {notchState === 'base' && (
        <div className="notch__base">
          {dropResult === 'saved' ? (
            <span className="notch__status notch__status--ok">
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
              </svg>
              Saved
            </span>
          ) : dropResult === 'saving' ? (
            <span className="notch__status">Saving…</span>
          ) : isDragOver ? (
            <span className="notch__status notch__status--drag">
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
                <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z" />
              </svg>
              Drop to save
            </span>
          ) : (
            <span className="notch__dot" />
          )}
        </div>
      )}

      {notchState === 'toast' && payload && (
        <div className="notch__toast">
          <div className="notch__toast-row">
            {KIND_LABEL[payload.kind] && <span className="notch__badge">{KIND_LABEL[payload.kind]}</span>}
            <span className="notch__toast-preview">{payload.content.slice(0, 100)}</span>
          </div>
          <div className="notch__toast-actions">
            <button className="notch__btn notch__btn--dismiss" onClick={handleDismiss}>Dismiss</button>
            <button className="notch__btn notch__btn--keep" onClick={handleKeep}>Keep</button>
          </div>
          <div className="notch__timer-track"><div key={payload.tempId} className="notch__timer-bar" /></div>
        </div>
      )}
    </div>
  )
}
