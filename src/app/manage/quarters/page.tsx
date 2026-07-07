'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, Quarter } from '@/lib/supabase'
import { ArrowLeft, Plus, Star, Loader2 } from 'lucide-react'
import { ManageNav } from '@/components/ManageNav'
import { TopNav } from '@/components/TopNav'

const QUARTER_OPTIONS = [1, 2, 3, 4]
const PAGE_SIZE = 1000
const BATCH_SIZE = 500

async function fetchAllValues(table: 'capability_values' | 'product_values', quarterId: string) {
  const rows: Record<string, unknown>[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase.from(table).select('*').eq('quarter_id', quarterId).range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    rows.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return rows
}

async function insertInBatches(table: 'capability_values' | 'product_values', rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + BATCH_SIZE))
    if (error) throw error
  }
}

/** Copies every value row from one quarter into a newly-created one, so a new
 * quarter starts as a full duplicate of the most recent data instead of blank --
 * researchers only need to touch what actually changed. */
async function copyQuarterValues(sourceQuarter: Quarter, targetQuarterId: string) {
  const [capRows, prodRows] = await Promise.all([
    fetchAllValues('capability_values', sourceQuarter.id),
    fetchAllValues('product_values', sourceQuarter.id),
  ])

  const stampCopy = (r: Record<string, unknown>, entityKey: 'firm_id' | 'product_id') => ({
    feature_id: r.feature_id,
    [entityKey]: r[entityKey],
    quarter_id: targetQuarterId,
    raw_text: r.raw_text,
    is_present: r.is_present,
    is_not_applicable: r.is_not_applicable,
    numeric_value: r.numeric_value,
    detail: r.detail,
    updated_by: `Carried over from ${sourceQuarter.label}`,
  })

  await insertInBatches('capability_values', capRows.map(r => stampCopy(r, 'firm_id')))
  await insertInBatches('product_values', prodRows.map(r => stampCopy(r, 'product_id')))
}

export default function ManageQuartersPage() {
  const [quarters, setQuarters] = useState<Quarter[]>([])
  const [loading, setLoading] = useState(true)
  const [copying, setCopying] = useState(false)
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
    const sourceQuarter = quarters.find(q => q.is_current) || quarters[0] || null

    const { data: newQuarter, error } = await supabase
      .from('quarters')
      .insert({ label, year, quarter_number: quarterNumber })
      .select()
      .single()
    if (error) {
      alert(error.message)
      return
    }

    if (sourceQuarter) {
      setCopying(true)
      try {
        await copyQuarterValues(sourceQuarter, newQuarter.id)
      } catch (e) {
        alert(`Quarter created, but copying ${sourceQuarter.label}'s data failed: ${e instanceof Error ? e.message : e}`)
      }
      setCopying(false)
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
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-400 hover:text-slate-900">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-light text-slate-900 tracking-tight">Manage Quarters</h1>
          </div>
          <TopNav active="manage" />
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
            disabled={copying}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            {copying ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            {copying ? 'Copying current data...' : 'Add Quarter'}
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-2">
          New quarters start as a full copy of the current quarter&apos;s data (marked &quot;Carried over&quot;), not blank --
          edit only what actually changed.
        </p>
      </div>
    </div>
  )
}
