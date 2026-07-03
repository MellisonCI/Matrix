'use client'

import { useEffect, useState } from 'react'
import { supabase, Firm, Product, ProductCategory } from '@/lib/supabase'
import { Plus, Trash2 } from 'lucide-react'

export function ProductManager() {
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [firms, setFirms] = useState<Firm[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [firmId, setFirmId] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    load()
  }, [])

  async function load() {
    const [cats, fs, prods] = await Promise.all([
      supabase.from('product_categories').select('*').order('display_order'),
      supabase.from('firms').select('*').order('display_order'),
      supabase.from('products').select('*').order('display_order'),
    ])
    setCategories(cats.data || [])
    setFirms(fs.data || [])
    setProducts(prods.data || [])
    if (cats.data?.[0]) setCategoryId(cats.data[0].id)
    if (fs.data?.[0]) setFirmId(fs.data[0].id)
    setLoading(false)
  }

  async function addProduct() {
    if (!name.trim() || !categoryId || !firmId) return
    const count = products.filter(p => p.category_id === categoryId && p.firm_id === firmId).length
    const { error } = await supabase.from('products').insert({
      firm_id: firmId,
      category_id: categoryId,
      name: name.trim(),
      display_order: count,
    })
    if (error) {
      alert(error.message)
      return
    }
    setName('')
    load()
  }

  async function deleteProduct(id: string) {
    if (!confirm('Delete this product and its values?')) return
    await supabase.from('products').delete().eq('id', id)
    load()
  }

  const firmsById = new Map(firms.map(f => [f.id, f]))

  if (loading) return <div className="text-slate-400 text-sm">Loading...</div>

  return (
    <div>
      {categories.map(cat => {
        const catProducts = products.filter(p => p.category_id === cat.id)
        return (
          <div key={cat.id} className="mb-6">
            <h3 className="text-sm font-medium text-slate-700 mb-2">{cat.name}</h3>
            <div className="space-y-1">
              {catProducts.map(p => (
                <div key={p.id} className="flex items-center justify-between px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm">
                  <span>
                    <span className="text-slate-400">{firmsById.get(p.firm_id)?.name}</span>{' '}
                    <span className="text-slate-800">{p.name}</span>
                  </span>
                  <button onClick={() => deleteProduct(p.id)} className="text-slate-300 hover:text-red-500">
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
              {catProducts.length === 0 && <div className="text-xs text-slate-400 px-1">No products yet.</div>}
            </div>
          </div>
        )
      })}

      <div className="flex flex-wrap items-end gap-2 pt-2 border-t border-slate-200">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Category</label>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className="bg-white border border-slate-300 px-2 py-1.5 rounded-lg text-sm">
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Firm</label>
          <select value={firmId} onChange={e => setFirmId(e.target.value)} className="bg-white border border-slate-300 px-2 py-1.5 rounded-lg text-sm">
            {firms.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[160px]">
          <label className="block text-xs text-slate-500 mb-1">Product name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addProduct()}
            className="w-full bg-white border border-slate-300 px-2 py-1.5 rounded-lg text-sm"
          />
        </div>
        <button onClick={addProduct} className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-900 text-white rounded-lg font-medium">
          <Plus size={14} />
          Add Product
        </button>
      </div>
    </div>
  )
}
