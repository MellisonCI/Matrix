import { ValueType } from './supabase'

export interface FeatureLike {
  id: string
  subcategory_id: string
  parent_feature_id: string | null
  name: string
  value_type: ValueType
  unit_label: string | null
  display_order: number
}

export interface FeatureNode<F extends FeatureLike> {
  feature: F
  depth: number
  children: FeatureNode<F>[]
}

/** Builds a parent/child tree of root features (per subcategory), sorted by display_order. */
export function buildFeatureTree<F extends FeatureLike>(
  features: F[],
  subcategoryId: string
): FeatureNode<F>[] {
  const inSubcat = features.filter(f => f.subcategory_id === subcategoryId)
  const byParent = new Map<string | null, F[]>()
  for (const f of inSubcat) {
    const key = f.parent_feature_id
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(f)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.display_order - b.display_order)
  }

  function build(parentId: string | null, depth: number): FeatureNode<F>[] {
    const children = byParent.get(parentId) || []
    return children.map(f => ({
      feature: f,
      depth,
      children: build(f.id, depth + 1),
    }))
  }

  return build(null, 0)
}

/** Flattens a feature tree into a depth-first ordered list for table rendering. */
export function flattenTree<F extends FeatureLike>(nodes: FeatureNode<F>[]): { feature: F; depth: number }[] {
  const out: { feature: F; depth: number }[] = []
  function walk(list: FeatureNode<F>[]) {
    for (const node of list) {
      out.push({ feature: node.feature, depth: node.depth })
      walk(node.children)
    }
  }
  walk(nodes)
  return out
}

export interface ValueLike {
  raw_text: string | null
  is_present: boolean | null
  is_not_applicable: boolean
  numeric_value: number | null
  detail: string | null
}

/**
 * Computes a per-row summary: "% present" for boolean features, average for numeric.
 *
 * A blank cell (no stored value row at all) means "not present," not "no data" --
 * only an explicit is_not_applicable row should be excluded from the denominator.
 * So this takes the full list of column keys (all firms/products), not just the
 * keys that happen to have a stored row, otherwise every boolean feature comes out
 * as 100% (every firm that HAS a row is, by construction, a present one).
 */
export function computeRowSummary(
  valueType: ValueType,
  columnKeys: string[],
  valuesByColumnKey: Map<string, ValueLike | undefined>,
  unitLabel: string | null
): string {
  const entries = columnKeys.map(key => valuesByColumnKey.get(key))
  const applicable = entries.filter(v => !(v && v.is_not_applicable))
  if (valueType === 'boolean') {
    if (applicable.length === 0) return '—'
    const present = applicable.filter(v => v && v.is_present).length
    return `${Math.round((present / applicable.length) * 100)}%`
  }
  if (valueType === 'numeric') {
    const nums = applicable
      .map(v => v?.numeric_value)
      .filter((n): n is number => n !== null && n !== undefined)
    if (nums.length === 0) return '—'
    const avg = nums.reduce((a, b) => a + b, 0) / nums.length
    const rounded = Math.round(avg * 100) / 100
    return unitLabel ? `avg ${rounded} ${unitLabel}` : `avg ${rounded}`
  }
  return '—'
}
