'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase, Quarter } from '@/lib/supabase'

export function useQuarters() {
  const [quarters, setQuarters] = useState<Quarter[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('quarters')
      .select('*')
      .order('year', { ascending: false })
      .order('quarter_number', { ascending: false })
      .then(({ data }) => {
        setQuarters(data || [])
        setLoading(false)
      })
  }, [])

  return { quarters, loading }
}

export function QuarterPicker({ quarterId }: { quarterId: string | null }) {
  const { quarters } = useQuarters()
  const router = useRouter()
  const searchParams = useSearchParams()

  function onChange(id: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('quarter', id)
    router.push(`?${params.toString()}`)
  }

  if (quarters.length === 0) return null

  const selected = quarterId || quarters.find(q => q.is_current)?.id || quarters[0].id

  return (
    <select
      value={selected}
      onChange={e => onChange(e.target.value)}
      className="bg-white border border-slate-300 text-slate-900 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-slate-400"
    >
      {quarters.map(q => (
        <option key={q.id} value={q.id}>
          {q.label}
          {q.is_current ? ' (current)' : ''}
        </option>
      ))}
    </select>
  )
}
