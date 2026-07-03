'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase, CapabilityCategory, ProductCategory } from '@/lib/supabase'
import { QuarterPicker } from '@/components/QuarterPicker'
import { slugify } from '@/lib/slug'
import { Settings } from 'lucide-react'

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <HomePageContent />
    </Suspense>
  )
}

function HomePageContent() {
  const [capCategories, setCapCategories] = useState<CapabilityCategory[]>([])
  const [prodCategories, setProdCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(true)
  const searchParams = useSearchParams()
  const quarter = searchParams.get('quarter')
  const qs = quarter ? `?quarter=${quarter}` : ''

  useEffect(() => {
    Promise.all([
      supabase.from('capability_categories').select('*').order('display_order'),
      supabase.from('product_categories').select('*').order('display_order'),
    ]).then(([cap, prod]) => {
      setCapCategories(cap.data || [])
      setProdCategories(prod.data || [])
      setLoading(false)
    })
  }, [])

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-mono tracking-[0.25em] text-slate-400 uppercase">Corporate Insight</div>
            <h1 className="text-lg font-light text-slate-900 tracking-tight">Matrix Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <QuarterPicker quarterId={quarter} />
            <Link
              href="/manage/firms"
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-900 border border-slate-200 hover:border-slate-400 rounded-lg transition-colors"
            >
              <Settings size={14} />
              Manage
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-2 gap-8">
        <section>
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">Capabilities Matrix</h2>
          {loading ? (
            <div className="text-slate-400 text-sm">Loading...</div>
          ) : (
            <div className="space-y-2">
              {capCategories.map(cat => (
                <Link
                  key={cat.id}
                  href={`/capabilities/${slugify(cat.name)}${qs}`}
                  className="block p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-all"
                >
                  <div className="font-medium text-slate-900">{cat.name}</div>
                </Link>
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-3">Product Matrix</h2>
          {loading ? (
            <div className="text-slate-400 text-sm">Loading...</div>
          ) : (
            <div className="space-y-2">
              {prodCategories.map(cat => (
                <Link
                  key={cat.id}
                  href={`/products/${slugify(cat.name)}${qs}`}
                  className="block p-4 bg-white border border-slate-200 rounded-xl hover:border-slate-300 hover:bg-slate-50 transition-all"
                >
                  <div className="font-medium text-slate-900">{cat.name}</div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
