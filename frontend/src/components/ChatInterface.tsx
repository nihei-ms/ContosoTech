import { useState, useRef, useEffect } from 'react'
import MessageBubble from './MessageBubble'
import ChartRenderer from './ChartRenderer'

const STARTERS = [
  'What is our overall HCC recapture rate for 2025?',
  'Show me the top 10 missed revenue opportunities by estimated impact',
  'Which providers have the lowest RAF scores?',
  'Compare our diabetes HCC prevalence rate to the CMS benchmark',
  'What is the trend of average RAF scores over the last 12 months?',
  'How many compliance opportunities are still open by category?',
]

interface ChartSpec {
  type: string
  title: string
  xKey: string
  yKey: string
  data: Record<string, unknown>[]
}

interface Message {
  role: 'user' | 'assistant'
  text: string
  chart?: ChartSpec
  sql?: string
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [threadId, setThreadId] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  async function sendMessage(question: string) {
    if (!question.trim() || loading) return
    setInput('')
    setMessages(prev => [...prev, { role: 'user', text: question }])
    setLoading(true)

    try {
      // Always use relative /api path — nginx proxies to backend at runtime
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, thread_id: threadId }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setThreadId(data.thread_id)
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: data.text,
        chart: data.chart?.type !== 'none' ? data.chart : undefined,
        sql: data.sql || undefined,
      }])
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        text: `Sorry, something went wrong. Please try again. (${err})`,
      }])
    } finally {
      setLoading(false)
    }
  }

  const isEmpty = messages.length === 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Messages area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
        {isEmpty ? (
          <div style={{ maxWidth: 720, margin: '40px auto', padding: '0 24px' }}>
            <h2 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8, color: 'var(--blue-dark)' }}>
              How can I help you today?
            </h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 28, fontSize: 15 }}>
              Ask any question about your HCC risk adjustment data. I'll query the database and
              explain the results in plain English.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {STARTERS.map(q => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius)',
                    padding: '14px 16px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: 14,
                    color: 'var(--text)',
                    boxShadow: 'var(--shadow)',
                    lineHeight: 1.4,
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--accent)'
                    ;(e.currentTarget as HTMLButtonElement).style.boxShadow = '0 2px 16px rgba(0,120,212,0.12)'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)'
                    ;(e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow)'
                  }}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ maxWidth: 820, margin: '0 auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
            {messages.map((msg, i) => (
              <div key={i}>
                <MessageBubble role={msg.role} text={msg.text} sql={msg.sql} />
                {msg.chart && <ChartRenderer chart={msg.chart} />}
              </div>
            ))}
            {loading && (
              <div style={{ display: 'flex', gap: 6, padding: '12px 0', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: 14 }}>Analyzing your data</span>
                <span style={{ animation: 'pulse 1.2s infinite', fontSize: 14 }}>...</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Input bar */}
      <div style={{
        padding: '16px 24px',
        borderTop: '1px solid var(--border)',
        background: 'var(--surface)',
        flexShrink: 0,
      }}>
        <div style={{
          maxWidth: 820,
          margin: '0 auto',
          display: 'flex',
          gap: 10,
        }}>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendMessage(input)}
            placeholder="Ask a question about your HCC data…"
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px 16px',
              fontSize: 15,
              border: '1px solid var(--border)',
              borderRadius: 8,
              outline: 'none',
              background: 'var(--bg)',
              color: 'var(--text)',
            }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={loading || !input.trim()}
            style={{
              background: loading || !input.trim() ? 'var(--border)' : 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              padding: '12px 22px',
              fontSize: 15,
              fontWeight: 600,
              cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Thinking…' : 'Ask'}
          </button>
        </div>
      </div>
    </div>
  )
}
