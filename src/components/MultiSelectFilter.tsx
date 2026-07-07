'use client'

import { ChevronDown } from 'lucide-react'

export interface FilterOption {
  key: string
  label: string
  sublabel?: string
}

/**
 * A checkbox dropdown filter. An empty `selected` set means "no filter --
 * show everything" rather than "show nothing", so callers don't need to
 * pre-populate every option as selected just to start unfiltered.
 */
export function MultiSelectFilter({
  label,
  options,
  selected,
  onToggle,
  onClear,
}: {
  label: string
  options: FilterOption[]
  selected: Set<string>
  onToggle: (key: string) => void
  onClear: () => void
}) {
  const active = selected.size > 0

  return (
    <details className="relative">
      <summary
        className={`list-none cursor-pointer flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg select-none ${
          active ? 'border-slate-400 bg-slate-50 text-slate-900' : 'border-slate-300 text-slate-600 hover:border-slate-400'
        }`}
      >
        {label}
        {active && <span className="text-xs bg-slate-900 text-white rounded-full px-1.5 leading-4">{selected.size}</span>}
        <ChevronDown size={14} />
      </summary>
      <div className="absolute z-30 mt-1 w-72 max-h-80 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg p-2">
        {active && (
          <button onClick={onClear} className="text-xs text-slate-400 hover:text-slate-700 mb-1 px-1 block">
            Clear (show all)
          </button>
        )}
        {options.length === 0 && <div className="text-xs text-slate-400 px-1 py-1">No options.</div>}
        {options.map(opt => (
          <label key={opt.key} className="flex items-center gap-2 px-1 py-1 text-sm hover:bg-slate-50 rounded cursor-pointer">
            <input
              type="checkbox"
              checked={selected.has(opt.key)}
              onChange={() => onToggle(opt.key)}
              className="accent-slate-900"
            />
            <span className="text-slate-700">{opt.label}</span>
            {opt.sublabel && <span className="text-xs text-slate-400">{opt.sublabel}</span>}
          </label>
        ))}
      </div>
    </details>
  )
}

/**
 * Small helper for the common toggle-a-key-in-a-Set pattern used by every
 * filter below. Not a hook (calls no hooks itself) despite touching state --
 * named without a `use` prefix so eslint's hook-rules heuristic doesn't apply
 * hook-call constraints to it.
 */
export function makeSetToggler(set: Set<string>, setSet: (next: Set<string>) => void) {
  return {
    toggle: (key: string) => {
      const next = new Set(set)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      setSet(next)
    },
    clear: () => setSet(new Set()),
  }
}
