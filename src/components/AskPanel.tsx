'use client'

import { useState } from 'react'
import { Sparkles, Loader2, RotateCcw } from 'lucide-react'

const EXAMPLES = [
  'Which firms don\'t offer live chat?',
  'How does Chase compare to Ally on authentication features?',
  'Which firm has the most checking account products?',
]

interface Exchange {
  question: string
  answer: string
}

export function AskPanel() {
  const [question, setQuestion] = useState('')
  const [exchanges, setExchanges] = useState<Exchange[]>([])
  const [history, setHistory] = useState<unknown[]>([]) // Claude's own message format, resent each turn for follow-ups
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function ask(q: string) {
    if (!q.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, history }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
      } else {
        setExchanges(prev => [...prev, { question: q, answer: data.answer }])
        setHistory(data.history || [])
        setQuestion('')
      }
    } catch {
      setError('Could not reach the server.')
    }
    setLoading(false)
  }

  function reset() {
    setExchanges([])
    setHistory([])
    setError(null)
    setQuestion('')
  }

  return (
    <div className="p-5 bg-white border border-slate-200 rounded-xl mb-6">
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-slate-400" />
          <h2 className="text-sm font-medium text-slate-800">Ask a question</h2>
        </div>
        {exchanges.length > 0 && (
          <button onClick={reset} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700">
            <RotateCcw size={12} />
            New conversation
          </button>
        )}
      </div>
      <p className="text-xs text-slate-400 mb-3">
        Ask about the data in plain language -- it looks up real values before answering. Follow-up questions keep the conversation going.
      </p>

      {exchanges.length > 0 && (
        <div className="space-y-4 mb-4 max-h-96 overflow-y-auto pr-1">
          {exchanges.map((ex, i) => (
            <div key={i}>
              <div className="text-sm font-medium text-slate-800 mb-1">{ex.question}</div>
              <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{ex.answer}</div>
            </div>
          ))}
        </div>
      )}

      <form
        onSubmit={e => {
          e.preventDefault()
          ask(question)
        }}
        className="flex gap-2 mb-3"
      >
        <input
          type="text"
          value={question}
          onChange={e => setQuestion(e.target.value)}
          placeholder={exchanges.length > 0 ? 'Ask a follow-up...' : 'e.g. Which firms offer person-to-person payments via Zelle?'}
          className="flex-1 bg-white border border-slate-300 text-slate-900 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-slate-400"
        />
        <button
          type="submit"
          disabled={loading || !question.trim()}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          Ask
        </button>
      </form>

      {exchanges.length === 0 && !loading && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map(ex => (
            <button
              key={ex}
              onClick={() => ask(ex)}
              className="text-xs px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-full border border-slate-200"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {loading && <div className="text-sm text-slate-400">Looking that up...</div>}
      {error && <div className="text-sm text-red-500">{error}</div>}
    </div>
  )
}
