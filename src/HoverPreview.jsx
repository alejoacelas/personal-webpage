import React from 'react'

// Simplified content renderer for preview (no interactions)
function renderPreviewContent(content) {
  const truncated = content.length > 1200 ? content.slice(0, 1200) : content
  const paragraphs = truncated.split('\n\n').filter(p => p.trim())

  return paragraphs.map((para, i) => {
    const lines = para.split('\n')
    const isListBlock = lines.every(l => l.trim().startsWith('- ') || l.trim() === '')

    if (isListBlock) {
      return (
        <ul key={i} className="note-list">
          {lines.filter(l => l.trim().startsWith('- ')).map((line, li) => (
            <li key={li} className="note-list-item">
              {renderInlineText(line.replace(/^-\s+/, ''))}
            </li>
          ))}
        </ul>
      )
    }

    return (
      <p key={i} className="note-paragraph">
        {renderInlineText(para)}
      </p>
    )
  })
}

// Render bold and links as plain text (no click handlers in preview)
function renderInlineText(text) {
  const parts = []
  const regex = /\[\[([^|]+)\|([^\]]+)\]\]|\[([^\]]+)\]\(((?:[^()\s]+|\([^()]*\))+)\)|\*\*(.+?)\*\*/g
  let lastIndex = 0
  let match

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(<span key={`t${lastIndex}`}>{text.slice(lastIndex, match.index)}</span>)
    }

    if (match[1] !== undefined) {
      // Note link rendered as styled span
      parts.push(<span key={`n${match.index}`} className="note-link">{match[2]}</span>)
    } else if (match[3] !== undefined) {
      // External link rendered as styled span
      parts.push(<span key={`e${match.index}`} className="external-link">{match[3]}</span>)
    } else if (match[5] !== undefined) {
      parts.push(<strong key={`b${match.index}`}>{match[5]}</strong>)
    }

    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push(<span key={`t${lastIndex}`}>{text.slice(lastIndex)}</span>)
  }

  return parts
}

export default function HoverPreview({ note, linkRect }) {
  if (!note || !linkRect) return null

  const previewWidth = 550
  const gap = 8

  // Place on whichever side of the link has more space
  const spaceRight = window.innerWidth - linkRect.right
  const spaceLeft = linkRect.left

  let left
  if (spaceRight >= previewWidth + gap + 16) {
    left = linkRect.right + gap
  } else if (spaceLeft >= previewWidth + gap + 16) {
    left = linkRect.left - previewWidth - gap
  } else {
    // Neither side fits — pick the side with more room and clamp
    left = spaceRight >= spaceLeft
      ? Math.min(linkRect.right + gap, window.innerWidth - previewWidth - 16)
      : Math.max(16, linkRect.left - previewWidth - gap)
  }

  // Vertical: align near link top, clamp to viewport (max preview height ~400px from CSS)
  const top = linkRect.top - 72
  const clampedLeft = left
  const clampedTop = Math.max(8, Math.min(top, window.innerHeight - 416))

  return (
    <div
      className="hover-preview"
      style={{
        left: `${clampedLeft}px`,
        top: `${clampedTop}px`,
      }}
    >
      <div className="hover-preview-inner">
        <div className="hover-preview-content">
          <h2 className="note-title">{note.title}</h2>
          <div className="note-content">
            {renderPreviewContent(note.content)}
          </div>
        </div>
      </div>
    </div>
  )
}
