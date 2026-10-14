export type UploadResult = { documentId: string; name: string; pages: number; chunks: number }

export async function uploadDocument(file: File, sessionId: string, signal: AbortSignal): Promise<UploadResult> {
  const body = new FormData()
  body.append('file', file)
  body.append('sessionId', sessionId)
  let response: Response
  try {
    response = await fetch(`${import.meta.env.VITE_API_URL}/api/documents`, {
      method: 'POST', body, signal,
    })
  } catch (error) {
    if (signal.aborted) throw error
    throw new Error('Unable to reach the server. Check that it is running and try again.', { cause: error })
  }
  const result: unknown = await response.json()
  if (!response.ok) {
    throw new Error(typeof result === 'object' && result !== null && 'error' in result && typeof result.error === 'string'
      ? result.error : 'Unable to upload the PDF. Please try again.')
  }
  if (typeof result !== 'object' || result === null || !('name' in result) || typeof result.name !== 'string'
    || !('documentId' in result) || typeof result.documentId !== 'string'
    || !('pages' in result) || typeof result.pages !== 'number' || !Number.isInteger(result.pages) || result.pages < 1
    || !('chunks' in result) || typeof result.chunks !== 'number' || !Number.isInteger(result.chunks) || result.chunks < 1) {
    throw new Error('The server returned an unexpected upload response. Please try again.')
  }
  return { documentId: result.documentId, name: result.name, pages: result.pages, chunks: result.chunks }
}
