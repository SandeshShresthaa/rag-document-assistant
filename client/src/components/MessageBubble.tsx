import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import type { Message } from '../types/chat'
import { SourcesPanel } from './SourcesPanel'

type MessageBubbleProps = { message: Message }

export function MessageBubble({ message }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => {
    if (resetTimer.current) clearTimeout(resetTimer.current)
  }, [])

  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(message.text)
      setCopied(true)
      if (resetTimer.current) clearTimeout(resetTimer.current)
      resetTimer.current = setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <article className={`message message-${message.role}`}>
      <div className="message-heading">
        <span className="message-role">{message.role === 'user' ? 'You' : 'Assistant'}</span>
        {message.role === 'assistant' && (
          <button type="button" className="copy-button" onClick={() => void copyAnswer()}
            aria-label="Copy answer">
            {copied ? 'Copied' : 'Copy'}
          </button>
        )}
      </div>
      {message.role === 'assistant'
        ? <ReactMarkdown>{message.text}</ReactMarkdown>
        : <p>{message.text}</p>}
      {message.role === 'assistant' && <SourcesPanel sources={message.sources ?? []} />}
    </article>
  )
}
