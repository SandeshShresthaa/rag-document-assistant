import { useState } from 'react'

const STORAGE_KEY = 'rag-document-assistant-session-id'

function getOrCreateSessionId(): string {
  const existing = localStorage.getItem(STORAGE_KEY)
  if (existing) return existing
  const sessionId = crypto.randomUUID()
  localStorage.setItem(STORAGE_KEY, sessionId)
  return sessionId
}

export function useSessionId(): string {
  const [sessionId] = useState(getOrCreateSessionId)
  return sessionId
}
