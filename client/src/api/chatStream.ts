type StreamChatOptions = {
  onToken: (text: string) => void
  onDone: () => void
  onError: (message: string) => void
  signal?: AbortSignal
}

export async function streamChat(message: string, sessionId: string, options: StreamChatOptions): Promise<void> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  try {
    options.signal?.throwIfAborted()
    const apiUrl = import.meta.env?.VITE_API_URL ?? 'http://localhost:5000'
    const response = await fetch(`${apiUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, sessionId }),
      signal: options.signal,
    })

    if (!response.ok) throw new Error('Unable to get an answer. Please try again.')
    if (!response.headers.get('content-type')?.includes('text/event-stream') || !response.body) {
      throw new Error('The server did not return a chat stream.')
    }

    reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let receivedText = false

    for (;;) {
      const { value, done } = await reader.read()
      options.signal?.throwIfAborted()
      // Streaming decoding preserves characters split across network chunks.
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true })
      buffer = buffer.replace(/\r\n/g, '\n')

      let boundary = buffer.indexOf('\n\n')
      while (boundary !== -1) {
        options.signal?.throwIfAborted()
        const event = buffer.slice(0, boundary)
        buffer = buffer.slice(boundary + 2)
        const data = event.split('\n')
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).replace(/^ /, ''))
          .join('\n')

        if (data === '[DONE]') {
          if (!receivedText) throw new Error('The server returned an empty answer. Please try again.')
          options.onDone()
          return
        }
        if (data) {
          let parsed: unknown
          try { parsed = JSON.parse(data) }
          catch { throw new Error('The server returned an invalid chat event.') }
          if (typeof parsed !== 'object' || parsed === null || !('type' in parsed)) {
            throw new Error('The server returned an invalid chat event.')
          }
          if (parsed.type === 'token') {
            if (!('text' in parsed) || typeof parsed.text !== 'string') {
              throw new Error('The server returned an invalid text chunk.')
            }
            receivedText ||= parsed.text.length > 0
            options.onToken(parsed.text)
          } else if (parsed.type === 'error') {
            throw new Error('message' in parsed && typeof parsed.message === 'string'
              ? parsed.message : 'Unable to finish the answer. Please try again.')
          }
        }
        boundary = buffer.indexOf('\n\n')
      }
      // Keep an incomplete event in buffer for the next read.
      if (done) throw new Error('The connection ended before the answer finished. Please try again.')
    }
  } catch (err) {
    if (options.signal?.aborted || (err instanceof Error && err.name === 'AbortError')) return
    options.onError(err instanceof TypeError
      ? 'Unable to reach the server. Check your connection and make sure the server is running.'
      : err instanceof Error ? err.message : 'Something went wrong. Please try again.')
  } finally {
    if (reader) {
      try { await reader.cancel() } catch { /* The connection may already be closed. */ }
      reader.releaseLock()
    }
  }
}
