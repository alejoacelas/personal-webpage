import React, { useState, useRef, useEffect, useCallback, useMemo, createContext } from 'react'
import { flushSync } from 'react-dom'
import DifferentialGrowthBg from './DifferentialGrowthBg.jsx'
import NotePane from './NotePane.jsx'
import HoverPreview from './HoverPreview.jsx'
import notes from './notes.js'

// Context for note stack state (so NotePane can check active links)
export const NoteStackContext = createContext({ displayedSlugs: [] })

const PANE_WIDTH = 625
const PANE_OFFSET = 40
const ROOT_WIDTH = 640
const RUNWAY = 100

function ExpandableSection({ title, children }) {
  return (
    <section className="body-section">
      <details className="expandable">
        <summary className="expandable__trigger">
          <h2>{title}</h2>
          <span className="expandable__icon" aria-hidden="true"></span>
        </summary>
        <div className="expandable__content">
          {children}
        </div>
      </details>
    </section>
  )
}

function getStackFromHash() {
  const hash = window.location.hash.replace('#', '')
  if (!hash) return []
  return hash.split('/').filter(id => notes[id])
}

// Compute scroll states for each pane (resting/overlay/obscured)
function computeScrollStates(scrollLeft, numPanes, viewportWidth) {
  return Array.from({ length: numPanes }, (_, n) => {
    // Offset by root width for pane calculations
    const adjustedScroll = scrollLeft
    const paneLeft = ROOT_WIDTH + n * PANE_WIDTH
    const leftThreshold = Math.max(0, (PANE_WIDTH - PANE_OFFSET) * n)
    const rightThreshold = Math.min(
      ROOT_WIDTH + numPanes * PANE_WIDTH,
      (PANE_WIDTH - PANE_OFFSET) * (n + 1) - (viewportWidth - ROOT_WIDTH - n * PANE_OFFSET) + 80
    )
    const obscuredRight = Math.max(0, (PANE_WIDTH - PANE_OFFSET) * (n + 2) - 80)

    if (adjustedScroll > leftThreshold) {
      if (adjustedScroll > obscuredRight) return 'obscured'
      return 'overlay'
    } else if (adjustedScroll < rightThreshold) {
      return 'obscured'
    }
    return 'resting'
  })
}

