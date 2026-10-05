import { useEffect, useRef, useState } from 'react'
import type { Message } from './types/chat'
import './App.css'

function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.length, loading])

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return

    setMessages((previous) => [...previous, { role: 'user', text }])
    setInput('')
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      })

      if (!response.ok) {
        throw new Error('Unable to get an answer. Please try again.')
      }

      const data: unknown = await response.json()
      if (
        typeof data !== 'object' || data === null ||
        !('reply' in data) || typeof data.reply !== 'string' || !data.reply.trim()
      ) {
        throw new Error('The server returned an empty or invalid answer. Please try again.')
      }

      const reply = data.reply
      setMessages((previous) => [...previous, { role: 'assistant', text: reply }])
    } catch (err) {
      setError(err instanceof TypeError
        ? 'Unable to reach the server. Check your connection and make sure the server is running.'
        : err instanceof Error ? err.message : 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="chat">
      <header className="chat-header">
        <h1>Document Assistant</h1>
        <p>Ask a question to start a conversation.</p>
      </header>

      <section className="message-list" role="log" aria-label="Conversation" aria-live="polite">
        {messages.length === 0 && (
          <p className="empty-state">Your conversation will appear here.</p>
        )}
        {messages.map((message, index) => (
          <article className={`message message-${message.role}`} key={index}>
            <span className="message-role">{message.role === 'user' ? 'You' : 'Assistant'}</span>
            <p>{message.text}</p>
          </article>
        ))}
        {loading && (
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
            <button type="submit" disabled={loading || !input.trim()}>Send</button>
          </div>
        </form>
      </footer>
    </main>
  )
}

export default App
