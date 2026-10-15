import { useCallback, useEffect, useRef, useState } from 'react'
import type { Message } from './types/chat'
import { streamChat } from './api/chatStream'
import { UploadBox } from './components/UploadBox'
import { DocumentList } from './components/DocumentList'
import { MessageBubble } from './components/MessageBubble'
import { useSessionId } from './hooks/useSessionId'
import './App.css'

function App() {
  const sessionId = useSessionId()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [failedMessage, setFailedMessage] = useState('')
  const [documentsVersion, setDocumentsVersion] = useState(0)
  const [documentCount, setDocumentCount] = useState<number | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => controllerRef.current?.abort(), [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages, loading])

  const updateDocumentCount = useCallback((count: number) => setDocumentCount(count), [])

  async function sendMessage(retryText?: string) {
    const text = (retryText ?? input).trim()
    if (!text || controllerRef.current || !documentCount) return
    const controller = new AbortController()
    controllerRef.current = controller

    setMessages((previous) => retryText
      ? previous.map((message, index) =>
        index === previous.length - 1 && message.role === 'assistant'
          ? { role: 'assistant', text: '' }
          : message)
      : [...previous, { role: 'user', text }, { role: 'assistant', text: '' }])
    if (!retryText) setInput('')
    setError('')
    setFailedMessage('')
    setLoading(true)

    try {
      await streamChat(text, sessionId, {
        signal: controller.signal,
        onToken: (token) => {
          if (controller.signal.aborted) return
          setMessages((previous) => previous.map((message, index) =>
            index === previous.length - 1 && message.role === 'assistant'
              ? { ...message, text: message.text + token }
              : message,
          ))
        },
        onSources: (sources) => {
          if (controller.signal.aborted) return
          setMessages((previous) => previous.map((message, index) =>
            index === previous.length - 1 && message.role === 'assistant'
              ? { ...message, sources }
              : message,
          ))
        },
        onDone: () => setFailedMessage(''),
        onError: (message) => {
          setError(message)
          setFailedMessage(text)
        },
      })
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null
        setLoading(false)
      }
    }
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <header className="brand">
          <span className="brand-mark" aria-hidden="true">D</span>
          <div>
            <p>RAG workspace</p>
            <h1>Document Assistant</h1>
          </div>
        </header>
        <UploadBox sessionId={sessionId} onUploaded={() => setDocumentsVersion((value) => value + 1)} />
        <DocumentList sessionId={sessionId} refreshKey={documentsVersion}
          onCountChange={updateDocumentCount} />
      </aside>

      <section className="chat-panel" aria-labelledby="conversation-heading">
        <header className="chat-header">
          <div>
            <p className="eyebrow">Grounded answers</p>
            <h2 id="conversation-heading">Chat with your documents</h2>
          </div>
          <span className={`document-status ${documentCount ? 'ready' : ''}`}>
            {documentCount === null ? 'Checking documents' :
              documentCount > 0 ? `${documentCount} ready` : 'Upload required'}
          </span>
        </header>

        <section className="message-list" role="log" aria-label="Conversation" aria-live="polite">
          {messages.length === 0 && (
            <div className="empty-state">
              <span aria-hidden="true">{documentCount ? '✦' : '↑'}</span>
              <h3>{documentCount ? 'Ask your first question' : 'Upload a PDF to start'}</h3>
              <p>{documentCount
                ? 'Answers will use only your uploaded documents and include source pages.'
                : 'Add a text-based PDF, then ask questions about its contents.'}</p>
            </div>
          )}
          {messages.map((message, index) => message.text &&
            <MessageBubble message={message} key={index} />)}
          {loading && !messages.at(-1)?.text && (
            <div className="message message-assistant thinking" role="status">
              <span className="thinking-dot" /> Searching your documents…
            </div>
          )}
          <div ref={messagesEndRef} />
        </section>

        <footer className="chat-footer">
          {error && (
            <div className="error-row">
              <p className="error" role="alert">{error}</p>
              {failedMessage && !loading && (
                <button type="button" className="retry-button" onClick={() => void sendMessage(failedMessage)}>
                  Retry
                </button>
              )}
            </div>
          )}
        <form className="composer" onSubmit={(event) => {
          event.preventDefault()
          sendMessage()
        }}>
          <label htmlFor="message-input">Ask a question</label>
          <div className="composer-row">
            <input
              id="message-input"
              name="message"
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={documentCount ? 'Ask about your documents…' : 'Upload a PDF to enable chat'}
              maxLength={2000}
              disabled={loading || !documentCount}
              aria-describedby="composer-help"
            />
            {loading ? (
              <button type="button" className="stop-button" onClick={() => controllerRef.current?.abort()}>
                Stop
              </button>
            ) : (
              <button type="submit" disabled={!input.trim() || !documentCount}>Send</button>
            )}
          </div>
          <p id="composer-help">Answers are grounded in your uploaded files. Press Enter to send.</p>
        </form>
        </footer>
      </section>
    </main>
  )
}

export default App
