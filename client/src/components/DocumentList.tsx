import { useEffect, useState } from 'react'
import { deleteDocument, listDocuments } from '../api/documents'
import type { DocumentSummary } from '../types/document'

type DocumentListProps = {
  sessionId: string
  refreshKey: number
  onCountChange: (count: number) => void
}

export function DocumentList({ sessionId, refreshKey, onCountChange }: DocumentListProps) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [waking, setWaking] = useState(false)
  const [deletingId, setDeletingId] = useState('')
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    const wakingTimer = window.setTimeout(() => setWaking(true), 3000)
    void listDocuments(sessionId)
      .then((items) => {
        if (!controller.signal.aborted) {
          setDocuments(items)
          onCountChange(items.length)
          setError('')
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Unable to load documents.')
      })
      .finally(() => {
        window.clearTimeout(wakingTimer)
        if (!controller.signal.aborted) {
          setLoading(false)
          setWaking(false)
        }
      })
    return () => {
      window.clearTimeout(wakingTimer)
      controller.abort()
    }
  }, [sessionId, refreshKey, reloadKey, onCountChange])

  async function remove(document: DocumentSummary) {
    if (deletingId) return
    setDeletingId(document.documentId)
    setError('')
    try {
      await deleteDocument(document.documentId, sessionId)
      setDocuments((current) => current.filter((item) => item.documentId !== document.documentId))
      onCountChange(Math.max(0, documents.length - 1))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete the document.')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <section className="document-list" aria-labelledby="documents-heading">
      <h2 id="documents-heading">Your documents</h2>
      {loading && <p role="status">{waking
        ? 'Waking up the server. This can take about 30 seconds...'
        : 'Loading documents...'}</p>}
      {!loading && documents.length === 0 && !error && <p>No documents uploaded yet.</p>}
      {documents.length > 0 && (
        <ul>
          {documents.map((document) => (
            <li key={document.documentId}>
              <span>
                <strong>{document.name}</strong>
                <small>{document.pages} {document.pages === 1 ? 'page' : 'pages'} · {document.chunks} {document.chunks === 1 ? 'chunk' : 'chunks'}</small>
              </span>
              <button type="button" disabled={Boolean(deletingId)} aria-label={`Delete ${document.name}`}
                onClick={() => void remove(document)}>
                {deletingId === document.documentId ? 'Deleting...' : 'Delete'}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <div className="error-row">
          <p className="error" role="alert">{error}</p>
          <button type="button" onClick={() => {
            setLoading(true)
            setWaking(false)
            setReloadKey((value) => value + 1)
          }}>Retry</button>
        </div>
      )}
    </section>
  )
}