export default function App() {
  const [noteStack, setNoteStack] = useState(getStackFromHash)
  const [preview, setPreview] = useState(null)
  const [scrollStates, setScrollStates] = useState([])
  const [closing, setClosing] = useState(false)
  const [suppressLayoutTransitions, setSuppressLayoutTransitions] = useState(false)
  const scrollRef = useRef(null)
  const mainColRef = useRef(null)
  const closingRef = useRef(false)
  const isPopStateRef = useRef(false)
  const justOpenedRef = useRef(false)
  const justNavigatedRef = useRef(false)
  const hasMountedRef = useRef(false)
  const closeNotes = useCallback(() => {
    setNoteStack([])
    setPreview(null)
    setClosing(false)
    closingRef.current = false
  }, [])

  useEffect(() => {
    const initialStack = getStackFromHash()
    if (initialStack.length > 0) {
      setNoteStack(initialStack)
    }
  }, [])

  const mode = closing ? 'closing' : noteStack.length > 0 ? 'notes' : 'landing'

  const openNote = useCallback((noteId, fromIndex) => {
    if (!notes[noteId]) return
    justOpenedRef.current = true
    setNoteStack(prev => {
      // If target is already in the stack, do nothing (Matuschak behavior)
      if (prev.includes(noteId)) {
        const existingIndex = prev.indexOf(noteId)
        const el = scrollRef.current
        if (el) {
          const targetLeft = RUNWAY + ROOT_WIDTH + existingIndex * PANE_WIDTH - (window.innerWidth - PANE_WIDTH) / 2
          window.setTimeout(() => {
            el.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' })
          }, 0)
        }
        return prev
      }

      // Remove everything to the right of the clicked pane, append new
      const sliceAt = fromIndex === -1 ? 0 : fromIndex + 1
      const newStack = prev.slice(0, sliceAt)
      return [...newStack, noteId]
    })
  }, [])

  // Scroll to center the new pane when stack changes
  useEffect(() => {
    if (!scrollRef.current || noteStack.length === 0) return
    const el = scrollRef.current
    const newIndex = noteStack.length - 1
    const scrollTimer = setTimeout(() => {
      const targetLeft = RUNWAY + ROOT_WIDTH + newIndex * PANE_WIDTH - (window.innerWidth - PANE_WIDTH) / 2
      el.scrollTo({ left: Math.max(0, targetLeft), behavior: 'smooth' })
    }, 50)
    // Clear the just-opened guard after scroll settles
    const guardTimer = setTimeout(() => { justOpenedRef.current = false }, 500)
    return () => { clearTimeout(scrollTimer); clearTimeout(guardTimer) }
  }, [noteStack.length])

  // Magnetic zone hints + scroll-to-close trigger
  const colsRef = useRef(null)
  const closeWithAnimation = useCallback(() => {
    closingRef.current = true
    setClosing(true)

    const mainCol = mainColRef.current
    const cols = colsRef.current
    if (!mainCol || !cols) return

    // Note panes: clear paneFadeIn animation (fill-mode:both overrides inline opacity),
    // then CSS slide off to the right + fade out
    const panes = cols.querySelectorAll('.note-pane')
    panes.forEach(p => {
      p.style.animation = 'none'
      p.offsetHeight // force reflow
      p.style.transition = 'transform 600ms cubic-bezier(0.19, 1, 0.22, 1), opacity 500ms ease'
      p.style.transform = `translateX(${window.innerWidth}px)`
      p.style.opacity = '0'
    })

    // Main column: JS spring physics to center ("released spring" feel)
    const currentTransform = parseFloat(mainCol.style.transform?.replace(/[^0-9.-]/g, '')) || 0
    const naturalLeft = mainCol.getBoundingClientRect().left - currentTransform
    const target = (window.innerWidth - ROOT_WIDTH) / 2 - naturalLeft
    let pos = currentTransform
    let vel = 0
    let lastTime = performance.now()
    const stiffness = 60
    const damping = 15
    const mass = 1

    mainCol.style.transition = 'none'

    function step(now) {
      const dt = Math.min((now - lastTime) / 1000, 1 / 30)
      lastTime = now
      const displacement = pos - target
      const springForce = -stiffness * displacement
      const dampingForce = -damping * vel
      const accel = (springForce + dampingForce) / mass
      vel += accel * dt
      pos += vel * dt

      mainCol.style.transform = `translateX(${pos}px)`

      if (Math.abs(pos - target) < 0.3 && Math.abs(vel) < 0.3) {
        mainCol.style.transform = `translateX(${target}px)`
        finalize()
        return
      }
      requestAnimationFrame(step)
    }

    requestAnimationFrame(step)

    function finalize() {
      flushSync(() => {
        setSuppressLayoutTransitions(true)
        setNoteStack([])
        setClosing(false)
        setPreview(null)
      })
      closingRef.current = false

      // Hand the centered column back to landing mode with transitions disabled,
      // so the spring remains the only visible motion system.
      mainCol.style.transform = 'none'
      mainCol.style.transition = 'none'

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setSuppressLayoutTransitions(false)
          mainCol.style.transition = ''
          mainCol.style.transform = ''
        })
      })

      const cleanup = () => {
        mainCol.style.transition = ''
        mainCol.style.transform = ''
      }
      setTimeout(cleanup, 100)
    }
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    const mainCol = mainColRef.current
    if (!el || !mainCol || noteStack.length === 0 || closing) return

    let closeTimeout

    const handleScroll = () => {
      if (closingRef.current || justOpenedRef.current || justNavigatedRef.current) return
      const sl = el.scrollLeft

      if (sl < RUNWAY) {
        // progress: 0 at zone edge, 1 at scrollLeft=0
        const progress = 1 - (sl / RUNWAY)

        // Note panes: slide right immediately (creates the gap)
        const noteShift = progress * 200
        const panes = colsRef.current?.querySelectorAll('.note-pane')
        panes?.forEach(p => { p.style.transform = `translateX(${noteShift}px)` })

        // Main column: delayed quadratic nudge toward center
        const mainProgress = Math.max(0, (progress - 0.3) / 0.7)
        const mainEased = mainProgress * mainProgress
        const centerOff = (window.innerWidth - ROOT_WIDTH) / 2
        const maxNudge = Math.min(centerOff + 30, 45)
        mainCol.style.transform = `translateX(${mainEased * maxNudge}px)`
      } else {
        mainCol.style.transform = ''
        const panes = colsRef.current?.querySelectorAll('.note-pane')
        panes?.forEach(p => { p.style.transform = '' })
      }

      // Close trigger at scrollLeft=0
      clearTimeout(closeTimeout)
      closeTimeout = setTimeout(() => {
        if (sl <= 0 && !closingRef.current && !justOpenedRef.current && !justNavigatedRef.current) {
          closeWithAnimation()
        }
      }, 200)
    }

    el.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      clearTimeout(closeTimeout)
      el.removeEventListener('scroll', handleScroll)
      // Clear transforms on cleanup
      mainCol.style.transform = ''
      mainCol.style.transition = ''
      const panes = colsRef.current?.querySelectorAll('.note-pane')
      panes?.forEach(p => { p.style.transform = '' })
    }
  }, [noteStack.length > 0, closing, closeWithAnimation])

  // Scroll state tracking (overlay/obscured/resting)
  useEffect(() => {
    const el = scrollRef.current
    if (!el || noteStack.length === 0) {
      setScrollStates([])
      return
    }
    const update = () => {
      const scrollLeft = Math.max(0, el.scrollLeft - RUNWAY)
      const states = computeScrollStates(scrollLeft, noteStack.length, window.innerWidth)

      const panes = colsRef.current?.querySelectorAll('.note-pane')
      if (panes) {
        const paneLefts = Array.from({ length: noteStack.length }, (_, n) => {
          const stickyLeft = (n + 1) * PANE_OFFSET
          const naturalLeft = ROOT_WIDTH + n * PANE_WIDTH - scrollLeft
          return Math.max(stickyLeft, naturalLeft)
        })
        panes.forEach((pane, n) => {
          const nextLeft = n < panes.length - 1 ? paneLefts[n + 1] : paneLefts[n] + PANE_WIDTH
          const visibleWidth = Math.max(PANE_OFFSET, Math.min(PANE_WIDTH, nextLeft - paneLefts[n]))
          const linear = Math.max(0, Math.min(1, 1 - (visibleWidth - PANE_OFFSET) / (PANE_WIDTH - PANE_OFFSET)))
          const progress = linear * linear * linear
          pane.style.setProperty('--obscured-progress', progress.toFixed(3))
          pane.style.setProperty('--visible-width', `${visibleWidth}px`)
        })
      }

      setScrollStates(prev => {
        if (prev.length === states.length && prev.every((s, i) => s === states[i])) return prev
        return states
      })
    }
    update()
    el.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      el.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [noteStack])

  // Sync note stack to URL hash
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true
      return
    }
    if (isPopStateRef.current) {
      isPopStateRef.current = false
      return
    }
    const hash = noteStack.length > 0 ? '#' + noteStack.join('/') : ''
    const currentHash = window.location.hash || ''
    if (currentHash !== hash) {
      window.history.pushState(null, '', hash || window.location.pathname)
    }
  }, [noteStack])

  // Handle browser back/forward
  useEffect(() => {
    const handlePopState = () => {
      isPopStateRef.current = true
      justNavigatedRef.current = true
      setTimeout(() => { justNavigatedRef.current = false }, 500)
      const newStack = getStackFromHash()
      setNoteStack(newStack)
      if (newStack.length === 0) setPreview(null)
    }
    window.addEventListener('hashchange', handlePopState)
    return () => {
      window.removeEventListener('hashchange', handlePopState)
    }
  }, [])

  const showPreview = useCallback((noteId, linkElement) => {
    if (!notes[noteId]) return
    const rect = linkElement.getBoundingClientRect()
    setPreview({ noteId, rect })
  }, [])

  const hidePreview = useCallback(() => {
    setPreview(null)
  }, [])

  // Container width for notes/closing mode — keep full width during closing (spring handles animation)
  const columnsWidth = noteStack.length > 0
    ? RUNWAY + ROOT_WIDTH + noteStack.length * PANE_WIDTH
    : undefined

  const stackContext = useMemo(() => ({
    displayedSlugs: noteStack,
  }), [noteStack])

  return (
    <>
      {/* Living canvas background */}
      <DifferentialGrowthBg />

      {/* Film grain overlay */}
      <div className="film-grain" />

      {/* Page root */}
      <div className={`page-root ${mode}-mode ${suppressLayoutTransitions ? 'no-layout-transition' : ''}`}>
        {/* Scroll container */}
        <div className="scroll-container" ref={scrollRef}>
          {/* Columns container */}
          <div
            ref={colsRef}
            className="columns-container"
            style={columnsWidth ? { width: columnsWidth + 'px', paddingLeft: RUNWAY + 'px' } : undefined}
          >
            {/* Root pane (main column) */}
            <main className="main-column" ref={mainColRef}>
              <div className="main-column-inner">
                <header className="hero-header">
                  <h1 className="hero-name">Alejandro Acelas</h1>
                  <p className="hero-subtitle">or just Alejo <span className="pronunciation">(/ah-leh-ho/)</span> if we're friends</p>
                </header>

                <ExpandableSection title="About">
                  <p>
                    Based in Bogot&aacute;. Economics at Los Andes (cum laude).
                    I co-founded{' '}
                    <a href="https://cliver.bio" target="_blank" rel="noopener noreferrer">Cliver</a>,
                    taught AI safety bootcamps across Latin America,
                    and helped draft the EU AI Act Code of Practice.
                  </p>
                  <p className="about-cta">
                    Curious about the person?{' '}
                    <button
                      className="inline-note-link"
                      onClick={() => openNote('what-im-like', -1)}
                      onMouseEnter={(e) => showPreview('what-im-like', e.currentTarget)}
                      onMouseLeave={hidePreview}
                    >What I&apos;m like</button>
                    {' · '}
                    <button
                      className="inline-note-link"
                      onClick={() => openNote('how-i-work', -1)}
                      onMouseEnter={(e) => showPreview('how-i-work', e.currentTarget)}
                      onMouseLeave={hidePreview}
                    >How I work</button>
                  </p>
                </ExpandableSection>

                <ExpandableSection title="Work">
                  <ul className="work-list">
                    <li>
                      <a href="https://cliver.bio" target="_blank" rel="noopener noreferrer">Cliver</a>
                      <span className="work-list-desc"> &mdash; AI-powered DNA synthesis screening</span>
                    </li>
                    <li>
                      <a href="https://forum.effectivealtruism.org/posts/9nWKhhuuubcwGWEpk/" target="_blank" rel="noopener noreferrer">EA Forum post</a>
                      <span className="work-list-desc"> &mdash; AI uplift for EA orgs</span>
                    </li>
                  </ul>
                </ExpandableSection>

                <ExpandableSection title="Experience">
                  <ul className="experience-list">
                    <li>
                      <strong>Program consultant</strong> — LEEP <span className="date-range">May–Sep 2025</span>
                      <br />Market research and LLM prototyping for lead poisoning elimination.
                    </li>
                    <li>
                      <strong>Head teacher</strong> — ML4Good <span className="date-range">Feb 2025–Aug 2025</span>
                      <br />Led ML and AI safety bootcamps throughout Latin America.
                    </li>
                    <li>
                      <strong>AI policy officer</strong> — Observatorio de Riesgos Catastr&oacute;ficos Globales <span className="date-range">May–Oct 2024</span>
                      <br />Drafted recommendations for EU AI Act.
                    </li>
                    <li>
                      <strong>Research fellow</strong> — Swiss Existential Risk Initiative <span className="date-range">Jun–Aug 2023</span>
                      <br />Feature detection for neural networks.
                    </li>
                    <li>
                      <strong>Co-founder</strong> — Effective Altruism Uniandes <span className="date-range">Jun 2021–Feb 2023</span>
                      <br />University community for high-impact careers.
                    </li>
                  </ul>
                </ExpandableSection>

                <ExpandableSection title="Contact">
                  <p className="contact-links">
                    <a href="mailto:alejoacelas@gmail.com">alejoacelas@gmail.com</a>
                    {' '}&middot;{' '}
                    <a href="https://linkedin.com/in/alejandro-acelas" target="_blank" rel="noopener noreferrer">LinkedIn</a>
                    {' '}&middot;{' '}
                    <a href="https://calendly.com/alejoacelas" target="_blank" rel="noopener noreferrer">Calendly</a>
                    {' '}&middot;{' '}
                    <a href="https://github.com/AlejoAcelas" target="_blank" rel="noopener noreferrer">GitHub</a>
                  </p>
                </ExpandableSection>

              </div>
            </main>

            {/* Note panes */}
            <NoteStackContext.Provider value={stackContext}>
              {noteStack.map((noteId, index) => (
                <NotePane
                  key={noteId}
                  noteId={noteId}
                  note={notes[noteId]}
                  index={index}
                  stackLength={noteStack.length}
                  scrollState={scrollStates[index] || 'resting'}
                  onOpenNote={openNote}
                  onCloseNotes={closeNotes}
                  onHoverLink={showPreview}
                  onLeaveLink={hidePreview}
                  stickyLeft={(index + 1) * PANE_OFFSET}
                />
              ))}
            </NoteStackContext.Provider>
          </div>
        </div>
      </div>

      {/* Hover preview */}
      {preview && (
        <HoverPreview
          note={notes[preview.noteId]}
          linkRect={preview.rect}
        />
      )}
    </>
  )
}
