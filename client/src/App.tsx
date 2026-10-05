import { useEffect, useRef } from 'react'
import type { Message } from './types/chat'
import './App.css'

function App() {
  // Static placeholders: replace these with your state declarations.
  const messages: Message[] = []
  const input: string = ''
  const loading: boolean = false
  const error: string = ''
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'nearest' })
  }, [messages.length, loading])

  function sendMessage() {
    // TODO: Implement message sending and state updates yourself.
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
            {/* TODO: Replace defaultValue with value={input} and add onChange using your setter. */}
            <input
              id="message-input"
              name="message"
              type="text"
              defaultValue={input}
              placeholder="Type a question..."
              disabled={loading}
            />
            <button type="submit" disabled={loading}>Send</button>
          </div>
        </form>
      </footer>
    </main>
  )
}

export default App