'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import {
  supabase,
  Firm,
  CapabilityCategory,
  CapabilitySubcategory,
  CapabilityFeature,
  CapabilityValue,
  Product,
  ProductCategory,
} from '@/lib/supabase'
import { QuarterPicker, useQuarters } from '@/components/QuarterPicker'
import { BarList } from '@/components/BarList'
import { StackedBarList } from '@/components/StackedBarList'
import { AskPanel } from '@/components/AskPanel'
import { TopNav } from '@/components/TopNav'
import { UpdatesThisQuarterPanel } from '@/components/UpdatesThisQuarterPanel'
import { fetchAllRows } from '@/lib/fetchAll'

const MIN_SAMPLE_SIZE = 5 // ignore features too few firms have data on -- avoids noisy 100%/0% from tiny samples

// Fixed palette by category position so colors stay stable even if a category is renamed,
// and cycles gracefully if more product categories are added later.
const CATEGORY_COLORS = ['#0f172a', '#0ea5e9', '#f59e0b', '#10b981', '#ec4899', '#8b5cf6']

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <HomePageContent />
    </Suspense>
  )
}

function HomePageContent() {
  const searchParams = useSearchParams()
  const quarterParam = searchParams.get('quarter')
  const { quarters } = useQuarters()
  const quarterId = quarterParam || quarters.find(q => q.is_current)?.id || quarters[0]?.id

  const [firms, setFirms] = useState<Firm[]>([])
  const [categories, setCategories] = useState<CapabilityCategory[]>([])
  const [subcategories, setSubcategories] = useState<CapabilitySubcategory[]>([])
  const [features, setFeatures] = useState<CapabilityFeature[]>([])
  const [values, setValues] = useState<CapabilityValue[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [productCategories, setProductCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!quarterId) return
    setLoading(true)
    async function load() {
      const [firmsRes, catRes, subcatRes, featRes, prodRes, prodCatRes] = await Promise.all([
        supabase.from('firms').select('*').order('display_order'),
        supabase.from('capability_categories').select('*').order('display_order'),
        supabase.from('capability_subcategories').select('*'),
        supabase.from('capability_features').select('*'),
        supabase.from('products').select('*'),
        supabase.from('product_categories').select('*').order('display_order'),
      ])
      setFirms(firmsRes.data || [])
      setCategories(catRes.data || [])
      setSubcategories(subcatRes.data || [])
      setFeatures(featRes.data || [])
      setProducts(prodRes.data || [])
      setProductCategories(prodCatRes.data || [])

      const featureIds = (featRes.data || []).map(f => f.id)
      if (featureIds.length > 0) {
        const vals = await fetchAllRows<CapabilityValue>((from, to) =>
          supabase
            .from('capability_values')
            .select('*')
            .in('feature_id', featureIds)
            .eq('quarter_id', quarterId)
            .range(from, to)
        )
        setValues(vals)
      } else {
        setValues([])
      }
      setLoading(false)
    }
    load()
  }, [quarterId])

  const booleanFeatures = useMemo(() => features.filter(f => f.value_type === 'boolean'), [features])

  const valuesByFeature = useMemo(() => {
    const m = new Map<string, CapabilityValue[]>()
    for (const v of values) {
      if (!m.has(v.feature_id)) m.set(v.feature_id, [])
      m.get(v.feature_id)!.push(v)
    }
    return m
  }, [values])

  const categoryNameBySubcategory = useMemo(() => {
    const m = new Map<string, string>()
    for (const sub of subcategories) {
      const cat = categories.find(c => c.id === sub.category_id)
      if (cat) m.set(sub.id, cat.name)
    }
    return m
  }, [subcategories, categories])

  // % of applicable boolean capabilities each firm has present, across every category combined.
  const firmCoverage = useMemo(() => {
    return firms
      .map(firm => {
        let present = 0
        let total = 0
        for (const f of booleanFeatures) {
          const v = (valuesByFeature.get(f.id) || []).find(v => v.firm_id === firm.id)
          if (v?.is_not_applicable) continue
          total++
          if (v?.is_present) present++
        }
        return { label: firm.name, value: total > 0 ? Math.round((present / total) * 100) : 0 }
      })
      .sort((a, b) => b.value - a.value)
  }, [firms, booleanFeatures, valuesByFeature])

  // Per-feature adoption % -- basis for both the universal/differentiating lists and category rollup.
  const featureAdoption = useMemo(() => {
    return booleanFeatures
      .map(f => {
        const vals = valuesByFeature.get(f.id) || []
        const applicableFirms = firms.filter(firm => !vals.find(v => v.firm_id === firm.id)?.is_not_applicable)
        const present = vals.filter(v => v.is_present).length
        return {
          name: f.name,
          category: categoryNameBySubcategory.get(f.subcategory_id),
          pct: applicableFirms.length > 0 ? Math.round((present / applicableFirms.length) * 100) : 0,
          sampleSize: applicableFirms.length,
        }
      })
      .filter(f => f.sampleSize >= MIN_SAMPLE_SIZE)
  }, [booleanFeatures, valuesByFeature, firms, categoryNameBySubcategory])

  const mostUniversal = useMemo(
    () =>
      [...featureAdoption]
        .sort((a, b) => b.pct - a.pct)
        .slice(0, 10)
        .map(f => ({ label: f.name, sublabel: f.category, value: f.pct })),
    [featureAdoption]
  )

  const mostDifferentiating = useMemo(
    () =>
      [...featureAdoption]
        .sort((a, b) => a.pct - b.pct)
        .slice(0, 10)
        .map(f => ({ label: f.name, sublabel: f.category, value: f.pct })),
    [featureAdoption]
  )

  const categoryAdoption = useMemo(() => {
    const byCategory = new Map<string, number[]>()
    for (const f of featureAdoption) {
      if (!f.category) continue
      if (!byCategory.has(f.category)) byCategory.set(f.category, [])
      byCategory.get(f.category)!.push(f.pct)
    }
    return categories
      .map(c => {
        const pcts = byCategory.get(c.name) || []
        const avg = pcts.length > 0 ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0
        return { label: c.name, value: avg }
      })
      .sort((a, b) => b.value - a.value)
  }, [categories, featureAdoption])

  const productCategoryColors = useMemo(() => {
    const m = new Map<string, string>()
    productCategories.forEach((c, i) => m.set(c.id, CATEGORY_COLORS[i % CATEGORY_COLORS.length]))
    return m
  }, [productCategories])

  const productCountsByCategory = useMemo(
    () =>
      firms
        .map(firm => {
          const firmProducts = products.filter(p => p.firm_id === firm.id)
          const segments = productCategories.map(cat => ({
            key: cat.id,
            label: cat.name,
            value: firmProducts.filter(p => p.category_id === cat.id).length,
            color: productCategoryColors.get(cat.id) || '#94a3b8',
          }))
          return { label: firm.name, segments }
        })
        .sort(
          (a, b) =>
            b.segments.reduce((s, seg) => s + seg.value, 0) - a.segments.reduce((s, seg) => s + seg.value, 0)
        ),
    [firms, products, productCategories, productCategoryColors]
  )

  const productLegend = productCategories.map(c => ({ label: c.name, color: productCategoryColors.get(c.id) || '#94a3b8' }))

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-xs font-mono tracking-[0.25em] text-slate-400 uppercase">Corporate Insight</div>
            <h1 className="text-lg font-light text-slate-900 tracking-tight">Matrix Dashboard</h1>
          </div>
          <div className="flex items-center gap-3">
            <QuarterPicker quarterId={quarterId || null} />
            <TopNav active="dashboard" quarterId={quarterId} />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-slate-400 text-sm">Loading...</div>
        ) : (
          <>
            <AskPanel />

            <div className="grid grid-cols-4 gap-3 mb-8">
              <StatCard label="Firms" value={firms.length} />
              <StatCard label="Capability Features" value={booleanFeatures.length} />
              <StatCard label="Products Tracked" value={products.length} />
              <StatCard label="Quarter" value={quarters.find(q => q.id === quarterId)?.label || '—'} />
            </div>

            <UpdatesThisQuarterPanel quarterId={quarterId} quarters={quarters} />

            <div className="grid grid-cols-2 gap-6 mb-6">
              <Panel title="Firm Capability Coverage" subtitle="% of applicable capabilities present, all categories combined">
                <BarList items={firmCoverage} formatValue={v => `${v}%`} maxValue={100} />
              </Panel>
              <Panel title="Adoption by Category" subtitle="Average feature adoption % within each capability category">
                <BarList items={categoryAdoption} formatValue={v => `${v}%`} maxValue={100} />
              </Panel>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              <Panel title="Most Universal Features" subtitle="Nearly every firm has these -- table stakes, not differentiators">
                <BarList items={mostUniversal} formatValue={v => `${v}%`} maxValue={100} />
              </Panel>
              <Panel title="Most Differentiating Features" subtitle="Few firms have these -- where firms actually stand apart">
                <BarList items={mostDifferentiating} formatValue={v => `${v}%`} maxValue={100} />
              </Panel>
            </div>

            <Panel title="Products by Firm" subtitle="Total tracked products per firm, colored by product category">
              <StackedBarList items={productCountsByCategory} legend={productLegend} />
            </Panel>
          </>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-4 bg-white border border-slate-200 rounded-xl">
      <div className="text-2xl font-light text-slate-900 mb-1">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}

function Panel({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="p-5 bg-white border border-slate-200 rounded-xl">
      <h2 className="text-sm font-medium text-slate-800 mb-0.5">{title}</h2>
      <p className="text-xs text-slate-400 mb-4">{subtitle}</p>
      {children}
    </div>
  )
}
