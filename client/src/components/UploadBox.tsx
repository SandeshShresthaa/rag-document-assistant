import { useEffect, useRef, useState } from 'react'
import { uploadDocument } from '../api/uploadDocument'

export function UploadBox() {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const controllerRef = useRef<AbortController | null>(null)
  useEffect(() => () => controllerRef.current?.abort(), [])

  async function upload() {
    if (!file || controllerRef.current) return
    const controller = new AbortController()
    controllerRef.current = controller
    setUploading(true)
    setError('')
    setStatus('Uploading and extracting text...')
    try {
      const result = await uploadDocument(file, controller.signal)
      setStatus(`Extracted text from ${result.name} (${result.pages} ${result.pages === 1 ? 'page' : 'pages'}).`)
    } catch (error) {
      if (!controller.signal.aborted) {
        setStatus('')
        setError(error instanceof Error ? error.message : 'Unable to upload the PDF. Please try again.')
      }
    } finally {
      controllerRef.current = null
      if (!controller.signal.aborted) setUploading(false)
    }
  }

  return (
    <form className="upload-box" onSubmit={(event) => { event.preventDefault(); void upload() }}>
      <label htmlFor="pdf-upload">Upload a PDF</label>
      <p id="upload-help">Up to 5 MB. Text extraction only; documents are not saved or used in chat yet.</p>
      <div className="upload-row">
        <input id="pdf-upload" type="file" accept=".pdf,application/pdf" aria-describedby="upload-help"
          disabled={uploading} onChange={(event) => {
            setFile(event.target.files?.[0] ?? null)
            setStatus('')
            setError('')
          }} />
        <button type="submit" disabled={!file || uploading}>{uploading ? 'Uploading...' : 'Upload'}</button>
      </div>
      {status && <p role="status">{status}</p>}
      {error && <p className="error" role="alert">{error}</p>}
    </form>
  )
}
