export type Source = {
  documentName: string
  page: number
  snippet: string
  score: number
}

export type Message = {
  role: 'user' | 'assistant'
  text: string
  sources?: Source[]
}
