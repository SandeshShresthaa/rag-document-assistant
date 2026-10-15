import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => { await page.goto('/') })

test('empty input is blocked; Enter shows Thinking and progressive text', async ({ page }) => {
  const input = page.getByRole('textbox', { name: 'Your message' })
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled()
  await input.fill('   ')
  await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeDisabled()
  await input.fill('hello')
  await input.press('Enter')
  await expect(page.getByRole('status')).toHaveText('Thinking...')
  await expect(page.getByRole('button', { name: 'Stop', exact: true })).toBeVisible()
  const answer = page.locator('.message-assistant > p')
  await expect(answer).toHaveText('First chunk.')
  await expect(page.getByRole('status')).toHaveCount(0)
  await expect(answer).toHaveText('First chunk. Final chunk.')
  await expect(input).toBeEnabled()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('grounded answers show aligned source details', async ({ page }) => {
  await page.getByRole('textbox').fill('citation')
  await page.getByRole('textbox').press('Enter')
  await expect(page.locator('.message-assistant > p')).toHaveText('Answer from the document [1].')
  const panel = page.getByText('Sources (1)', { exact: true })
  await expect(panel).toBeVisible()
  await panel.click()
  await expect(page.getByText('[1] test.pdf', { exact: true })).toBeVisible()
  await expect(page.getByText('Page 1 · Score 0.900', { exact: true })).toBeVisible()
  await expect(page.getByText('Test browser context.', { exact: true })).toBeVisible()
})

test('no-context answers do not show a Sources panel', async ({ page }) => {
  await page.getByRole('textbox').fill('off-topic')
  await page.getByRole('textbox').press('Enter')
  await expect(page.locator('.message-assistant > p')).toContainText("I couldn't find that in your documents.")
  await expect(page.getByText(/Sources \(/)).toHaveCount(0)
})

for (const prompt of ['slow', 'delayed']) {
  test(`Stop cancels ${prompt} response and another message succeeds`, async ({ page, request }) => {
    const before = await (await request.get('http://127.0.0.1:5051/test-state')).json()
    const input = page.getByRole('textbox', { name: 'Your message' })
    await input.fill(prompt)
    await input.press('Enter')
    if (prompt === 'slow') await expect(page.locator('.message-assistant > p')).toHaveText('First chunk.')
    else await expect(page.getByRole('status')).toHaveText('Thinking...')
    await page.getByRole('button', { name: 'Stop', exact: true }).click()
    await expect(input).toBeEnabled()
    await expect(page.getByRole('button', { name: 'Send', exact: true })).toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect.poll(async () => (await (await request.get('http://127.0.0.1:5051/test-state')).json()).aborted)
      .toBe(before.aborted + 1)
    if (prompt === 'slow') await expect(page.locator('.message-assistant > p')).toHaveText('First chunk.')
    await input.fill('again')
    await input.press('Enter')
    await expect(page.locator('.message-assistant > p').last()).toHaveText('First chunk. Final chunk.')
    await expect(input).toBeEnabled()
  })
}

test('mid-stream error keeps partial text and permits another request', async ({ page }) => {
  const input = page.getByRole('textbox', { name: 'Your message' })
  await input.fill('error')
  await input.press('Enter')
  await expect(page.getByRole('alert')).toHaveText('Unable to finish the answer. Please try again.')
  await expect(page.locator('.message-assistant > p')).toHaveText('First chunk.')
  await expect(input).toBeEnabled()
  await input.fill('again')
  await input.press('Enter')
  await expect(page.locator('.message-assistant > p').last()).toHaveText('First chunk. Final chunk.')
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('Retry replaces a failed answer and restores the conversation', async ({ page }) => {
  const input = page.getByRole('textbox', { name: 'Your message' })
  await input.fill('error-once')
  await input.press('Enter')
  await expect(page.getByRole('alert')).toHaveText('Unable to finish the answer. Please try again.')
  await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible()
  await page.getByRole('button', { name: 'Retry' }).click()
  await expect(page.locator('.message-assistant > p')).toHaveText('First chunk. Final chunk.')
  await expect(page.getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0)
})

test('network failure shows a friendly error and restores controls', async ({ page }) => {
  await page.route('**/api/chat', (route) => route.abort('connectionrefused'))
  await page.getByRole('textbox').fill('hello')
  await page.getByRole('button', { name: 'Send', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Unable to reach the server')
  await expect(page.getByRole('textbox')).toBeEnabled()
})

test('leaving the page cancels the active request', async ({ page, request }) => {
  const before = await (await request.get('http://127.0.0.1:5051/test-state')).json()
  await page.getByRole('textbox').fill('slow')
  await page.getByRole('textbox').press('Enter')
  await expect(page.locator('.message-assistant > p')).toHaveText('First chunk.')
  await page.goto('about:blank')
  await expect.poll(async () => (await (await request.get('http://127.0.0.1:5051/test-state')).json()).aborted)
    .toBe(before.aborted + 1)
})
