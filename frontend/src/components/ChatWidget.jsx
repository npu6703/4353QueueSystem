import { useState, useRef, useEffect } from 'react'
import { getCurrentUser } from '../services/localApi'
import { API_BASE } from '../config'
import '../styles/ChatWidget.css'

const WELCOME = {
  role: 'assistant',
  content: "Hi! I'm your QueueSmart Assistant. Ask me about wait times, which service to join, or your current position.",
}

export default function ChatWidget({ serviceId }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState([WELCOME])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)
  const user = getCurrentUser()

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [open, messages])

  async function send() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    const userMsg = { role: 'user', content: text }
    setMessages((prev) => [...prev, userMsg])
    setLoading(true)

    try {
      const history = messages.filter((m) => m !== WELCOME)
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Backend now requires user-id for /api/chat (auth + per-user rate
          // limit). userId in the body is no longer used; the server pulls it
          // from this header.
          'user-id': user?.id != null ? String(user.id) : '',
        },
        body: JSON.stringify({
          message: text,
          serviceId: serviceId || null,
          history,
        }),
      })
      const data = await res.json()
      const reply = res.ok ? data.reply : (data.error || 'Something went wrong.')
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Unable to reach the AI assistant right now.' },
      ])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="cw-root">
      {open && (
        <div className="cw-panel">
          <div className="cw-header">
            <div className="cw-header-left">
              <div className="cw-avatar">AI</div>
              <div>
                <div className="cw-title">QueueSmart Assistant</div>
                <div className="cw-subtitle">Self-hosted · Gemma 3</div>
              </div>
            </div>
            <button className="cw-close" onClick={() => setOpen(false)} aria-label="Close">✕</button>
          </div>

          <div className="cw-messages">
            {messages.map((m, i) => (
              <div key={i} className={`cw-msg cw-msg-${m.role}`}>
                {m.role === 'assistant' && <div className="cw-msg-avatar">AI</div>}
                <div className="cw-bubble">{m.content}</div>
              </div>
            ))}
            {loading && (
              <div className="cw-msg cw-msg-assistant">
                <div className="cw-msg-avatar">AI</div>
                <div className="cw-bubble cw-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="cw-input-area">
            <input
              ref={inputRef}
              className="cw-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about wait times, queues..."
              maxLength={500}
              disabled={loading}
            />
            <button className="cw-send" onClick={send} disabled={!input.trim() || loading}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <button className="cw-fab" onClick={() => setOpen((v) => !v)} aria-label="Open AI assistant">
        {open ? (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
        {!open && <span className="cw-fab-badge">AI</span>}
      </button>
    </div>
  )
}
