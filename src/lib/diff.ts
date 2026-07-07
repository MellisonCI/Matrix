import { ValueType } from './supabase'

export interface DiffableValue {
  feature_id: string
  raw_text: string | null
  is_present: boolean | null
  is_not_applicable: boolean
  numeric_value: number | null
  detail: string | null
}

export function formatCellValue(v: DiffableValue | undefined, valueType: ValueType): string {
  if (!v) return '—'
  if (v.is_not_applicable) return 'N/A'
  if (valueType === 'boolean') return v.is_present ? (v.detail ? `Yes (${v.detail})` : 'Yes') : 'No'
  if (valueType === 'numeric') return v.numeric_value != null ? String(v.numeric_value) : '—'
  return v.raw_text || '—'
}

/** Keys of the form `${feature_id}::${subjectId}` whose formatted value differs between the two snapshots. */
export function computeChangedKeys<V extends DiffableValue>(
  current: V[],
  previous: V[],
  getSubjectId: (v: V) => string,
  featuresById: Map<string, { value_type: ValueType }>
): Set<string> {
  const key = (v: V) => `${v.feature_id}::${getSubjectId(v)}`
  const curByKey = new Map(current.map(v => [key(v), v]))
  const prevByKey = new Map(previous.map(v => [key(v), v]))
  const allKeys = new Set([...curByKey.keys(), ...prevByKey.keys()])

  const changed = new Set<string>()
  for (const k of allKeys) {
    const cur = curByKey.get(k)
    const prev = prevByKey.get(k)
    const feature = featuresById.get((cur ?? prev)!.feature_id)
    if (!feature) continue
    if (formatCellValue(prev, feature.value_type) !== formatCellValue(cur, feature.value_type)) {
      changed.add(k)
    }
  }
  return changed
}
