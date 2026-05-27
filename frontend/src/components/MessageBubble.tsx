import { useState } from 'react'

interface Props {
  role: 'user' | 'assistant'
  text: string
  sql?: string
}

export default function MessageBubble({ role, text, sql }: Props) {
  const [showSql, setShowSql] = useState(false)
  const isUser = role === 'user'

  return (
    <div style={{
      display: 'flex',
      justifyContent: isUser ? 'flex-end' : 'flex-start',
      gap: 10,
    }}>
      {/* Avatar */}
      {!isUser && (
        <div style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: 'var(--blue-dark)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 700,
          flexShrink: 0,
          marginTop: 2,
        }}>
          AI
        </div>
      )}

      <div style={{ maxWidth: '80%', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {/* Bubble */}
        <div style={{
          background: isUser ? 'var(--accent)' : 'var(--surface)',
          color: isUser ? '#fff' : 'var(--text)',
          padding: '12px 16px',
          borderRadius: isUser ? '18px 18px 4px 18px' : '4px 18px 18px 18px',
          boxShadow: 'var(--shadow)',
          border: isUser ? 'none' : '1px solid var(--border)',
          fontSize: 15,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
        }}>
          {text}
        </div>

        {/* Show SQL toggle */}
        {sql && !isUser && (
          <div>
            <button
              onClick={() => setShowSql(v => !v)}
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                borderRadius: 4,
                padding: '4px 10px',
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--text-secondary)',
              }}
            >
              {showSql ? 'Hide SQL ▲' : 'Show SQL ▼'}
            </button>
            {showSql && (
              <pre style={{
                marginTop: 6,
                background: '#1e1e2e',
                color: '#cdd6f4',
                padding: '12px 14px',
                borderRadius: 8,
                fontSize: 13,
                overflowX: 'auto',
                lineHeight: 1.5,
                fontFamily: "'Consolas', 'Courier New', monospace",
              }}>
                {sql}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
