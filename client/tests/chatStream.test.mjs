import assert from 'node:assert/strict'
import test from 'node:test'
import { streamChat } from '../src/api/chatStream.ts'

const encoder = new TextEncoder()
const token = (text) => `data: ${JSON.stringify({ type: 'token', text })}\n\n`
const sourceList = [{
  documentName: 'guide.pdf', page: 2, snippet: 'Stored in MongoDB.', score: 0.91,
}]
const sources = (items = sourceList) => `data: ${JSON.stringify({ type: 'sources', sources: items })}\n\n`
const sessionId = '123e4567-e89b-42d3-a456-426614174000'

async function run(t, response) {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'http://localhost:5000/api/chat')
    assert.equal(init.method, 'POST')
    assert.deepEqual(JSON.parse(init.body), { message: 'hello', sessionId })
    if (response instanceof Error) throw response
    return response
  })
  const result = { tokens: [], errors: [], done: 0 }
  await streamChat('hello', sessionId, {
    onToken: (text) => result.tokens.push(text),
    onDone: () => result.done++,
    onError: (message) => result.errors.push(message),
  })
  return result
}

function sse(text, byteByByte = false) {
  const bytes = encoder.encode(text)
  return new Response(new ReadableStream({
    start(controller) {
      if (byteByByte) {
        for (const byte of bytes) controller.enqueue(Uint8Array.of(byte))
      } else controller.enqueue(bytes)
      controller.close()
    },
  }), { headers: { 'Content-Type': 'text/event-stream' } })
}

test('buffers byte-split events, UTF-8 characters, CRLF, and DONE', async (t) => {
  const text = (token('नमस्ते 🌍') + token('\nHello') + 'data: [DONE]\n\n').replaceAll('\n', '\r\n')
  assert.deepEqual(await run(t, sse(text, true)), {
    tokens: ['नमस्ते 🌍', '\nHello'], errors: [], done: 1,
  })
})

test('reads coalesced events and stops at DONE', async (t) => {
  assert.deepEqual(await run(t, sse(token('A') + token('B') + 'data: [DONE]\n\n' + token('ignored'))), {
    tokens: ['A', 'B'], errors: [], done: 1,
  })
})

test('keeps partial text and reports a server error without success', async (t) => {
  assert.deepEqual(await run(t, sse(token('partial') + 'data: {"type":"error","message":"Model busy"}\n\ndata: [DONE]\n\n')), {
    tokens: ['partial'], errors: ['Model busy'], done: 0,
  })
})

test('delivers validated source metadata', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    sse(sources() + token('Answer [1].') + 'data: [DONE]\n\n'))
  const received = []
  await streamChat('hello', sessionId, {
    onToken: () => {},
    onSources: (items) => received.push(...items),
    onDone: () => {},
    onError: assert.fail,
  })
  assert.deepEqual(received, sourceList)
})

test('rejects malformed source metadata', async (t) => {
  const result = await run(t, sse(sources([{ documentName: 'guide.pdf', page: 0 }]) + token('ignored')))
  assert.equal(result.errors[0], 'The server returned invalid sources.')
  assert.equal(result.done, 0)
})

for (const [name, response] of [
  ['premature EOF', () => sse(token('partial'))],
  ['malformed JSON', () => sse('data: {bad}\n\n')],
  ['invalid token', () => sse('data: {"type":"token","text":5}\n\n')],
  ['empty answer', () => sse('data: [DONE]\n\n')],
  ['HTTP error', () => new Response('Unavailable', { status: 503 })],
  ['wrong content type', () => new Response('{}')],
  ['network failure', () => new TypeError('fetch failed')],
]) {
  test(`reports ${name}`, async (t) => {
    const result = await run(t, response())
    assert.equal(result.errors.length, 1)
    assert.equal(result.done, 0)
  })
}

test('delivers text before the stream closes', async (t) => {
  let controller
  const stream = new ReadableStream({ start(value) { controller = value } })
  t.mock.method(globalThis, 'fetch', async () => new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream' },
  }))
  let received
  const firstToken = new Promise((resolve) => { received = resolve })
  const finished = streamChat('hello', sessionId, {
    onToken: received,
    onDone: () => {},
    onError: assert.fail,
  })
  controller.enqueue(encoder.encode(token('first')))
  assert.equal(await firstToken, 'first')
  controller.enqueue(encoder.encode('data: [DONE]\n\n'))
  controller.close()
  await finished
})

test('abort before fetch is silent and makes no request', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => assert.fail('must not fetch'))
  const controller = new AbortController()
  controller.abort()
  await streamChat('hello', sessionId, {
    signal: controller.signal, onToken: assert.fail, onDone: assert.fail, onError: assert.fail,
  })
})

test('abort in a token callback prevents queued tokens and DONE', async (t) => {
  const controller = new AbortController()
  const response = sse(token('first') + token('late') + 'data: [DONE]\n\n')
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    assert.equal(init.signal, controller.signal)
    return response
  })
  const tokens = []
  await streamChat('hello', sessionId, {
    signal: controller.signal,
    onToken: (text) => { tokens.push(text); controller.abort() },
    onDone: assert.fail,
    onError: assert.fail,
  })
  assert.deepEqual(tokens, ['first'])
  assert.equal(response.body.locked, false)
})

test('AbortError while reading is a normal stop and releases the reader', async (t) => {
  const response = new Response(new ReadableStream({
    pull(controller) { controller.error(new DOMException('Stopped', 'AbortError')) },
  }), { headers: { 'Content-Type': 'text/event-stream' } })
  t.mock.method(globalThis, 'fetch', async () => response)
  await streamChat('hello', sessionId, { onToken: assert.fail, onDone: assert.fail, onError: assert.fail })
  assert.equal(response.body.locked, false)
})
