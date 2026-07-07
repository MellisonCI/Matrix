'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase, Firm, Product, CapabilityValue, ProductValue, Quarter, ValueType } from '@/lib/supabase'
import { fetchAllRows } from '@/lib/fetchAll'

interface ChangeRow {
  subjectName: string
  featureName: string
  before: string
  after: string
}

interface ValueBase {
  feature_id: string
  raw_text: string | null
  is_present: boolean | null
  is_not_applicable: boolean
  numeric_value: number | null
  detail: string | null
}

function formatCellValue(v: ValueBase | undefined, valueType: ValueType): string {
  if (!v) return '—'
  if (v.is_not_applicable) return 'N/A'
  if (valueType === 'boolean') return v.is_present ? (v.detail ? `Yes (${v.detail})` : 'Yes') : 'No'
  if (valueType === 'numeric') return v.numeric_value != null ? String(v.numeric_value) : '—'
  return v.raw_text || '—'
}

function diffValues<V extends ValueBase>(
  current: V[],
  previous: V[],
  getSubjectId: (v: V) => string,
  featuresById: Map<string, { name: string; value_type: ValueType }>,
  subjectsById: Map<string, { name: string }>
): ChangeRow[] {
  const key = (v: V) => `${v.feature_id}::${getSubjectId(v)}`
  const curByKey = new Map(current.map(v => [key(v), v]))
  const prevByKey = new Map(previous.map(v => [key(v), v]))
  const allKeys = new Set([...curByKey.keys(), ...prevByKey.keys()])

  const changes: ChangeRow[] = []
  for (const k of allKeys) {
    const cur = curByKey.get(k)
    const prev = prevByKey.get(k)
    const sample = cur ?? prev!
    const feature = featuresById.get(sample.feature_id)
    if (!feature) continue
    const before = formatCellValue(prev, feature.value_type)
    const after = formatCellValue(cur, feature.value_type)
    if (before === after) continue
    const subject = subjectsById.get(getSubjectId(sample))
    if (!subject) continue
    changes.push({ subjectName: subject.name, featureName: feature.name, before, after })
  }
  return changes
}

export function UpdatesThisQuarterPanel({ quarterId, quarters }: { quarterId: string | undefined; quarters: Quarter[] }) {
  const [loading, setLoading] = useState(true)
  const [previousQuarter, setPreviousQuarter] = useState<Quarter | null>(null)
  const [capChanges, setCapChanges] = useState<ChangeRow[]>([])
  const [prodChanges, setProdChanges] = useState<ChangeRow[]>([])

  useEffect(() => {
    if (!quarterId || quarters.length === 0) return

    // quarters come back most-recent-first, so the previous quarter is the next entry
    const idx = quarters.findIndex(q => q.id === quarterId)
    const prev = idx >= 0 && idx + 1 < quarters.length ? quarters[idx + 1] : null
    setPreviousQuarter(prev)

    if (!prev) {
      setCapChanges([])
      setProdChanges([])
      setLoading(false)
      return
    }

    setLoading(true)
    async function load() {
      const [firmsRes, productsRes, capFeatRes, prodFeatRes] = await Promise.all([
        supabase.from('firms').select('*'),
        supabase.from('products').select('*'),
        supabase.from('capability_features').select('*'),
        supabase.from('product_features').select('*'),
      ])
      const firmsById = new Map((firmsRes.data || []).map((f: Firm) => [f.id, f]))
      const productsById = new Map((productsRes.data || []).map((p: Product) => [p.id, p]))
      const capFeatById = new Map((capFeatRes.data || []).map(f => [f.id, f]))
      const prodFeatById = new Map((prodFeatRes.data || []).map(f => [f.id, f]))

      const [curCapVals, prevCapVals, curProdVals, prevProdVals] = await Promise.all([
        fetchAllRows<CapabilityValue>((from, to) =>
          supabase.from('capability_values').select('*').eq('quarter_id', quarterId).range(from, to)
        ),
        fetchAllRows<CapabilityValue>((from, to) =>
          supabase.from('capability_values').select('*').eq('quarter_id', prev!.id).range(from, to)
        ),
        fetchAllRows<ProductValue>((from, to) =>
          supabase.from('product_values').select('*').eq('quarter_id', quarterId).range(from, to)
        ),
        fetchAllRows<ProductValue>((from, to) =>
          supabase.from('product_values').select('*').eq('quarter_id', prev!.id).range(from, to)
        ),
      ])

      setCapChanges(diffValues(curCapVals, prevCapVals, v => v.firm_id, capFeatById, firmsById))
      setProdChanges(diffValues(curProdVals, prevProdVals, v => v.product_id, prodFeatById, productsById))
      setLoading(false)
    }
    load()
  }, [quarterId, quarters])

  const totalChanges = capChanges.length + prodChanges.length
  const firmsTouched = useMemo(() => new Set(capChanges.map(c => c.subjectName)).size, [capChanges])
  const productsTouched = useMemo(() => new Set(prodChanges.map(c => c.subjectName)).size, [prodChanges])
  const examples = useMemo(() => [...capChanges, ...prodChanges].slice(0, 6), [capChanges, prodChanges])

  return (
    <div className="p-5 bg-white border border-slate-200 rounded-xl mb-6">
      <h2 className="text-sm font-medium text-slate-800 mb-0.5">Updates This Quarter</h2>
      <p className="text-xs text-slate-400 mb-4">
        {previousQuarter ? `Changes vs ${previousQuarter.label}` : 'No prior quarter to compare against yet'}
      </p>

      {!previousQuarter ? (
        <p className="text-sm text-slate-400">Add another quarter of data to start seeing what changed.</p>
      ) : loading ? (
        <div className="text-slate-400 text-sm">Loading...</div>
      ) : totalChanges === 0 ? (
        <p className="text-sm text-slate-400">No changes detected since {previousQuarter.label}.</p>
      ) : (
        <>
          <div className="flex gap-8 mb-4">
            <div>
              <div className="text-2xl font-light text-slate-900">{capChanges.length}</div>
              <div className="text-xs text-slate-500">
                Capability change{capChanges.length === 1 ? '' : 's'} across {firmsTouched} firm{firmsTouched === 1 ? '' : 's'}
              </div>
            </div>
            <div>
              <div className="text-2xl font-light text-slate-900">{prodChanges.length}</div>
              <div className="text-xs text-slate-500">
                Product change{prodChanges.length === 1 ? '' : 's'} across {productsTouched} product{productsTouched === 1 ? '' : 's'}
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            {examples.map((c, i) => (
              <div key={i} className="text-xs text-slate-600 flex items-baseline gap-1.5">
                <span className="font-medium text-slate-800">{c.subjectName}</span>
                <span className="text-slate-300">·</span>
                <span>{c.featureName}:</span>
                <span className="text-slate-400">{c.before}</span>
                <span className="text-slate-300">→</span>
                <span className="text-slate-800">{c.after}</span>
              </div>
            ))}
            {totalChanges > examples.length && (
              <div className="text-xs text-slate-400 pt-1">+{totalChanges - examples.length} more</div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
