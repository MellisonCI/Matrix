'use client'

export interface BarListItem {
  label: string
  sublabel?: string
  value: number
}

export function BarList({
  items,
  formatValue,
  maxValue,
}: {
  items: BarListItem[]
  formatValue?: (v: number) => string
  maxValue?: number
}) {
  const max = maxValue ?? Math.max(...items.map(i => i.value), 1)

  if (items.length === 0) {
    return <div className="text-sm text-slate-400">No data.</div>
  }

  return (
    <div className="space-y-2.5">
      {items.map((item, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-44 flex-shrink-0 min-w-0">
            <div className="text-sm text-slate-700 truncate" title={item.label}>{item.label}</div>
            {item.sublabel && <div className="text-[11px] text-slate-400 truncate">{item.sublabel}</div>}
          </div>
          <div className="flex-1 bg-slate-100 rounded-full h-3.5 overflow-hidden">
            <div
              className="bg-slate-900 h-full rounded-full transition-all"
              style={{ width: `${Math.min(100, (item.value / max) * 100)}%` }}
            />
          </div>
          <div className="w-12 flex-shrink-0 text-xs text-slate-500 text-right tabular-nums">
            {formatValue ? formatValue(item.value) : item.value}
          </div>
        </div>
      ))}
    </div>
  )
}
