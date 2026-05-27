import { useState } from 'react'
import ChatInterface from './components/ChatInterface'

export default function App() {
  const [sessionKey, setSessionKey] = useState(0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <header style={{
        background: 'var(--blue-dark)',
        color: '#fff',
        padding: '0 24px',
        height: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>
            ContosoTech
          </span>
          <span style={{ opacity: 0.5, fontSize: 18 }}>|</span>
          <span style={{ fontSize: 14, opacity: 0.85 }}>HCC Risk Analytics</span>
        </div>
        <button
          onClick={() => setSessionKey(k => k + 1)}
          style={{
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)',
            color: '#fff',
            padding: '6px 14px',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          New Conversation
        </button>
      </header>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'hidden' }}>
        <ChatInterface key={sessionKey} />
      </main>
    </div>
  )
}
