'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
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
import { buildFeatureTree, flattenTree, ValueLike } from '@/lib/matrix'
import { EditableGrid, EditableSection } from '@/components/EditableGrid'
import { QuarterPicker, useQuarters } from '@/components/QuarterPicker'
import { CategoryNav } from '@/components/CategoryNav'
import { MultiSelectFilter, makeSetToggler } from '@/components/MultiSelectFilter'
import { TopNav } from '@/components/TopNav'
import { fetchAllRows } from '@/lib/fetchAll'
import { ArrowLeft, Eye } from 'lucide-react'

export default function CapabilityCategoryEditPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <CapabilityCategoryEditPageContent />
    </Suspense>
  )
}

function CapabilityCategoryEditPageContent() {
  const { category: categorySlug } = useParams() as { category: string }
  const searchParams = useSearchParams()
  const quarterParam = searchParams.get('quarter')
  const { quarters } = useQuarters()
  const quarterId = quarterParam || quarters.find(q => q.is_current)?.id || quarters[0]?.id

  const [allCategories, setAllCategories] = useState<CapabilityCategory[]>([])
  const [category, setCategory] = useState<CapabilityCategory | null>(null)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<string>>(new Set())
  const [subcategories, setSubcategories] = useState<CapabilitySubcategory[]>([])
  const [features, setFeatures] = useState<CapabilityFeature[]>([])
  const [firms, setFirms] = useState<Firm[]>([])
  const [values, setValues] = useState<CapabilityValue[]>([])
  const [filter, setFilter] = useState('')
  const [selectedFirmIds, setSelectedFirmIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const firmToggler = makeSetToggler(selectedFirmIds, setSelectedFirmIds)
  const categoryToggler = makeSetToggler(selectedCategoryIds, setSelectedCategoryIds)

  useEffect(() => {
    supabase.from('capability_categories').select('*').order('display_order').then(({ data }) => {
      setAllCategories(data || [])
    })
  }, [])

  useEffect(() => {
    if (allCategories.length === 0) return
    const cat = allCategories.find(c => slugify(c.name) === categorySlug)
    setCategory(cat || null)
    if (cat) setSelectedCategoryIds(new Set([cat.id]))
  }, [allCategories, categorySlug])

  useEffect(() => {
    if (selectedCategoryIds.size === 0) return
    setLoading(true)
    async function load() {
      const categoryIds = [...selectedCategoryIds]
      const [subRes, firmRes] = await Promise.all([
        supabase.from('capability_subcategories').select('*').in('category_id', categoryIds).order('display_order'),
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
          const vals = await fetchAllRows<CapabilityValue>((from, to) =>
            supabase
              .from('capability_values')
              .select('*')
              .in('feature_id', feats.map(f => f.id))
              .eq('quarter_id', quarterId)
              .range(from, to)
          )
          setValues(vals)
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

  const showCategoryPrefix = selectedCategoryIds.size > 1

  const sections: EditableSection[] = useMemo(() => {
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
      const categoryName = categoryNameBySubcategory.get(sub.id)
      const name = showCategoryPrefix && categoryName ? `${categoryName} · ${sub.name}` : sub.name
      return { name, rows }
    }).filter(s => s.rows.length > 0)
  }, [subcategories, features, values, filter, categoryNameBySubcategory, showCategoryPrefix])

  const visibleFirms = selectedFirmIds.size > 0 ? firms.filter(f => selectedFirmIds.has(f.id)) : firms
  const columns = visibleFirms.map(f => ({ key: f.id, label: f.name }))

  const selectedCategoryNames = allCategories.filter(c => selectedCategoryIds.has(c.id)).map(c => c.name)
  const headerTitle =
    selectedCategoryNames.length <= 1 ? category?.name || '...' : `${selectedCategoryNames.length} categories`

  async function handleCommit(featureId: string, firmId: string, next: Partial<ValueLike>) {
    if (!quarterId) return
    const { error } = await supabase.from('capability_values').upsert(
      {
        feature_id: featureId,
        firm_id: firmId,
        quarter_id: quarterId,
        raw_text: next.raw_text ?? null,
        is_present: next.is_present ?? null,
        is_not_applicable: next.is_not_applicable ?? false,
        numeric_value: next.numeric_value ?? null,
        detail: next.detail ?? null,
      },
      { onConflict: 'feature_id,firm_id,quarter_id' }
    )
    if (error) throw error
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-30">
        <div className="w-full px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/capabilities/${categorySlug}${quarterId ? `?quarter=${quarterId}` : ''}`} className="text-slate-400 hover:text-slate-900">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="text-xs font-mono tracking-[0.25em] text-slate-400 uppercase">Editing Capabilities</div>
              <h1 className="text-lg font-light text-slate-900 tracking-tight" title={selectedCategoryNames.join(', ')}>
                {headerTitle}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <QuarterPicker quarterId={quarterId || null} />
            <TopNav active="capabilities" quarterId={quarterId} />
            <Link
              href={`/capabilities/${categorySlug}${quarterId ? `?quarter=${quarterId}` : ''}`}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-900 border border-slate-200 hover:border-slate-400 rounded-lg transition-colors"
            >
              <Eye size={14} />
              View
            </Link>
          </div>
        </div>
      </div>

      <div className="w-full px-6 py-6 flex gap-6">
        <aside className="w-56 flex-shrink-0">
          <CategoryNav
            basePath="/capabilities"
            categories={allCategories}
            activeSlug={categorySlug}
            mode="edit"
            selectedIds={selectedCategoryIds}
            onToggleSelect={categoryToggler.toggle}
          />
          <p className="text-[11px] text-slate-400 mt-2 px-1">Check a category to add it to the view below.</p>
        </aside>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              placeholder="Filter features..."
              value={filter}
              onChange={e => setFilter(e.target.value)}
              className="bg-white border border-slate-300 text-slate-900 px-3 py-2 rounded-lg text-sm w-64 focus:outline-none focus:border-slate-400"
            />
            <MultiSelectFilter
              label="Firms"
              options={firms.map(f => ({ key: f.id, label: f.name }))}
              selected={selectedFirmIds}
              onToggle={firmToggler.toggle}
              onClear={firmToggler.clear}
            />
          </div>

          {loading ? (
            <div className="text-slate-400 text-sm">Loading...</div>
          ) : (
            <EditableGrid sections={sections} columns={columns} onCellCommit={handleCommit} />
          )}
        </div>
      </div>
    </div>
  )
}
