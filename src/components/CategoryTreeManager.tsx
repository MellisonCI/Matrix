'use client'

import { useEffect, useState } from 'react'
import { supabase, ValueType } from '@/lib/supabase'
import { Plus, Trash2, ChevronRight } from 'lucide-react'

interface Category {
  id: string
  name: string
  display_order: number
}
interface Subcategory {
  id: string
  category_id: string
  name: string
  display_order: number
}
interface Feature {
  id: string
  subcategory_id: string
  parent_feature_id: string | null
  name: string
  value_type: ValueType
  display_order: number
}

const VALUE_TYPES: ValueType[] = ['boolean', 'numeric', 'text']

export function CategoryTreeManager({
  categoryTable,
  subcategoryTable,
  featureTable,
}: {
  categoryTable: string
  subcategoryTable: string
  featureTable: string
}) {
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [subcategories, setSubcategories] = useState<Subcategory[]>([])
  const [features, setFeatures] = useState<Feature[]>([])
  const [newCategoryName, setNewCategoryName] = useState('')
  const [newSubcategoryName, setNewSubcategoryName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCategories()
  }, [])

  useEffect(() => {
    if (selectedId) loadTree(selectedId)
  }, [selectedId])

  async function loadCategories() {
    const { data } = await supabase.from(categoryTable).select('*').order('display_order')
    setCategories(data || [])
    if (data && data.length > 0 && !selectedId) setSelectedId(data[0].id)
    setLoading(false)
  }

  async function loadTree(categoryId: string) {
    const { data: subs } = await supabase.from(subcategoryTable).select('*').eq('category_id', categoryId).order('display_order')
    setSubcategories(subs || [])
    if (subs && subs.length > 0) {
      const { data: feats } = await supabase
        .from(featureTable)
        .select('*')
        .in('subcategory_id', subs.map((s: Subcategory) => s.id))
        .order('display_order')
      setFeatures(feats || [])
    } else {
      setFeatures([])
    }
  }

  async function addCategory() {
    if (!newCategoryName.trim()) return
    const { data } = await supabase
      .from(categoryTable)
      .insert({ name: newCategoryName.trim(), display_order: categories.length })
      .select()
      .single()
    setNewCategoryName('')
    await loadCategories()
    if (data) setSelectedId(data.id)
  }

  async function renameCategory(id: string, name: string) {
    await supabase.from(categoryTable).update({ name }).eq('id', id)
    loadCategories()
  }

  async function deleteCategory(id: string) {
    if (!confirm('Delete this category and everything under it?')) return
    await supabase.from(categoryTable).delete().eq('id', id)
    if (selectedId === id) setSelectedId(null)
    loadCategories()
  }

  async function addSubcategory() {
    if (!newSubcategoryName.trim() || !selectedId) return
    await supabase.from(subcategoryTable).insert({
      category_id: selectedId,
      name: newSubcategoryName.trim(),
      display_order: subcategories.length,
    })
    setNewSubcategoryName('')
    loadTree(selectedId)
  }

  async function renameSubcategory(id: string, name: string) {
    await supabase.from(subcategoryTable).update({ name }).eq('id', id)
  }

  async function deleteSubcategory(id: string) {
    if (!confirm('Delete this subcategory and its features?')) return
    await supabase.from(subcategoryTable).delete().eq('id', id)
    if (selectedId) loadTree(selectedId)
  }

  async function addFeature(subcategoryId: string, parentFeatureId: string | null, name: string) {
    if (!name.trim()) return
    const siblingCount = features.filter(
      f => f.subcategory_id === subcategoryId && f.parent_feature_id === parentFeatureId
    ).length
    await supabase.from(featureTable).insert({
      subcategory_id: subcategoryId,
      parent_feature_id: parentFeatureId,
      name: name.trim(),
      value_type: 'boolean',
      display_order: siblingCount,
    })
    if (selectedId) loadTree(selectedId)
  }

  async function renameFeature(id: string, name: string) {
    await supabase.from(featureTable).update({ name }).eq('id', id)
  }

  async function setFeatureValueType(id: string, value_type: ValueType) {
    await supabase.from(featureTable).update({ value_type }).eq('id', id)
    if (selectedId) loadTree(selectedId)
  }

  async function deleteFeature(id: string) {
    if (!confirm('Delete this feature (and any nested features under it)?')) return
    await supabase.from(featureTable).delete().eq('id', id)
    if (selectedId) loadTree(selectedId)
  }

  if (loading) return <div className="text-slate-400 text-sm">Loading...</div>

  return (
    <div className="flex gap-6">
      <aside className="w-64 flex-shrink-0">
        <div className="space-y-1 mb-3">
          {categories.map(cat => (
            <div
              key={cat.id}
              className={`flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer group ${
                selectedId === cat.id ? 'bg-slate-900 text-white' : 'hover:bg-slate-100 text-slate-700'
              }`}
              onClick={() => setSelectedId(cat.id)}
            >
              <input
                value={cat.name}
                onClick={e => e.stopPropagation()}
                onChange={e => setCategories(categories.map(c => (c.id === cat.id ? { ...c, name: e.target.value } : c)))}
                onBlur={e => renameCategory(cat.id, e.target.value)}
                className={`flex-1 bg-transparent border-0 focus:outline-none text-sm ${selectedId === cat.id ? 'text-white' : 'text-slate-700'}`}
              />
              <button
                onClick={e => { e.stopPropagation(); deleteCategory(cat.id) }}
                className={`opacity-0 group-hover:opacity-100 ${selectedId === cat.id ? 'text-slate-300 hover:text-white' : 'text-slate-300 hover:text-red-500'}`}
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
        <div className="flex gap-1">
          <input
            type="text"
            placeholder="New category..."
            value={newCategoryName}
            onChange={e => setNewCategoryName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addCategory()}
            className="flex-1 bg-white border border-slate-300 text-slate-900 px-2 py-1.5 rounded-lg text-sm focus:outline-none focus:border-slate-400"
          />
          <button onClick={addCategory} className="px-2 py-1.5 bg-slate-900 text-white rounded-lg">
            <Plus size={14} />
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        {subcategories.map(sub => (
          <div key={sub.id} className="mb-5 p-4 bg-white border border-slate-200 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <input
                value={sub.name}
                onChange={e => setSubcategories(subcategories.map(s => (s.id === sub.id ? { ...s, name: e.target.value } : s)))}
                onBlur={e => renameSubcategory(sub.id, e.target.value)}
                className="font-medium text-sm text-slate-800 border-0 focus:outline-none focus:bg-slate-50 rounded px-1"
              />
              <button onClick={() => deleteSubcategory(sub.id)} className="text-slate-300 hover:text-red-500">
                <Trash2 size={13} />
              </button>
            </div>
            <FeatureTree
              features={features.filter(f => f.subcategory_id === sub.id)}
              parentId={null}
              depth={0}
              subcategoryId={sub.id}
              onAdd={addFeature}
              onRename={renameFeature}
              onDelete={deleteFeature}
              onSetValueType={setFeatureValueType}
            />
          </div>
        ))}

        <div className="flex gap-1">
          <input
            type="text"
            placeholder="New subcategory..."
            value={newSubcategoryName}
            onChange={e => setNewSubcategoryName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSubcategory()}
            className="flex-1 bg-white border border-slate-300 text-slate-900 px-3 py-2 rounded-lg text-sm focus:outline-none focus:border-slate-400"
          />
          <button
            onClick={addSubcategory}
            className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-900 text-white rounded-lg font-medium hover:bg-slate-800 transition-colors"
          >
            <Plus size={14} />
            Add Subcategory
          </button>
        </div>
      </div>
    </div>
  )
}

function FeatureTree({
  features,
  parentId,
  depth,
  subcategoryId,
  onAdd,
  onRename,
  onDelete,
  onSetValueType,
}: {
  features: Feature[]
  parentId: string | null
  depth: number
  subcategoryId: string
  onAdd: (subcategoryId: string, parentFeatureId: string | null, name: string) => void
  onRename: (id: string, name: string) => void
  onDelete: (id: string) => void
  onSetValueType: (id: string, valueType: ValueType) => void
}) {
  const [draft, setDraft] = useState('')
  const children = features.filter(f => f.parent_feature_id === parentId).sort((a, b) => a.display_order - b.display_order)

  return (
    <div style={{ paddingLeft: depth > 0 ? 16 : 0 }}>
      {children.map(f => (
        <div key={f.id}>
          <div className="flex items-center gap-2 py-1 group">
            {depth > 0 && <ChevronRight size={12} className="text-slate-300 flex-shrink-0" />}
            <input
              defaultValue={f.name}
              onBlur={e => onRename(f.id, e.target.value)}
              className="flex-1 text-sm text-slate-700 border-0 focus:outline-none focus:bg-slate-50 rounded px-1"
            />
            <select
              value={f.value_type}
              onChange={e => onSetValueType(f.id, e.target.value as ValueType)}
              className="text-xs border border-slate-200 rounded px-1 py-0.5 text-slate-500"
            >
              {VALUE_TYPES.map(vt => (
                <option key={vt} value={vt}>{vt}</option>
              ))}
            </select>
            <button onClick={() => onDelete(f.id)} className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-red-500">
              <Trash2 size={12} />
            </button>
          </div>
          <FeatureTree
            features={features}
            parentId={f.id}
            depth={depth + 1}
            subcategoryId={subcategoryId}
            onAdd={onAdd}
            onRename={onRename}
            onDelete={onDelete}
            onSetValueType={onSetValueType}
          />
        </div>
      ))}
      <div className="flex gap-1 mt-1">
        <input
          type="text"
          placeholder={depth === 0 ? 'New feature...' : 'New nested feature...'}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && draft.trim()) {
              onAdd(subcategoryId, parentId, draft)
              setDraft('')
            }
          }}
          className="flex-1 text-xs border border-slate-200 rounded px-2 py-1 focus:outline-none focus:border-slate-400"
        />
      </div>
    </div>
  )
}
