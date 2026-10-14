import { test, expect } from '@playwright/test'
import { makePdf } from '../../../server/test/pdfFixture.ts'

test.beforeEach(async ({ page }) => { await page.goto('/') })

test('uploads a real two-page PDF and shows success', async ({ page }) => {
  await expect(page.getByRole('button', { name: 'Upload', exact: true })).toBeDisabled()
  await page.getByLabel('Upload a PDF').setInputFiles({
    name: 'sample.pdf', mimeType: 'application/pdf',
    buffer: makePdf(['First page contains enough searchable text for a chunk.', 'Second page also contains enough searchable text for a chunk.']),
  })
  await page.getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(page.locator('.upload-box [role="status"]')).toHaveText('Saved sample.pdf: 2 pages, 2 chunks.')
  await expect(page.getByText('sample.pdf', { exact: true })).toBeVisible()
  await expect(page.getByRole('alert')).toHaveCount(0)
})

test('lists an uploaded document and deletes it from this session', async ({ page }) => {
  await page.getByLabel('Upload a PDF').setInputFiles({
    name: 'delete-me.pdf', mimeType: 'application/pdf',
    buffer: makePdf(['This document contains enough searchable text to delete.']),
  })
  await page.getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(page.getByText('delete-me.pdf', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Delete delete-me.pdf' }).click()
  await expect(page.getByText('delete-me.pdf', { exact: true })).toHaveCount(0)
  await expect(page.getByText('No documents uploaded yet.')).toBeVisible()
})

for (const [name, mimeType, buffer, message] of [
  ['notes.txt', 'text/plain', Buffer.from('hello'), 'Only PDF files'],
  ['large.pdf', 'application/pdf', Buffer.alloc(5 * 1024 * 1024 + 1), '5 MB or smaller'],
  ['scan.pdf', 'application/pdf', makePdf([null]), 'No text found'],
  ['broken.pdf', 'application/pdf', Buffer.from('%PDF-1.4\nbroken'), 'corrupted'],
]) {
  test(`shows server validation for ${name} and recovers`, async ({ page }) => {
    await page.getByLabel('Upload a PDF').setInputFiles({ name, mimeType, buffer })
    await page.getByRole('button', { name: 'Upload', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText(message)
    await expect(page.getByLabel('Upload a PDF')).toBeEnabled()
    await page.getByLabel('Upload a PDF').setInputFiles({
      name: 'valid.pdf', mimeType: 'application/pdf', buffer: makePdf(['Recovery PDF contains enough searchable text for a chunk.']),
    })
    await page.getByRole('button', { name: 'Upload', exact: true }).click()
    await expect(page.locator('.upload-box [role="status"]')).toHaveText('Saved valid.pdf: 1 page, 1 chunk.')
    await expect(page.getByRole('alert')).toHaveCount(0)
  })
}

test('shows upload progress and a friendly network error', async ({ page }) => {
  let failUpload
  const pending = new Promise((resolve) => { failUpload = resolve })
  await page.route('**/api/documents', async (route) => { await pending; await route.abort('connectionrefused') })
  await page.getByLabel('Upload a PDF').setInputFiles({ name: 'sample.pdf', mimeType: 'application/pdf', buffer: makePdf(['Text']) })
  await page.getByRole('button', { name: 'Upload', exact: true }).click()
  await expect(page.locator('.upload-box [role="status"]')).toHaveText('Uploading and extracting text...')
  await expect(page.getByLabel('Upload a PDF')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Uploading...' })).toBeDisabled()
  failUpload()
  await expect(page.getByRole('alert')).toContainText('Unable to reach the server')
  await expect(page.getByRole('button', { name: 'Upload', exact: true })).toBeEnabled()
})
