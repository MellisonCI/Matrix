'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { slugify } from '@/lib/slug'

export function CategoryNav({
  basePath,
  categories,
  activeSlug,
  mode,
  selectedIds,
  onToggleSelect,
}: {
  basePath: string
  categories: { id: string; name: string }[]
  activeSlug: string
  mode: 'view' | 'edit'
  /** When provided (with onToggleSelect), renders a checkbox per category so more
   * than one category's data can be combined on the current page -- separate from
   * clicking the name, which still navigates to that category's own single view. */
  selectedIds?: Set<string>
  onToggleSelect?: (id: string) => void
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
          <div
            key={cat.id}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {onToggleSelect && (
              <input
                type="checkbox"
                checked={selectedIds?.has(cat.id) ?? false}
                onChange={() => onToggleSelect(cat.id)}
                title="Include in combined view"
                className={active ? 'accent-white' : 'accent-slate-900'}
              />
            )}
            <Link href={`${path}${qs}`} className="flex-1 truncate">
              {cat.name}
            </Link>
          </div>
        )
      })}
    </nav>
  )
}
