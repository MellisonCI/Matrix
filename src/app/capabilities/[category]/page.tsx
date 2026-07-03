'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import {
  supabase,
  CapabilityCategory,
  CapabilitySubcategory,
  CapabilityFeature,
  CapabilityValue,
  Firm,
} from '@/lib/supabase'
import { slugify } from '@/lib/slug'
import { buildFeatureTree, flattenTree } from '@/lib/matrix'
import { PivotTable, PivotSection } from '@/components/PivotTable'
import { QuarterPicker, useQuarters } from '@/components/QuarterPicker'
import { CategoryNav } from '@/components/CategoryNav'
import { downloadCsv } from '@/lib/csv'
import { ArrowLeft, Pencil, Download } from 'lucide-react'

export default function CapabilityCategoryPage() {
  const { category: categorySlug } = useParams() as { category: string }
  const searchParams = useSearchParams()
  const quarterParam = searchParams.get('quarter')
  const { quarters } = useQuarters()
  const quarterId = quarterParam || quarters.find(q => q.is_current)?.id || quarters[0]?.id

  const [allCategories, setAllCategories] = useState<CapabilityCategory[]>([])
  const [category, setCategory] = useState<CapabilityCategory | null>(null)
  const [subcategories, setSubcategories] = useState<CapabilitySubcategory[]>([])
  const [features, setFeatures] = useState<CapabilityFeature[]>([])
  const [firms, setFirms] = useState<Firm[]>([])
  const [values, setValues] = useState<CapabilityValue[]>([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('capability_categories').select('*').order('display_order').then(({ data }) => {
      setAllCategories(data || [])
    })
  }, [])

  useEffect(() => {
    if (allCategories.length === 0) return
    const cat = allCategories.find(c => slugify(c.name) === categorySlug)
    setCategory(cat || null)
  }, [allCategories, categorySlug])

  useEffect(() => {
    if (!category) return
    setLoading(true)
    async function load() {
      const [subRes, firmRes] = await Promise.all([
        supabase.from('capability_subcategories').select('*').eq('category_id', category!.id).order('display_order'),
        supabase.from('firms').select('*').order('display_order'),
      ])
      const subs = subRes.data || []
      setSubcategories(subs)
      setFirms(firmRes.data || [])

      if (subs.length > 0) {
        const { data: feats } = await supabase
          .from('capability_features')
          .select('*')
          .in('subcategory_id', subs.map(s => s.id))
          .order('display_order')
        setFeatures(feats || [])

        if (feats && feats.length > 0 && quarterId) {
          const { data: vals } = await supabase
            .from('capability_values')
            .select('*')
            .in('feature_id', feats.map(f => f.id))
            .eq('quarter_id', quarterId)
          setValues(vals || [])
        } else {
          setValues([])
        }
      }
      setLoading(false)
    }
    load()
  }, [category, quarterId])

  const sections: PivotSection[] = useMemo(() => {
    const valuesByFeature = new Map<string, CapabilityValue[]>()
    for (const v of values) {
      if (!valuesByFeature.has(v.feature_id)) valuesByFeature.set(v.feature_id, [])
      valuesByFeature.get(v.feature_id)!.push(v)
    }

    return subcategories.map(sub => {
      const tree = buildFeatureTree(features, sub.id)
      const flat = flattenTree(tree)
      const rows = flat
        .filter(({ feature }) => !filter || feature.name.toLowerCase().includes(filter.toLowerCase()))
        .map(({ feature, depth }) => {
          const featureValues = valuesByFeature.get(feature.id) || []
          const valueMap = new Map(featureValues.map(v => [v.firm_id, v]))
          return {
            featureId: feature.id,
            name: feature.name,
            depth,
            valueType: feature.value_type,
            unitLabel: feature.unit_label,
            values: valueMap,
          }
        })
      return { name: sub.name, rows }
    }).filter(s => s.rows.length > 0)
  }, [subcategories, features, values, filter])

  const columns = firms.map(f => ({ key: f.id, label: f.name }))

  function exportCsv() {
    const headers = ['Feature', 'Adoption', ...columns.map(c => c.label)]
    const rows: string[][] = []
    for (const section of sections) {
      rows.push([section.name, '', ...columns.map(() => '')])
      for (const row of section.rows) {
        rows.push([
          '  '.repeat(row.depth) + row.name,
          '',
          ...columns.map(col => {
            const v = row.values.get(col.key)
            if (!v) return ''
            if (v.is_not_applicable) return 'N/A'
            if (row.valueType === 'boolean') return v.is_present ? (v.detail ? `Yes (${v.detail})` : 'Yes') : ''
            if (row.valueType === 'numeric') return v.numeric_value?.toString() || ''
            return v.raw_text || ''
          }),
        ])
      }
    }
    downloadCsv(`${category?.name || 'capabilities'}.csv`, headers, rows)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-400 hover:text-slate-900">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="text-xs font-mono tracking-[0.25em] text-slate-400 uppercase">Capabilities Matrix</div>
              <h1 className="text-lg font-light text-slate-900 tracking-tight">{category?.name || '...'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <QuarterPicker quarterId={quarterId || null} />
            <Link
              href={`/capabilities/${categorySlug}/edit${quarterId ? `?quarter=${quarterId}` : ''}`}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
            >
              <Pencil size={14} />
              Edit
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-6 flex gap-6">
        <aside className="w-56 flex-shrink-0">
          <CategoryNav basePath="/capabilities" categories={allCategories} activeSlug={categorySlug} mode="view" />
        </aside>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3">
            <input
              type="text"
              placeholder="Filter features..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="bg-white border border-slate-300 text-slate-900 px-3 py-2 rounded-lg text-sm w-64 focus:outline-none focus:border-slate-400"
            />
            <button
              onClick={exportCsv}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-900 border border-slate-200 hover:border-slate-400 rounded-lg transition-colors"
            >
              <Download size={14} />
              Export CSV
            </button>
          </div>

          {loading ? (
            <div className="text-slate-400 text-sm">Loading...</div>
          ) : (
            <PivotTable sections={sections} columns={columns} />
          )}
        </div>
      </div>
    </div>
  )
}
