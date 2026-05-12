import React, { useContext } from 'react'
import { NoteStackContext } from './App.jsx'
import notes from './notes.js'

// Parse [[id|label]] links, **bold**, and [text](url) external links in content
function parseContent(content, index, onOpenNote, onHoverLink, onLeaveLink, displayedSlugs) {
  const parts = []
  const regex = /\[\[([^|]+)\|([^\]]+)\]\]|\[([^\]]+)\]\(((?:[^()\s]+|\([^()]*\))+)\)|\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`t${lastIndex}`}>{content.slice(lastIndex, match.index)}</span>)
    }

    if (match[1] !== undefined) {
      // Note link: [[id|label]]
      const noteId = match[1]
      const label = match[2]
      const exists = !!notes[noteId]
      const isActive = displayedSlugs.includes(noteId)
      parts.push(
        <a
          key={`n${match.index}`}
          className={`note-link${exists ? '' : ' broken'}${isActive ? ' active' : ''}`}
          href="#"
          onClick={(e) => {
            e.preventDefault()
            if (exists) onOpenNote(noteId, index)
          }}
          onMouseEnter={(e) => {
            if (exists) onHoverLink(noteId, e.target)
          }}
          onMouseLeave={onLeaveLink}
          onFocus={(e) => {
            if (exists) onHoverLink(noteId, e.target)
          }}
          onBlur={onLeaveLink}
        >
          {label}
        </a>
      )
    } else if (match[3] !== undefined) {
      // External link: [text](url)
      parts.push(
        <a
          key={`e${match.index}`}
          className="external-link"
          href={match[4]}
          target="_blank"
          rel="noopener noreferrer"
        >
          {match[3]}
        </a>
      )
    } else if (match[5] !== undefined) {
      // Bold: **text**
      parts.push(<strong key={`b${match.index}`}>{match[5]}</strong>)
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    parts.push(<span key={`t${lastIndex}`}>{content.slice(lastIndex)}</span>)
  }

  return parts
}

function renderContent(content, index, onOpenNote, onHoverLink, onLeaveLink, displayedSlugs) {
  const paragraphs = content.split('\n\n').filter(p => p.trim())

  return paragraphs.map((para, i) => {
    const lines = para.split('\n')
    const isListBlock = lines.every(l => l.trim().startsWith('- ') || l.trim() === '')

    if (isListBlock) {
      return (
        <ul key={i} className="note-list">
          {lines.filter(l => l.trim().startsWith('- ')).map((line, li) => (
            <li key={li} className="note-list-item">
              {parseContent(line.replace(/^-\s+/, ''), index, onOpenNote, onHoverLink, onLeaveLink, displayedSlugs)}
            </li>
          ))}
        </ul>
      )
    }

    return (
      <p key={i} className="note-paragraph">
        {parseContent(para, index, onOpenNote, onHoverLink, onLeaveLink, displayedSlugs)}
      </p>
    )
  })
}

export default function NotePane({
  noteId,
  note,
  index,
  stackLength,
  scrollState,
  onOpenNote,
  onCloseNotes,
  onHoverLink,
  onLeaveLink,
  stickyLeft,
}) {
  const { displayedSlugs } = useContext(NoteStackContext)

  if (!note) return null

  return (
    <div
      className={`note-pane ${scrollState}`}
      style={{
        left: `${stickyLeft}px`,
        right: '-585px',
        zIndex: index + 10,
      }}
    >
      <div className="obscured-label">
        {note.title}
      </div>

      <div className="note-pane-inner">
        <div className="note-header">
          <button
            type="button"
            className="note-close-button"
            onClick={onCloseNotes}
          >
            Back
          </button>
          <h2 className="note-title">{note.title}</h2>
        </div>

        <div className="note-content">
          {renderContent(note.content, index, onOpenNote, onHoverLink, onLeaveLink, displayedSlugs)}
        </div>

        {note.backlinks && note.backlinks.length > 0 && (
          <div className="backlinks-section">
            <h3 className="backlinks-title">Linked from</h3>
            <div className="backlinks-list">
              {note.backlinks.map(blId => {
                const blNote = notes[blId]
                if (!blNote) return null
                return (
                  <a
                    key={blId}
                    className="backlink-card"
                    href="#"
                    onClick={(e) => {
                      e.preventDefault()
                      onOpenNote(blId, index)
                    }}
                    onMouseEnter={(e) => onHoverLink(blId, e.target)}
                    onMouseLeave={onLeaveLink}
                    onFocus={(e) => onHoverLink(blId, e.target)}
                    onBlur={onLeaveLink}
                  >
                    <span className="backlink-title">{blNote.title}</span>
                    <span className="backlink-summary">{blNote.summary}</span>
                  </a>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
