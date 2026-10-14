import { useEffect, useState } from 'react'
import { deleteDocument, listDocuments } from '../api/documents'
import type { DocumentSummary } from '../types/document'

type DocumentListProps = {
  sessionId: string
  refreshKey: number
}

export function DocumentList({ sessionId, refreshKey }: DocumentListProps) {
  const [documents, setDocuments] = useState<DocumentSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [deletingId, setDeletingId] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    void listDocuments(sessionId)
      .then((items) => {
        if (!controller.signal.aborted) {
          setDocuments(items)
          setError('')
        }
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'Unable to load documents.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [sessionId, refreshKey])

  async function remove(document: DocumentSummary) {
    if (deletingId) return
    setDeletingId(document.documentId)
    setError('')
    try {
      await deleteDocument(document.documentId, sessionId)
      setDocuments((current) => current.filter((item) => item.documentId !== document.documentId))
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete the document.')
    } finally {
      setDeletingId('')
    }
  }

  return (
    <section className="document-list" aria-labelledby="documents-heading">
      <h2 id="documents-heading">Your documents</h2>
      {loading && <p role="status">Loading documents...</p>}
      {!loading && documents.length === 0 && !error && <p>No documents uploaded yet.</p>}
      {documents.length > 0 && (
        <ul>
          {documents.map((document) => (
            <li key={document.documentId}>
              <span>
                <strong>{document.name}</strong>
                <small>{document.pages} {document.pages === 1 ? 'page' : 'pages'} · {document.chunks} {document.chunks === 1 ? 'chunk' : 'chunks'}</small>
              </span>
              <button type="button" disabled={Boolean(deletingId)}
                onClick={() => void remove(document)}>
                {deletingId === document.documentId ? 'Deleting...' : `Delete ${document.name}`}
              </button>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </section>
  )
}
