'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { slugify } from '@/lib/slug'
import { LayoutDashboard, Grid3x3, Package, Settings } from 'lucide-react'

type Section = 'dashboard' | 'capabilities' | 'products' | 'manage'

export function TopNav({ active, quarterId }: { active: Section; quarterId?: string | null }) {
  const [capSlug, setCapSlug] = useState<string | null>(null)
  const [prodSlug, setProdSlug] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('capability_categories')
      .select('name')
      .order('display_order')
      .limit(1)
      .then(({ data }) => data?.[0] && setCapSlug(slugify(data[0].name)))
    supabase
      .from('product_categories')
      .select('name')
      .order('display_order')
      .limit(1)
      .then(({ data }) => data?.[0] && setProdSlug(slugify(data[0].name)))
  }, [])

  const qs = quarterId ? `?quarter=${quarterId}` : ''

  const items: { key: Section; label: string; href: string | null; icon: typeof LayoutDashboard }[] = [
    { key: 'dashboard', label: 'Dashboard', href: `/${qs}`, icon: LayoutDashboard },
    { key: 'capabilities', label: 'Capabilities', href: capSlug ? `/capabilities/${capSlug}${qs}` : null, icon: Grid3x3 },
    { key: 'products', label: 'Products', href: prodSlug ? `/products/${prodSlug}${qs}` : null, icon: Package },
    { key: 'manage', label: 'Manage', href: '/manage/firms', icon: Settings },
  ]

  return (
    <div className="flex items-center gap-2">
      {items.map(item => {
        if (!item.href) return null
        const Icon = item.icon
        const isActive = active === item.key
        return (
          <Link
            key={item.key}
            href={item.href}
            className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg font-medium border transition-colors ${
              isActive
                ? 'bg-slate-900 text-white border-slate-900'
                : 'text-slate-500 hover:text-slate-900 border-slate-200 hover:border-slate-400'
            }`}
          >
            <Icon size={14} />
            {item.label}
          </Link>
        )
      })}
    </div>
  )
}
