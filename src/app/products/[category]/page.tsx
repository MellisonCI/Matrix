'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import {
  supabase,
  ProductCategory,
  ProductSubcategory,
  ProductFeature,
  ProductValue,
  Product,
  Firm,
} from '@/lib/supabase'
import { slugify } from '@/lib/slug'
import { buildFeatureTree, flattenTree } from '@/lib/matrix'
import { PivotTable, PivotSection } from '@/components/PivotTable'
import { QuarterPicker, useQuarters } from '@/components/QuarterPicker'
import { CategoryNav } from '@/components/CategoryNav'
import { MultiSelectFilter, makeSetToggler } from '@/components/MultiSelectFilter'
import { TopNav } from '@/components/TopNav'
import { downloadCsv } from '@/lib/csv'
import { fetchAllRows } from '@/lib/fetchAll'
import { ArrowLeft, Pencil, Download } from 'lucide-react'

export default function ProductCategoryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <ProductCategoryPageContent />
    </Suspense>
  )
}

function ProductCategoryPageContent() {
  const { category: categorySlug } = useParams() as { category: string }
  const searchParams = useSearchParams()
  const quarterParam = searchParams.get('quarter')
  const { quarters } = useQuarters()
  const quarterId = quarterParam || quarters.find(q => q.is_current)?.id || quarters[0]?.id

  const [allCategories, setAllCategories] = useState<ProductCategory[]>([])
  const [category, setCategory] = useState<ProductCategory | null>(null)
  const [subcategories, setSubcategories] = useState<ProductSubcategory[]>([])
  const [features, setFeatures] = useState<ProductFeature[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [firmsById, setFirmsById] = useState<Map<string, Firm>>(new Map())
  const [values, setValues] = useState<ProductValue[]>([])
  const [filter, setFilter] = useState('')
  const [selectedFirmIds, setSelectedFirmIds] = useState<Set<string>>(new Set())
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const firmToggler = makeSetToggler(selectedFirmIds, setSelectedFirmIds)
  const productToggler = makeSetToggler(selectedProductIds, setSelectedProductIds)

  // Narrowing the firm filter can hide a product that was individually selected --
  // drop it so the product filter never holds an invisible, stale selection.
  useEffect(() => {
    if (selectedFirmIds.size === 0 || selectedProductIds.size === 0) return
    const stillValid = products.filter(p => selectedFirmIds.has(p.firm_id) && selectedProductIds.has(p.id)).map(p => p.id)
    if (stillValid.length !== selectedProductIds.size) setSelectedProductIds(new Set(stillValid))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [[...selectedFirmIds].sort().join(',')])

  useEffect(() => {
    supabase.from('product_categories').select('*').order('display_order').then(({ data }) => {
      setAllCategories(data || [])
    })
    supabase.from('firms').select('*').then(({ data }) => {
      setFirmsById(new Map((data || []).map(f => [f.id, f])))
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
      const [subRes, prodRes] = await Promise.all([
        supabase.from('product_subcategories').select('*').eq('category_id', category!.id).order('display_order'),
        supabase.from('products').select('*').eq('category_id', category!.id).order('display_order'),
      ])
      const subs = subRes.data || []
      setSubcategories(subs)
      setProducts(prodRes.data || [])

      if (subs.length > 0) {
        const { data: feats } = await supabase
          .from('product_features')
          .select('*')
          .in('subcategory_id', subs.map(s => s.id))
          .order('display_order')
        setFeatures(feats || [])

        if (feats && feats.length > 0 && quarterId) {
          const vals = await fetchAllRows<ProductValue>((from, to) =>
            supabase
              .from('product_values')
              .select('*')
              .in('feature_id', feats.map(f => f.id))
              .eq('quarter_id', quarterId)
              .range(from, to)
          )
          setValues(vals)
        } else {
          setValues([])
        }
      }
      setLoading(false)
    }
    load()
  }, [category, quarterId])

  const sections: PivotSection[] = useMemo(() => {
    const valuesByFeature = new Map<string, ProductValue[]>()
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
          const valueMap = new Map(featureValues.map(v => [v.product_id, v]))
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

  const visibleProducts = products.filter(
    p =>
      (selectedFirmIds.size === 0 || selectedFirmIds.has(p.firm_id)) &&
      (selectedProductIds.size === 0 || selectedProductIds.has(p.id))
  )
  const columns = visibleProducts.map(p => ({
    key: p.id,
    label: p.name,
    sublabel: firmsById.get(p.firm_id)?.name,
  }))
  const firmOptionsInCategory = [...new Map(products.map(p => [p.firm_id, firmsById.get(p.firm_id)])).values()]
    .filter((f): f is Firm => !!f)
    .sort((a, b) => a.display_order - b.display_order)
    .map(f => ({ key: f.id, label: f.name }))
  const productOptions = products
    .filter(p => selectedFirmIds.size === 0 || selectedFirmIds.has(p.firm_id))
    .map(p => ({ key: p.id, label: p.name, sublabel: firmsById.get(p.firm_id)?.name }))

  function exportCsv() {
    const headers = ['Feature', 'Adoption', ...columns.map(c => `${c.sublabel ? c.sublabel + ' ' : ''}${c.label}`)]
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
    downloadCsv(`${category?.name || 'products'}.csv`, headers, rows)
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
              <div className="text-xs font-mono tracking-[0.25em] text-slate-400 uppercase">Product Matrix</div>
              <h1 className="text-lg font-light text-slate-900 tracking-tight">{category?.name || '...'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <QuarterPicker quarterId={quarterId || null} />
            <TopNav active="products" quarterId={quarterId} />
            <Link
              href={`/products/${categorySlug}/edit${quarterId ? `?quarter=${quarterId}` : ''}`}
              className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
            >
              <Pencil size={14} />
              Edit
            </Link>
          </div>
        </div>
      </div>

      <div className="w-full px-6 py-6 flex gap-6">
        <aside className="w-56 flex-shrink-0">
          <CategoryNav basePath="/products" categories={allCategories} activeSlug={categorySlug} mode="view" />
        </aside>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-3 gap-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Filter features..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="bg-white border border-slate-300 text-slate-900 px-3 py-2 rounded-lg text-sm w-64 focus:outline-none focus:border-slate-400"
              />
              <MultiSelectFilter
                label="Firms"
                options={firmOptionsInCategory}
                selected={selectedFirmIds}
                onToggle={firmToggler.toggle}
                onClear={firmToggler.clear}
              />
              <MultiSelectFilter
                label="Products"
                options={productOptions}
                selected={selectedProductIds}
                onToggle={productToggler.toggle}
                onClear={productToggler.clear}
              />
            </div>
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
