'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, Quarter } from '@/lib/supabase'
import { ArrowLeft, Plus, Star } from 'lucide-react'
import { ManageNav } from '@/components/ManageNav'

const QUARTER_OPTIONS = [1, 2, 3, 4]

export default function ManageQuartersPage() {
  const [quarters, setQuarters] = useState<Quarter[]>([])
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [quarterNumber, setQuarterNumber] = useState(1)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase
      .from('quarters')
      .select('*')
      .order('year', { ascending: false })
      .order('quarter_number', { ascending: false })
    setQuarters(data || [])
    setLoading(false)
  }

  async function addQuarter() {
    const label = `Q${quarterNumber} ${year}`
    const { error } = await supabase.from('quarters').insert({ label, year, quarter_number: quarterNumber })
    if (error) {
      alert(error.message)
      return
    }
    load()
  }

  async function setCurrent(id: string) {
    await supabase.from('quarters').update({ is_current: false }).neq('id', id)
    await supabase.from('quarters').update({ is_current: true }).eq('id', id)
    load()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-slate-900">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-light text-slate-900 tracking-tight">Manage Quarters</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <ManageNav active="quarters" />

        {loading ? (
          <div className="text-slate-400 text-sm">Loading...</div>
        ) : (
          <div className="space-y-2 mb-6">
            {quarters.map(q => (
              <div key={q.id} className="flex items-center justify-between p-3 bg-white border border-slate-200 rounded-lg">
                <span className="text-sm text-slate-900">{q.label}</span>
                <button
                  onClick={() => setCurrent(q.id)}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-md ${
                    q.is_current ? 'bg-amber-50 text-amber-600' : 'text-slate-400 hover:text-slate-700'
                  }`}
                >
                  <Star size={12} fill={q.is_current ? 'currentColor' : 'none'} />
                  {q.is_current ? 'Current' : 'Mark current'}
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-end gap-2">
          <div>
            <label className="block text-xs text-slate-500 mb-1">Quarter</label>
            <select
              value={quarterNumber}
              onChange={e => setQuarterNumber(Number(e.target.value))}
              className="bg-white border border-slate-300 text-slate-900 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-slate-400"
            >
              {QUARTER_OPTIONS.map(n => (
                <option key={n} value={n}>Q{n}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Year</label>
            <input
              type="number"
              value={year}
              onChange={e => setYear(Number(e.target.value))}
              className="w-24 bg-white border border-slate-300 text-slate-900 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-slate-400"
            />
          </div>
          <button
            onClick={addQuarter}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
          >
            <Plus size={14} />
            Add Quarter
          </button>
        </div>
      </div>
    </div>
  )
}
