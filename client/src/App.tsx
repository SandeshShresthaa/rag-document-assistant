import { useEffect, useRef, useState } from 'react'
import type { Message } from './types/chat'
import { streamChat } from './api/chatStream'
import { UploadBox } from './components/UploadBox'
import { useSessionId } from './hooks/useSessionId'
import './App.css'

function App() {
  const sessionId = useSessionId()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const controllerRef = useRef<AbortController | null>(null)

  useEffect(() => () => controllerRef.current?.abort(), [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages, loading])

  async function sendMessage() {
    const text = input.trim()
    if (!text || controllerRef.current) return
    const controller = new AbortController()
    controllerRef.current = controller

    setMessages((previous) => [
      ...previous,
      { role: 'user', text },
      { role: 'assistant', text: '' },
    ])
    setInput('')
    setError('')
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
        onDone: () => {}, // Cleanup below restores the controls for every outcome.
        onError: (message) => setError(message),
      })
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null
        setLoading(false)
      }
    }
  }

  return (
    <main className="chat">
      <header className="chat-header">
        <h1>Document Assistant</h1>
        <p>Ask a question to start a conversation.</p>
      </header>
      <UploadBox />

      <section className="message-list" role="log" aria-label="Conversation" aria-live="polite">
        {messages.length === 0 && (
          <p className="empty-state">Your conversation will appear here.</p>
        )}
        {messages.map((message, index) => message.text && (
          <article className={`message message-${message.role}`} key={index}>
            <span className="message-role">{message.role === 'user' ? 'You' : 'Assistant'}</span>
            <p>{message.text}</p>
          </article>
        ))}
        {loading && !messages.at(-1)?.text && (
          <div className="message message-assistant thinking" role="status">Thinking...</div>
        )}
        <div ref={messagesEndRef} />
      </section>

      <footer className="chat-footer">
        {error && <p className="error" role="alert">{error}</p>}
        <form className="composer" onSubmit={(event) => {
          event.preventDefault()
          sendMessage()
        }}>
          <label htmlFor="message-input">Your message</label>
          <div className="composer-row">
            <input
              id="message-input"
              name="message"
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Type a question..."
              disabled={loading}
            />
            {loading ? (
              <button type="button" className="stop-button" onClick={() => controllerRef.current?.abort()}>
                Stop
              </button>
            ) : (
              <button type="submit" disabled={!input.trim()}>Send</button>
            )}
          </div>
        </form>
      </footer>
    </main>
  )
}

export default App
