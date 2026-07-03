'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase, Firm } from '@/lib/supabase'
import { ArrowLeft, Plus, Trash2 } from 'lucide-react'
import { ManageNav } from '@/components/ManageNav'

export default function ManageFirmsPage() {
  const [firms, setFirms] = useState<Firm[]>([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const { data } = await supabase.from('firms').select('*').order('display_order')
    setFirms(data || [])
    setLoading(false)
  }

  async function addFirm() {
    if (!newName.trim()) return
    await supabase.from('firms').insert({ name: newName.trim(), display_order: firms.length })
    setNewName('')
    load()
  }

  async function renameFirm(id: string, name: string) {
    setFirms(firms.map(f => (f.id === id ? { ...f, name } : f)))
  }

  async function saveFirmName(id: string, name: string) {
    await supabase.from('firms').update({ name }).eq('id', id)
  }

  async function moveFirm(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= firms.length) return
    const reordered = [...firms]
    ;[reordered[index], reordered[target]] = [reordered[target], reordered[index]]
    setFirms(reordered)
    await Promise.all(reordered.map((f, i) => supabase.from('firms').update({ display_order: i }).eq('id', f.id)))
  }

  async function deleteFirm(id: string) {
    if (!confirm('Delete this firm? This removes all its capability/product values too.')) return
    await supabase.from('firms').delete().eq('id', id)
    load()
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-slate-900">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-light text-slate-900 tracking-tight">Manage Firms</h1>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8">
        <ManageNav active="firms" />

        {loading ? (
          <div className="text-slate-400 text-sm">Loading...</div>
        ) : (
          <div className="space-y-2 mb-6">
            {firms.map((firm, i) => (
              <div key={firm.id} className="flex items-center gap-2 p-3 bg-white border border-slate-200 rounded-lg">
                <div className="flex flex-col text-slate-300">
                  <button onClick={() => moveFirm(i, -1)} className="hover:text-slate-600 text-xs leading-none">▲</button>
                  <button onClick={() => moveFirm(i, 1)} className="hover:text-slate-600 text-xs leading-none">▼</button>
                </div>
                <input
                  value={firm.name}
                  onChange={e => renameFirm(firm.id, e.target.value)}
                  onBlur={e => saveFirmName(firm.id, e.target.value)}
                  className="flex-1 border-0 focus:outline-none focus:bg-slate-50 rounded px-2 py-1 text-sm text-slate-900"
                />
                <button onClick={() => deleteFirm(firm.id)} className="text-slate-300 hover:text-red-500">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="New firm name..."
            value={newName}
            onChange={e => setNewName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addFirm()}
            className="flex-1 bg-white border border-slate-300 text-slate-900 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-slate-400"
          />
          <button
            onClick={addFirm}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
          >
            <Plus size={14} />
            Add Firm
          </button>
        </div>
      </div>
    </div>
  )
}
