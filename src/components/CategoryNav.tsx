'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { slugify } from '@/lib/slug'

export function CategoryNav({
  basePath,
  categories,
  activeSlug,
  mode,
}: {
  basePath: string
  categories: { id: string; name: string }[]
  activeSlug: string
  mode: 'view' | 'edit'
}) {
  const searchParams = useSearchParams()
  const quarter = searchParams.get('quarter')
  const qs = quarter ? `?quarter=${quarter}` : ''

  return (
    <nav className="flex flex-col gap-1">
      {categories.map(cat => {
        const slug = slugify(cat.name)
        const active = slug === activeSlug
        const path = mode === 'edit' ? `${basePath}/${slug}/edit` : `${basePath}/${slug}`
        return (
          <Link
            key={cat.id}
            href={`${path}${qs}`}
            className={`px-3 py-2 rounded-lg text-sm transition-colors ${
              active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {cat.name}
          </Link>
        )
      })}
    </nav>
  )
}
