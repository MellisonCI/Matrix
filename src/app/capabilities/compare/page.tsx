'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { supabase, CapabilityCategory, CapabilitySubcategory, CapabilityFeature, CapabilityValue, Firm } from '@/lib/supabase'
import { buildFeatureTree, flattenTree } from '@/lib/matrix'
import { PivotTable, PivotSection } from '@/components/PivotTable'
import { QuarterPicker, useQuarters } from '@/components/QuarterPicker'
import { MultiSelectFilter, makeSetToggler } from '@/components/MultiSelectFilter'
import { downloadCsv } from '@/lib/csv'
import { ArrowLeft, Download, Layers } from 'lucide-react'

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <ComparePageContent />
    </Suspense>
  )
}

function ComparePageContent() {
  const searchParams = useSearchParams()
  const quarterParam = searchParams.get('quarter')
  const { quarters } = useQuarters()
  const quarterId = quarterParam || quarters.find(q => q.is_current)?.id || quarters[0]?.id

  const [allCategories, setAllCategories] = useState<CapabilityCategory[]>([])
  const [firms, setFirms] = useState<Firm[]>([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set())
  const [selectedFirmIds, setSelectedFirmIds] = useState<Set<string>>(new Set())
  const [filter, setFilter] = useState('')

  const [subcategories, setSubcategories] = useState<CapabilitySubcategory[]>([])
  const [features, setFeatures] = useState<CapabilityFeature[]>([])
  const [values, setValues] = useState<CapabilityValue[]>([])
  const [loading, setLoading] = useState(false)

  const categoryToggler = makeSetToggler(selectedCategoryIds, setSelectedCategoryIds)
  const firmToggler = makeSetToggler(selectedFirmIds, setSelectedFirmIds)

  useEffect(() => {
    supabase.from('capability_categories').select('*').order('display_order').then(({ data }) => setAllCategories(data || []))
    supabase.from('firms').select('*').order('display_order').then(({ data }) => setFirms(data || []))
  }, [])

  useEffect(() => {
    if (selectedCategoryIds.size === 0 || !quarterId) {
      setSubcategories([])
      setFeatures([])
      setValues([])
      return
    }
    setLoading(true)
    async function load() {
      const categoryIds = [...selectedCategoryIds]
      const { data: subs } = await supabase
        .from('capability_subcategories')
        .select('*')
        .in('category_id', categoryIds)
        .order('display_order')
      setSubcategories(subs || [])

      if (subs && subs.length > 0) {
        const { data: feats } = await supabase
          .from('capability_features')
          .select('*')
          .in('subcategory_id', subs.map(s => s.id))
          .order('display_order')
        setFeatures(feats || [])

        if (feats && feats.length > 0) {
          const { data: vals } = await supabase
            .from('capability_values')
            .select('*')
            .in('feature_id', feats.map(f => f.id))
            .eq('quarter_id', quarterId)
          setValues(vals || [])
        } else {
          setValues([])
        }
      } else {
        setFeatures([])
        setValues([])
      }
      setLoading(false)
    }
    load()
    // Stringify the set so this effect only re-runs when the actual selection changes, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [[...selectedCategoryIds].sort().join(','), quarterId])

  const categoryNameBySubcategory = useMemo(() => {
    const m = new Map<string, string>()
    for (const sub of subcategories) {
      const cat = allCategories.find(c => c.id === sub.category_id)
      if (cat) m.set(sub.id, cat.name)
    }
    return m
  }, [subcategories, allCategories])

  const sections: PivotSection[] = useMemo(() => {
    const valuesByFeature = new Map<string, CapabilityValue[]>()
    for (const v of values) {
      if (!valuesByFeature.has(v.feature_id)) valuesByFeature.set(v.feature_id, [])
      valuesByFeature.get(v.feature_id)!.push(v)
    }

    return subcategories
      .map(sub => {
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
        const categoryName = categoryNameBySubcategory.get(sub.id)
        return { name: categoryName ? `${categoryName} · ${sub.name}` : sub.name, rows }
      })
      .filter(s => s.rows.length > 0)
  }, [subcategories, features, values, filter, categoryNameBySubcategory])

  const visibleFirms = selectedFirmIds.size > 0 ? firms.filter(f => selectedFirmIds.has(f.id)) : firms
  const columns = visibleFirms.map(f => ({ key: f.id, label: f.name }))

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
    downloadCsv('capabilities-compare.csv', headers, rows)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-30">
        <div className="w-full px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-400 hover:text-slate-900">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="text-xs font-mono tracking-[0.25em] text-slate-400 uppercase">Capabilities Matrix</div>
              <h1 className="text-lg font-light text-slate-900 tracking-tight flex items-center gap-2">
                <Layers size={16} className="text-slate-400" />
                Compare Across Categories
              </h1>
            </div>
          </div>
          <QuarterPicker quarterId={quarterId || null} />
        </div>
      </div>

      <div className="w-full px-6 py-6">
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <MultiSelectFilter
              label="Categories"
              options={allCategories.map(c => ({ key: c.id, label: c.name }))}
              selected={selectedCategoryIds}
              onToggle={categoryToggler.toggle}
              onClear={categoryToggler.clear}
            />
            <MultiSelectFilter
              label="Firms"
              options={firms.map(f => ({ key: f.id, label: f.name }))}
              selected={selectedFirmIds}
              onToggle={firmToggler.toggle}
              onClear={firmToggler.clear}
            />
            <input
              type="text"
              placeholder="Filter features..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="bg-white border border-slate-300 text-slate-900 px-3 py-2 rounded-lg text-sm w-64 focus:outline-none focus:border-slate-400"
            />
          </div>
          {sections.length > 0 && (
            <button
              onClick={exportCsv}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-900 border border-slate-200 hover:border-slate-400 rounded-lg transition-colors"
            >
              <Download size={14} />
              Export CSV
            </button>
          )}
        </div>

        {selectedCategoryIds.size === 0 ? (
          <div className="text-center py-20">
            <Layers size={32} className="mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-400">Pick one or more categories above to build a combined view.</p>
          </div>
        ) : loading ? (
          <div className="text-slate-400 text-sm">Loading...</div>
        ) : (
          <PivotTable sections={sections} columns={columns} />
        )}
      </div>
    </div>
  )
}
