import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import HoverPreview from './HoverPreview.jsx'
import NotePane from './NotePane.jsx'
import NoteStackContext from './noteContext.js'
import notes, { DEFAULT_NOTE } from './notes.js'

const PANE_WIDTH = 625
const PANE_OFFSET = 40

function getStackFromHash() {
  const hash = window.location.hash.replace(/^#/, '')
  const slugs = hash.split('/').filter(id => notes[id])
  return slugs.length > 0 ? slugs : [DEFAULT_NOTE]
}

function getPaneTargetLeft(index) {
  return Math.max(0, index * PANE_WIDTH - (window.innerWidth - PANE_WIDTH) / 2)
}

export default function App() {
  const [noteStack, setNoteStack] = useState(getStackFromHash)
  const [scrollStates, setScrollStates] = useState([])
  const [preview, setPreview] = useState(null)
  const scrollerRef = useRef(null)
  const columnsRef = useRef(null)
  const hasMountedRef = useRef(false)
  const isHashNavigationRef = useRef(false)

  const scrollToPane = useCallback((index, behavior = 'smooth') => {
    const scroller = scrollerRef.current
    if (!scroller) return
    window.setTimeout(() => {
      scroller.scrollTo({ left: getPaneTargetLeft(index), behavior })
    }, 0)
  }, [])

  const openNote = useCallback((noteId, fromIndex) => {
    if (!notes[noteId]) return

    setNoteStack(prev => {
      const existingIndex = prev.indexOf(noteId)
      if (existingIndex !== -1) {
        scrollToPane(existingIndex)
        return prev
      }

      const newStack = [...prev.slice(0, fromIndex + 1), noteId]
      return newStack
    })
  }, [scrollToPane])

  const resetStack = useCallback(() => {
    setNoteStack([DEFAULT_NOTE])
    setPreview(null)
    scrollToPane(0)
  }, [scrollToPane])

  const backOnePane = useCallback(() => {
    setPreview(null)
    setNoteStack(prev => prev.length > 1 ? prev.slice(0, -1) : [DEFAULT_NOTE])
  }, [])

  useEffect(() => {
    if (noteStack.length === 0) return
    scrollToPane(noteStack.length - 1)
  }, [noteStack.length, scrollToPane])

  useEffect(() => {
    const scroller = scrollerRef.current
    if (!scroller) return

    const updatePaneGeometry = () => {
      const scrollLeft = scroller.scrollLeft
      const panes = columnsRef.current?.querySelectorAll('.note-pane')
      const paneLefts = noteStack.map((_, index) => {
        const stickyLeft = index * PANE_OFFSET
        const naturalLeft = index * PANE_WIDTH - scrollLeft
        return Math.max(stickyLeft, naturalLeft)
      })

      panes?.forEach((pane, index) => {
        const nextLeft = index < paneLefts.length - 1
          ? paneLefts[index + 1]
          : paneLefts[index] + PANE_WIDTH
        const visibleWidth = Math.max(PANE_OFFSET, Math.min(PANE_WIDTH, nextLeft - paneLefts[index]))
        const linear = Math.max(0, Math.min(1, 1 - (visibleWidth - PANE_OFFSET) / (PANE_WIDTH - PANE_OFFSET)))
        const progress = linear * linear * linear
        pane.style.setProperty('--obscured-progress', progress.toFixed(3))
        pane.style.setProperty('--visible-width', `${visibleWidth}px`)
      })

      const states = noteStack.map((_, index) => {
        const naturalLeft = index * PANE_WIDTH - scrollLeft
        if (naturalLeft <= index * PANE_OFFSET) return 'overlay'
        if (naturalLeft > window.innerWidth - PANE_OFFSET) return 'obscured'
        return 'resting'
      })

      setScrollStates(prev => {
        if (prev.length === states.length && prev.every((state, index) => state === states[index])) {
          return prev
        }
        return states
      })
    }

    updatePaneGeometry()
    scroller.addEventListener('scroll', updatePaneGeometry, { passive: true })
    window.addEventListener('resize', updatePaneGeometry)

    return () => {
      scroller.removeEventListener('scroll', updatePaneGeometry)
      window.removeEventListener('resize', updatePaneGeometry)
    }
  }, [noteStack])

  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }

    if (isHashNavigationRef.current) {
      isHashNavigationRef.current = false
      return
    }

    const nextHash = `#${noteStack.join('/')}`
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, '', nextHash)
    }
  }, [noteStack])

  useEffect(() => {
    const handleHashChange = () => {
      isHashNavigationRef.current = true
      setPreview(null)
      setNoteStack(getStackFromHash())
    }

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const showPreview = useCallback((noteId, linkElement) => {
    if (!notes[noteId]) return
    setPreview({ noteId, rect: linkElement.getBoundingClientRect() })
  }, [])

  const hidePreview = useCallback(() => {
    setPreview(null)
  }, [])

  const stackContext = useMemo(() => ({
    displayedSlugs: noteStack,
  }), [noteStack])

  return (
    <>
      <div className="notes-app-root">
        <header id="notes-header">
          <h1>Alejo's working notes</h1>
          <button type="button" className="header-note-link" onClick={resetStack}>
            About these notes
          </button>
          <div className="header-spacer" />
        </header>

        <div className="note-columns-scroller" ref={scrollerRef}>
          <div
            ref={columnsRef}
            className="note-columns"
            style={{ width: `${noteStack.length * PANE_WIDTH}px` }}
          >
            <NoteStackContext.Provider value={stackContext}>
              {noteStack.map((noteId, index) => (
                <NotePane
                  key={`${noteId}-${index}`}
                  noteId={noteId}
                  note={notes[noteId]}
                  index={index}
                  scrollState={scrollStates[index] || 'resting'}
                  onOpenNote={openNote}
                  onBack={backOnePane}
                  onHoverLink={showPreview}
                  onLeaveLink={hidePreview}
                  stickyLeft={index * PANE_OFFSET}
                />
              ))}
            </NoteStackContext.Provider>
          </div>
        </div>
      </div>

      {preview && (
        <HoverPreview
          note={notes[preview.noteId]}
          linkRect={preview.rect}
        />
      )}
    </>
  )
}
