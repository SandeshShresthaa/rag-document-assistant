export type UploadResult = { name: string; pages: number }

export async function uploadDocument(file: File, signal: AbortSignal): Promise<UploadResult> {
  const body = new FormData()
  body.append('file', file)
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
    || !('pages' in result) || typeof result.pages !== 'number' || !Number.isInteger(result.pages) || result.pages < 1) {
    throw new Error('The server returned an unexpected upload response. Please try again.')
  }
  return { name: result.name, pages: result.pages }
}
