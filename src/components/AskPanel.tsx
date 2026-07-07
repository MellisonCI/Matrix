'use client'

import { useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'

const EXAMPLES = [
  'Which firms don\'t offer live chat?',
  'How does Chase compare to Ally on authentication features?',
  'Which firm has the most checking account products?',
]

export function AskPanel() {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function ask(q: string) {
    if (!q.trim() || loading) return
    setLoading(true)
    setError(null)
    setAnswer(null)
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
      } else {
        setAnswer(data.answer)
      }
    } catch {
      setError('Could not reach the server.')
    }
    setLoading(false)
  }

  return (
    <div className="p-5 bg-white border border-slate-200 rounded-xl mb-6">
      <div className="flex items-center gap-2 mb-0.5">
        <Sparkles size={15} className="text-slate-400" />
        <h2 className="text-sm font-medium text-slate-800">Ask a question</h2>
      </div>
      <p className="text-xs text-slate-400 mb-3">Ask about the data in plain language -- it looks up real values before answering.</p>

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
          placeholder="e.g. Which firms offer person-to-person payments via Zelle?"
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

      {!answer && !error && !loading && (
        <div className="flex flex-wrap gap-2">
          {EXAMPLES.map(ex => (
            <button
              key={ex}
              onClick={() => {
                setQuestion(ex)
                ask(ex)
              }}
              className="text-xs px-2.5 py-1 bg-slate-50 hover:bg-slate-100 text-slate-500 rounded-full border border-slate-200"
            >
              {ex}
            </button>
          ))}
        </div>
      )}

      {loading && <div className="text-sm text-slate-400">Looking that up...</div>}
      {error && <div className="text-sm text-red-500">{error}</div>}
      {answer && <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{answer}</div>}
    </div>
  )
}
