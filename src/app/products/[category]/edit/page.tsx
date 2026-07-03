'use client'

import { useEffect, useMemo, useState } from 'react'
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
import { buildFeatureTree, flattenTree, ValueLike } from '@/lib/matrix'
import { EditableGrid, EditableSection } from '@/components/EditableGrid'
import { QuarterPicker, useQuarters } from '@/components/QuarterPicker'
import { CategoryNav } from '@/components/CategoryNav'
import { ArrowLeft, Eye } from 'lucide-react'

export default function ProductCategoryEditPage() {
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
  const [loading, setLoading] = useState(true)

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
    setCategory(allCategories.find(c => slugify(c.name) === categorySlug) || null)
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
          const { data: vals } = await supabase
            .from('product_values')
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

  const sections: EditableSection[] = useMemo(() => {
    const valuesByFeature = new Map<string, ProductValue[]>()
    for (const v of values) {
      if (!valuesByFeature.has(v.feature_id)) valuesByFeature.set(v.feature_id, [])
      valuesByFeature.get(v.feature_id)!.push(v)
    }
    return subcategories.map(sub => {
      const tree = buildFeatureTree(features, sub.id)
      const flat = flattenTree(tree)
      const rows = flat.map(({ feature, depth }) => {
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
  }, [subcategories, features, values])

  const columns = products.map(p => ({
    key: p.id,
    label: p.name,
    sublabel: firmsById.get(p.firm_id)?.name,
  }))

  async function handleCommit(featureId: string, productId: string, next: Partial<ValueLike>) {
    if (!quarterId) return
    const { error } = await supabase.from('product_values').upsert(
      {
        feature_id: featureId,
        product_id: productId,
        quarter_id: quarterId,
        raw_text: next.raw_text ?? null,
        is_present: next.is_present ?? null,
        is_not_applicable: next.is_not_applicable ?? false,
        numeric_value: next.numeric_value ?? null,
        detail: next.detail ?? null,
      },
      { onConflict: 'feature_id,product_id,quarter_id' }
    )
    if (error) throw error
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-[1400px] mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/products/${categorySlug}${quarterId ? `?quarter=${quarterId}` : ''}`} className="text-slate-400 hover:text-slate-900">
              <ArrowLeft size={18} />
            </Link>
            <div>
              <div className="text-xs font-mono tracking-[0.25em] text-slate-400 uppercase">Editing Products</div>
              <h1 className="text-lg font-light text-slate-900 tracking-tight">{category?.name || '...'}</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <QuarterPicker quarterId={quarterId || null} />
            <Link
              href={`/products/${categorySlug}${quarterId ? `?quarter=${quarterId}` : ''}`}
              className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 hover:text-slate-900 border border-slate-200 hover:border-slate-400 rounded-lg transition-colors"
            >
              <Eye size={14} />
              View
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto px-6 py-6 flex gap-6">
        <aside className="w-56 flex-shrink-0">
          <CategoryNav basePath="/products" categories={allCategories} activeSlug={categorySlug} mode="edit" />
        </aside>

        <div className="flex-1 min-w-0">
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
