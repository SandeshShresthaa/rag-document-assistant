import type { Source } from '../types/chat'

type SourcesPanelProps = {
  sources: Source[]
}

export function SourcesPanel({ sources }: SourcesPanelProps) {
  if (sources.length === 0) return null

  return (
    <details className="sources-panel">
      <summary>Sources ({sources.length})</summary>
      <ol>
        {sources.map((source, index) => (
          <li key={`${source.documentName}-${source.page}-${index}`}>
            <strong>[{index + 1}] {source.documentName}</strong>
            <span>Page {source.page} · Score {source.score.toFixed(3)}</span>
            <p>{source.snippet}</p>
          </li>
        ))}
      </ol>
    </details>
  )
}
