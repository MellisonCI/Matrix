'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ManageNav } from '@/components/ManageNav'
import { CategoryTreeManager } from '@/components/CategoryTreeManager'
import { ProductManager } from '@/components/ProductManager'
import { TopNav } from '@/components/TopNav'

export default function ManageProductsPage() {
  const [tab, setTab] = useState<'features' | 'products'>('products')

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-slate-400 hover:text-slate-900">
              <ArrowLeft size={18} />
            </Link>
            <h1 className="text-lg font-light text-slate-900 tracking-tight">Manage Product Features</h1>
          </div>
          <TopNav active="manage" />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <ManageNav active="products" />

        <div className="flex gap-1 mb-6">
          {(['products', 'features'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 text-sm rounded-lg ${tab === t ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
            >
              {t === 'products' ? 'Products' : 'Feature Definitions'}
            </button>
          ))}
        </div>

        {tab === 'products' ? (
          <ProductManager />
        ) : (
          <CategoryTreeManager
            categoryTable="product_categories"
            subcategoryTable="product_subcategories"
            featureTable="product_features"
          />
        )}
      </div>
    </div>
  )
}
