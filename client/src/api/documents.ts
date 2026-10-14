import type { DocumentSummary } from '../types/document'

const apiUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:5000'

export async function listDocuments(sessionId: string): Promise<DocumentSummary[]> {
  const response = await fetch(`${apiUrl}/api/documents?sessionId=${encodeURIComponent(sessionId)}`)
  const result: unknown = await response.json()
  if (!response.ok) throw new Error(readError(result, 'Unable to load documents.'))
  if (typeof result !== 'object' || result === null || !('documents' in result) ||
    !Array.isArray(result.documents) || !result.documents.every(isDocumentSummary)) {
    throw new Error('The server returned an unexpected document list.')
  }
  return result.documents
}

export async function deleteDocument(documentId: string, sessionId: string): Promise<void> {
  const response = await fetch(
    `${apiUrl}/api/documents/${encodeURIComponent(documentId)}?sessionId=${encodeURIComponent(sessionId)}`,
    { method: 'DELETE' },
  )
  if (response.ok) return
  let result: unknown
  try { result = await response.json() } catch { result = undefined }
  throw new Error(readError(result, 'Unable to delete the document.'))
}

function readError(result: unknown, fallback: string): string {
  return typeof result === 'object' && result !== null &&
    'error' in result && typeof result.error === 'string' ? result.error : fallback
}

function isDocumentSummary(value: unknown): value is DocumentSummary {
  return typeof value === 'object' && value !== null &&
    'documentId' in value && typeof value.documentId === 'string' &&
    'name' in value && typeof value.name === 'string' &&
    'pages' in value && typeof value.pages === 'number' && Number.isInteger(value.pages) &&
    'chunks' in value && typeof value.chunks === 'number' && Number.isInteger(value.chunks) &&
    'createdAt' in value && typeof value.createdAt === 'string'
}
