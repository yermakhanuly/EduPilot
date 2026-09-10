import React from 'react'

function renderInline(text) {
  if (!text) return null
  // Regex to tokenize inline code, bold, italic
  const tokens = []
  let remaining = text
  let key = 0

  while (remaining.length > 0) {
    // Inline code: `code`
    const codeMatch = remaining.match(/^`([^`]+)`/)
    if (codeMatch) {
      tokens.push(<code key={key++}>{codeMatch[1]}</code>)
      remaining = remaining.slice(codeMatch[0].length)
      continue
    }

    // Bold: **text** or __text__
    const boldMatch = remaining.match(/^(\*\*|__)(.*?)\1/)
    if (boldMatch) {
      tokens.push(<strong key={key++}>{renderInline(boldMatch[2])}</strong>)
      remaining = remaining.slice(boldMatch[0].length)
      continue
    }

    // Italic: *text* or _text_
    const italicMatch = remaining.match(/^(\*|_)(.*?)\1/)
    if (italicMatch) {
      tokens.push(<em key={key++}>{renderInline(italicMatch[2])}</em>)
      remaining = remaining.slice(italicMatch[0].length)
      continue
    }

    // Plain text up to the next special char
    const nextSpecial = remaining.search(/[`*_]/)
    if (nextSpecial === -1) {
      tokens.push(remaining)
      break
    } else if (nextSpecial > 0) {
      tokens.push(remaining.slice(0, nextSpecial))
      remaining = remaining.slice(nextSpecial)
    } else {
      // Single char that didn't match formatting syntax
      tokens.push(remaining[0])
      remaining = remaining.slice(1)
    }
  }

  return tokens
}

export function FormattedText({ text, className = '' }) {
  if (!text) return null

  // 1. Handle code blocks ```
  const codeBlockRegex = /```(?:[a-zA-Z]*\n)?([\s\S]*?)```/g
  const blocks = []
  let lastIndex = 0
  let match

  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      blocks.push({ type: 'text', content: text.slice(lastIndex, match.index) })
    }
    blocks.push({ type: 'code', content: match[1].trim() })
    lastIndex = codeBlockRegex.lastIndex
  }
  if (lastIndex < text.length) {
    blocks.push({ type: 'text', content: text.slice(lastIndex) })
  }

  return (
    <div className={`formatted-text ${className}`.trim()}>
      {blocks.map((block, bIdx) => {
        if (block.type === 'code') {
          return (
            <pre key={bIdx} className="formatted-code-block">
              <code>{block.content}</code>
            </pre>
          )
        }

        // Split text content into double-newline paragraphs
        const paragraphs = block.content.split(/\n\n+/)
        return paragraphs.map((paragraph, pIdx) => {
          const lines = paragraph.split('\n').map((l) => l.trim()).filter(Boolean)
          if (!lines.length) return null

          // Check if paragraph is a heading
          if (lines.length === 1 && /^#{1,6}\s+/.test(lines[0])) {
            const level = lines[0].match(/^(#{1,6})\s+/)[1].length
            const headingText = lines[0].replace(/^#{1,6}\s+/, '')
            const HeadingTag = `h${Math.min(level + 2, 6)}`
            return <HeadingTag key={`${bIdx}-${pIdx}`}>{renderInline(headingText)}</HeadingTag>
          }

          // Check if paragraph is a bullet list
          const isBulletList = lines.every((l) => /^[-*•]\s+/.test(l))
          if (isBulletList) {
            return (
              <ul key={`${bIdx}-${pIdx}`}>
                {lines.map((l, lIdx) => (
                  <li key={lIdx}>{renderInline(l.replace(/^[-*•]\s+/, ''))}</li>
                ))}
              </ul>
            )
          }

          // Check if paragraph is a numbered list
          const isNumberedList = lines.every((l) => /^\d+\.\s+/.test(l))
          if (isNumberedList) {
            return (
              <ol key={`${bIdx}-${pIdx}`}>
                {lines.map((l, lIdx) => (
                  <li key={lIdx}>{renderInline(l.replace(/^\d+\.\s+/, ''))}</li>
                ))}
              </ol>
            )
          }

          // Regular paragraph with potential single line breaks
          return (
            <p key={`${bIdx}-${pIdx}`}>
              {lines.map((line, lIdx) => (
                <React.Fragment key={lIdx}>
                  {renderInline(line)}
                  {lIdx < lines.length - 1 && <br />}
                </React.Fragment>
              ))}
            </p>
          )
        })
      })}
    </div>
  )
}
