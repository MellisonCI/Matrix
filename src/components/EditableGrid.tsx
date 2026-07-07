'use client'

import { useState } from 'react'
import { ValueType } from '@/lib/supabase'
import { ValueLike } from '@/lib/matrix'
import { Check, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { PivotColumn } from './PivotTable'

export interface EditableRow {
  featureId: string
  name: string
  depth: number
  valueType: ValueType
  unitLabel: string | null
  values: Map<string, ValueLike | undefined>
}

export interface EditableSection {
  name: string
  rows: EditableRow[]
}

type CellStatus = 'idle' | 'saving' | 'saved' | 'error'

export function EditableGrid({
  sections,
  columns,
  onCellCommit,
  changedKeys,
}: {
  sections: EditableSection[]
  columns: PivotColumn[]
  onCellCommit: (featureId: string, columnKey: string, next: Partial<ValueLike>) => Promise<void>
  changedKeys?: Set<string>
}) {
  const [status, setStatus] = useState<Record<string, CellStatus>>({})

  async function commit(featureId: string, columnKey: string, next: Partial<ValueLike>) {
    const key = `${featureId}:${columnKey}`
    setStatus(s => ({ ...s, [key]: 'saving' }))
    try {
      await onCellCommit(featureId, columnKey, next)
      setStatus(s => ({ ...s, [key]: 'saved' }))
      setTimeout(() => setStatus(s => (s[key] === 'saved' ? { ...s, [key]: 'idle' } : s)), 1500)
    } catch {
      setStatus(s => ({ ...s, [key]: 'error' }))
    }
  }

  return (
    <div className="overflow-auto border border-slate-200 rounded-xl bg-white">
      <table className="border-collapse text-sm min-w-full">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-20 bg-slate-50 border-b border-r border-slate-200 px-3 py-2 text-left font-medium text-slate-600 min-w-[260px]">
              Feature
            </th>
            {columns.map(col => (
              <th
                key={col.key}
                className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-2 py-2 text-center font-medium text-slate-600 min-w-[120px] whitespace-nowrap"
              >
                <div>{col.label}</div>
                {col.sublabel && <div className="text-[11px] font-normal text-slate-400">{col.sublabel}</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map(section => (
            <SectionRows
              key={section.name}
              section={section}
              columns={columns}
              status={status}
              onCommit={commit}
              changedKeys={changedKeys}
            />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SectionRows({
  section,
  columns,
  status,
  onCommit,
  changedKeys,
}: {
  section: EditableSection
  columns: PivotColumn[]
  status: Record<string, CellStatus>
  onCommit: (featureId: string, columnKey: string, next: Partial<ValueLike>) => void
  changedKeys?: Set<string>
}) {
  const [expanded, setExpanded] = useState(true)

  return (
    <>
      <tr>
        <td
          colSpan={columns.length + 1}
          className="bg-slate-100 border-b border-slate-200 py-1.5 cursor-pointer select-none"
          onClick={() => setExpanded(e => !e)}
        >
          {/* see PivotTable.tsx: sticky doesn't reliably work on a colSpan
              <td> with border-collapse, so the inner div sticks instead. */}
          <div className="sticky left-3 z-10 w-fit flex items-center gap-1.5 font-medium text-slate-700 text-xs uppercase tracking-wide">
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            {section.name}
            <span className="text-slate-400 normal-case font-normal">({section.rows.length})</span>
          </div>
        </td>
      </tr>
      {expanded && section.rows.map(row => (
        <tr key={row.featureId} className="hover:bg-slate-50">
          <td
            className="sticky left-0 bg-white border-b border-r border-slate-100 px-3 py-2 text-slate-700"
            style={{ paddingLeft: `${12 + row.depth * 16}px` }}
          >
            {row.name}
          </td>
          {columns.map(col => {
            const changed = changedKeys?.has(`${row.featureId}::${col.key}`)
            return (
              <td
                key={col.key}
                className={`relative border-b border-slate-100 px-2 py-1.5 text-center align-top ${changed ? 'bg-amber-50' : ''}`}
              >
                {changed && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-400" />}
                <Cell
                  row={row}
                  columnKey={col.key}
                  value={row.values.get(col.key)}
                  status={status[`${row.featureId}:${col.key}`] || 'idle'}
                  onCommit={next => onCommit(row.featureId, col.key, next)}
                />
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}

function StatusIcon({ status }: { status: CellStatus }) {
  if (status === 'saving') return <Loader2 size={11} className="animate-spin text-slate-400" />
  if (status === 'saved') return <Check size={11} className="text-emerald-500" />
  if (status === 'error') return <span className="text-red-500 text-[10px]">!</span>
  return null
}

function Cell({
  row,
  value,
  status,
  onCommit,
}: {
  row: EditableRow
  columnKey: string
  value: ValueLike | undefined
  status: CellStatus
  onCommit: (next: Partial<ValueLike>) => void
}) {
  // All hooks called unconditionally (Rules of Hooks) even though only one
  // branch's state is actually used for a given row.valueType -- that type
  // is fixed for the lifetime of this cell, so no state ever goes stale.
  //
  // Every editable value keeps its own local draft state, initialized from
  // the fetched `value` prop but never re-synced from it afterward. That prop
  // stays frozen at whatever was fetched on page load (committing a change
  // doesn't update the parent's fetched list), so a control whose displayed
  // value is derived directly from `value` snaps back the instant you change
  // it -- this bit the boolean dropdown specifically because it had no local
  // state of its own (unlike the numeric/text inputs below).
  const [presence, setPresence] = useState<'' | 'yes' | 'na'>(
    value?.is_not_applicable ? 'na' : value?.is_present ? 'yes' : ''
  )
  const [detail, setDetail] = useState(value?.detail || '')
  const [num, setNum] = useState<number | null>(value?.numeric_value ?? null)
  const [text, setText] = useState<string>(value?.raw_text ?? '')

  if (row.valueType === 'boolean') {
    return (
      <div className="flex flex-col items-center gap-1">
        <div className="flex items-center gap-1">
          <select
            value={presence}
            onChange={e => {
              const v = e.target.value as '' | 'yes' | 'na'
              setPresence(v)
              onCommit({
                is_present: v === 'yes' ? true : v === '' ? null : false,
                is_not_applicable: v === 'na',
                raw_text: v === 'yes' ? (detail ? `• (${detail})` : '•') : v === 'na' ? 'N/A' : null,
              })
            }}
            className="text-xs border border-slate-200 rounded px-1 py-0.5 bg-white focus:outline-none focus:border-slate-400"
          >
            <option value="">—</option>
            <option value="yes">Yes</option>
            <option value="na">N/A</option>
          </select>
          <StatusIcon status={status} />
        </div>
        {presence === 'yes' && (
          <input
            type="text"
            placeholder="detail"
            value={detail}
            onChange={e => setDetail(e.target.value)}
            onBlur={() => onCommit({ is_present: true, is_not_applicable: false, detail: detail || null, raw_text: detail ? `• (${detail})` : '•' })}
            className="text-[11px] border border-slate-200 rounded px-1 py-0.5 w-24 focus:outline-none focus:border-slate-400"
          />
        )}
      </div>
    )
  }

  if (row.valueType === 'numeric') {
    return (
      <div className="flex items-center justify-center gap-1">
        <input
          type="number"
          value={num ?? ''}
          onChange={e => setNum(e.target.value === '' ? null : Number(e.target.value))}
          onBlur={() => onCommit({ numeric_value: num, raw_text: num === null ? null : String(num), is_present: null, is_not_applicable: false })}
          className="text-xs border border-slate-200 rounded px-1.5 py-0.5 w-20 text-center focus:outline-none focus:border-slate-400"
        />
        <StatusIcon status={status} />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-1">
      <input
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={() => onCommit({ raw_text: text || null, is_present: null, is_not_applicable: text.trim().toUpperCase() === 'N/A' })}
        className="text-xs border border-slate-200 rounded px-1.5 py-0.5 w-28 text-center focus:outline-none focus:border-slate-400"
      />
      <StatusIcon status={status} />
    </div>
  )
}
