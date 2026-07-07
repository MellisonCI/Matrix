'use client'

export interface StackedBarSegment {
  key: string
  label: string
  value: number
  color: string
}

export interface StackedBarItem {
  label: string
  segments: StackedBarSegment[]
}

export function StackedBarList({
  items,
  legend,
}: {
  items: StackedBarItem[]
  legend: { label: string; color: string }[]
}) {
  const max = Math.max(...items.map(i => i.segments.reduce((sum, s) => sum + s.value, 0)), 1)

  if (items.length === 0) {
    return <div className="text-sm text-slate-400">No data.</div>
  }

  return (
    <div>
      <div className="flex items-center gap-4 mb-3 flex-wrap">
        {legend.map(l => (
          <div key={l.label} className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: l.color }} />
            {l.label}
          </div>
        ))}
      </div>
      <div className="space-y-2.5">
        {items.map((item, i) => {
          const total = item.segments.reduce((sum, s) => sum + s.value, 0)
          return (
            <div key={i} className="flex items-center gap-3">
              <div className="w-44 flex-shrink-0 text-sm text-slate-700 truncate" title={item.label}>
                {item.label}
              </div>
              <div className="flex-1 bg-slate-100 rounded-full h-3.5 overflow-hidden flex">
                {item.segments
                  .filter(s => s.value > 0)
                  .map(s => (
                    <div
                      key={s.key}
                      style={{ width: `${(s.value / max) * 100}%`, background: s.color }}
                      title={`${s.label}: ${s.value}`}
                    />
                  ))}
              </div>
              <div className="w-10 flex-shrink-0 text-xs text-slate-500 text-right tabular-nums">{total}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
