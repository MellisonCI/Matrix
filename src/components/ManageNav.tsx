'use client'

import Link from 'next/link'

const TABS = [
  { key: 'firms', label: 'Firms', href: '/manage/firms' },
  { key: 'quarters', label: 'Quarters', href: '/manage/quarters' },
  { key: 'capabilities', label: 'Capability Features', href: '/manage/capabilities' },
  { key: 'products', label: 'Product Features', href: '/manage/products' },
] as const

export function ManageNav({ active }: { active: (typeof TABS)[number]['key'] }) {
  return (
    <div className="flex gap-1 mb-6 border-b border-slate-200">
      {TABS.map(tab => (
        <Link
          key={tab.key}
          href={tab.href}
          className={`px-3 py-2 text-sm border-b-2 -mb-px transition-colors ${
            active === tab.key
              ? 'border-slate-900 text-slate-900 font-medium'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  )
}
