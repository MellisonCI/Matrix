'use client'

import { ValueType } from '@/lib/supabase'
import { ValueLike, computeRowSummary } from '@/lib/matrix'

export interface PivotColumn {
  key: string
  label: string
  sublabel?: string
}

export interface PivotRow {
  featureId: string
  name: string
  depth: number
  valueType: ValueType
  unitLabel: string | null
  values: Map<string, ValueLike | undefined> // columnKey -> value
}

export interface PivotSection {
  name: string
  rows: PivotRow[]
}

function CellContent({ value, valueType }: { value: ValueLike | undefined; valueType: ValueType }) {
  if (!value || (value.raw_text === null && !value.is_not_applicable)) {
    return <span className="text-slate-300">—</span>
  }
  if (value.is_not_applicable) {
    return <span className="text-slate-300 text-xs">N/A</span>
  }
  if (valueType === 'boolean') {
    return (
      <div className="flex flex-col items-center leading-tight">
        <span className={value.is_present ? 'text-emerald-600 text-base' : 'text-slate-300'}>
          {value.is_present ? '●' : '—'}
        </span>
        {value.detail && <span className="text-[10px] text-slate-400 whitespace-normal max-w-[120px] text-center">{value.detail}</span>}
      </div>
    )
  }
  if (valueType === 'numeric') {
    return <span className="text-slate-700">{value.numeric_value ?? value.raw_text}</span>
  }
  return <span className="text-slate-700 text-xs whitespace-normal max-w-[140px] inline-block">{value.raw_text}</span>
}

export function PivotTable({
  sections,
  columns,
  showSummary = true,
}: {
  sections: PivotSection[]
  columns: PivotColumn[]
  showSummary?: boolean
}) {
  return (
    <div className="overflow-auto border border-slate-200 rounded-xl bg-white">
      <table className="border-collapse text-sm min-w-full">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-20 bg-slate-50 border-b border-r border-slate-200 px-3 py-2 text-left font-medium text-slate-600 min-w-[260px]">
              Feature
            </th>
            {showSummary && (
              <th className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-2 py-2 text-center font-medium text-slate-500 min-w-[70px]">
                Adoption
              </th>
            )}
            {columns.map(col => (
              <th
                key={col.key}
                className="sticky top-0 z-10 bg-slate-50 border-b border-slate-200 px-2 py-2 text-center font-medium text-slate-600 min-w-[90px] whitespace-nowrap"
              >
                <div>{col.label}</div>
                {col.sublabel && <div className="text-[11px] font-normal text-slate-400">{col.sublabel}</div>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sections.map(section => (
            <SectionRows key={section.name} section={section} columns={columns} showSummary={showSummary} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SectionRows({ section, columns, showSummary }: { section: PivotSection; columns: PivotColumn[]; showSummary: boolean }) {
  return (
    <>
      <tr>
        <td
          colSpan={columns.length + 1 + (showSummary ? 1 : 0)}
          className="sticky left-0 bg-slate-100 border-b border-slate-200 px-3 py-1.5 font-medium text-slate-700 text-xs uppercase tracking-wide"
        >
          {section.name}
        </td>
      </tr>
      {section.rows.map(row => (
        <tr key={row.featureId} className="hover:bg-slate-50">
          <td
            className="sticky left-0 bg-white border-b border-r border-slate-100 px-3 py-2 text-slate-700"
            style={{ paddingLeft: `${12 + row.depth * 16}px` }}
          >
            {row.name}
          </td>
          {showSummary && (
            <td className="border-b border-slate-100 px-2 py-2 text-center text-xs text-slate-500">
              {computeRowSummary(row.valueType, [...row.values.values()].filter((v): v is ValueLike => !!v), row.unitLabel)}
            </td>
          )}
          {columns.map(col => (
            <td key={col.key} className="border-b border-slate-100 px-2 py-2 text-center">
              <CellContent value={row.values.get(col.key)} valueType={row.valueType} />
            </td>
          ))}
        </tr>
      ))}
    </>
  )
}
