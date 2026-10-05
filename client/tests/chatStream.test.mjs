import assert from 'node:assert/strict'
import test from 'node:test'
import { streamChat } from '../src/api/chatStream.ts'

const encoder = new TextEncoder()
const token = (text) => `data: ${JSON.stringify({ type: 'token', text })}\n\n`

async function run(t, response) {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'http://localhost:5000/api/chat/stream')
    assert.equal(init.method, 'POST')
    assert.deepEqual(JSON.parse(init.body), { message: 'hello' })
    if (response instanceof Error) throw response
    return response
  })
  const result = { tokens: [], errors: [], done: 0 }
  await streamChat('hello', {
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
  const finished = streamChat('hello', {
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
