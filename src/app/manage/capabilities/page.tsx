'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ManageNav } from '@/components/ManageNav'
import { CategoryTreeManager } from '@/components/CategoryTreeManager'

export default function ManageCapabilitiesPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link href="/" className="text-slate-400 hover:text-slate-900">
            <ArrowLeft size={18} />
          </Link>
          <h1 className="text-lg font-light text-slate-900 tracking-tight">Manage Capability Features</h1>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <ManageNav active="capabilities" />
        <CategoryTreeManager
          categoryTable="capability_categories"
          subcategoryTable="capability_subcategories"
          featureTable="capability_features"
        />
      </div>
    </div>
  )
}
