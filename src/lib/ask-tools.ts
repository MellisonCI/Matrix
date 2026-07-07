import Anthropic from '@anthropic-ai/sdk'
import { supabase } from './supabase'

// Claude never sees raw SQL or a direct database connection -- every question
// is answered through this fixed set of read-only, parameterized lookups.
// That avoids the injection/blast-radius risk of letting an LLM generate
// arbitrary SQL against a database whose RLS policies allow all operations.

export const TOOLS: Anthropic.Tool[] = [
  {
    name: 'list_firms',
    description: 'List all firms (banks) tracked in the database.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'list_capability_categories',
    description: 'List all capability matrix categories (e.g. "Public Site", "Alerts", "Transfers and Bill Pay").',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'list_product_categories',
    description: 'List all product matrix categories (e.g. "Checking Accounts", "Certificates of Deposit").',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'search_capability_features',
    description:
      'Search for capability features by keyword (e.g. "live chat", "alerts"). Returns matching features with their id, category, subcategory, and value type. Call this before get_capability_values to find the right feature_id.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword to search for in feature names' },
        category_name: { type: 'string', description: 'Optional: restrict to a specific capability category' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_capability_values',
    description: 'Get every firm\'s value for one capability feature, for a given quarter (defaults to the current quarter).',
    input_schema: {
      type: 'object',
      properties: {
        feature_id: { type: 'string', description: 'Feature id from search_capability_features' },
        quarter_label: { type: 'string', description: 'e.g. "Q1 2026". Omit for the current quarter.' },
      },
      required: ['feature_id'],
    },
  },
  {
    name: 'search_product_features',
    description:
      'Search for product features by keyword (e.g. "minimum deposit", "overdraft"). Returns matching features with their id, category, subcategory, and value type.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Keyword to search for in feature names' },
        category_name: { type: 'string', description: 'Optional: restrict to a specific product category' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_product_values',
    description: 'Get every product\'s value for one product feature, for a given quarter (defaults to the current quarter).',
    input_schema: {
      type: 'object',
      properties: {
        feature_id: { type: 'string', description: 'Feature id from search_product_features' },
        quarter_label: { type: 'string', description: 'e.g. "Q1 2026". Omit for the current quarter.' },
      },
      required: ['feature_id'],
    },
  },
  {
    name: 'list_products',
    description: 'List products, optionally filtered by firm and/or product category.',
    input_schema: {
      type: 'object',
      properties: {
        firm_name: { type: 'string', description: 'Optional: filter to a specific firm' },
        category_name: { type: 'string', description: 'Optional: filter to a specific product category' },
      },
      required: [],
    },
  },
  {
    name: 'get_firm_capability_coverage',
    description:
      'Get the percentage of applicable capability features a firm has present, across all categories, for a given quarter. Use this for "how feature-rich is X" or firm-ranking questions.',
    input_schema: {
      type: 'object',
      properties: {
        firm_name: { type: 'string', description: 'Firm name (partial match ok, e.g. "Chase")' },
        quarter_label: { type: 'string', description: 'e.g. "Q1 2026". Omit for the current quarter.' },
      },
      required: ['firm_name'],
    },
  },
]

async function resolveQuarterId(quarterLabel?: string): Promise<string | null> {
  if (quarterLabel) {
    const { data } = await supabase.from('quarters').select('id').ilike('label', `%${quarterLabel}%`).limit(1).maybeSingle()
    if (data) return data.id
  }
  const { data } = await supabase.from('quarters').select('id').eq('is_current', true).limit(1).maybeSingle()
  return data?.id ?? null
}

async function listFirms() {
  const { data, error } = await supabase.from('firms').select('name').order('display_order')
  if (error) throw error
  return (data || []).map(f => f.name)
}

async function listCapabilityCategories() {
  const { data, error } = await supabase.from('capability_categories').select('name').order('display_order')
  if (error) throw error
  return (data || []).map(c => c.name)
}

async function listProductCategories() {
  const { data, error } = await supabase.from('product_categories').select('name').order('display_order')
  if (error) throw error
  return (data || []).map(c => c.name)
}

async function searchCapabilityFeatures(query: string, categoryName?: string) {
  const { data, error } = await supabase
    .from('capability_features')
    .select('id, name, value_type, unit_label, capability_subcategories(name, capability_categories(name))')
    .ilike('name', `%${query}%`)
    .limit(30)
  if (error) throw error
  type Row = { id: string; name: string; value_type: string; unit_label: string | null; capability_subcategories: { name: string; capability_categories: { name: string } | null } | null }
  let results = ((data || []) as unknown as Row[]).map(f => ({
    feature_id: f.id,
    name: f.name,
    value_type: f.value_type,
    unit_label: f.unit_label,
    subcategory: f.capability_subcategories?.name,
    category: f.capability_subcategories?.capability_categories?.name,
  }))
  if (categoryName) {
    results = results.filter(r => r.category?.toLowerCase().includes(categoryName.toLowerCase()))
  }
  return results.slice(0, 15)
}

async function getCapabilityValues(featureId: string, quarterLabel?: string) {
  const quarterId = await resolveQuarterId(quarterLabel)
  if (!quarterId) return { error: 'No matching quarter found.' }
  const { data, error } = await supabase
    .from('capability_values')
    .select('raw_text, is_present, is_not_applicable, numeric_value, detail, firms(name)')
    .eq('feature_id', featureId)
    .eq('quarter_id', quarterId)
  if (error) throw error
  type Row = { raw_text: string | null; is_present: boolean | null; is_not_applicable: boolean; numeric_value: number | null; detail: string | null; firms: { name: string } | null }
  return ((data || []) as unknown as Row[]).map(v => ({
    firm: v.firms?.name,
    present: v.is_present,
    not_applicable: v.is_not_applicable,
    numeric_value: v.numeric_value,
    detail: v.detail,
  }))
}

async function searchProductFeatures(query: string, categoryName?: string) {
  const { data, error } = await supabase
    .from('product_features')
    .select('id, name, value_type, unit_label, product_subcategories(name, product_categories(name))')
    .ilike('name', `%${query}%`)
    .limit(30)
  if (error) throw error
  type Row = { id: string; name: string; value_type: string; unit_label: string | null; product_subcategories: { name: string; product_categories: { name: string } | null } | null }
  let results = ((data || []) as unknown as Row[]).map(f => ({
    feature_id: f.id,
    name: f.name,
    value_type: f.value_type,
    unit_label: f.unit_label,
    subcategory: f.product_subcategories?.name,
    category: f.product_subcategories?.product_categories?.name,
  }))
  if (categoryName) {
    results = results.filter(r => r.category?.toLowerCase().includes(categoryName.toLowerCase()))
  }
  return results.slice(0, 15)
}

async function getProductValues(featureId: string, quarterLabel?: string) {
  const quarterId = await resolveQuarterId(quarterLabel)
  if (!quarterId) return { error: 'No matching quarter found.' }
  const { data, error } = await supabase
    .from('product_values')
    .select('raw_text, is_present, is_not_applicable, numeric_value, detail, products(name, firms(name))')
    .eq('feature_id', featureId)
    .eq('quarter_id', quarterId)
  if (error) throw error
  type Row = { raw_text: string | null; is_present: boolean | null; is_not_applicable: boolean; numeric_value: number | null; detail: string | null; products: { name: string; firms: { name: string } | null } | null }
  return ((data || []) as unknown as Row[]).map(v => ({
    firm: v.products?.firms?.name,
    product: v.products?.name,
    present: v.is_present,
    not_applicable: v.is_not_applicable,
    numeric_value: v.numeric_value,
    detail: v.detail,
  }))
}

async function listProducts(firmName?: string, categoryName?: string) {
  const { data, error } = await supabase.from('products').select('name, firms(name), product_categories(name)')
  if (error) throw error
  type Row = { name: string; firms: { name: string } | null; product_categories: { name: string } | null }
  let results = ((data || []) as unknown as Row[]).map(p => ({
    name: p.name,
    firm: p.firms?.name,
    category: p.product_categories?.name,
  }))
  if (firmName) results = results.filter(r => r.firm?.toLowerCase().includes(firmName.toLowerCase()))
  if (categoryName) results = results.filter(r => r.category?.toLowerCase().includes(categoryName.toLowerCase()))
  return results
}

async function getFirmCapabilityCoverage(firmName: string, quarterLabel?: string) {
  const quarterId = await resolveQuarterId(quarterLabel)
  if (!quarterId) return { error: 'No matching quarter found.' }
  const { data: firm } = await supabase.from('firms').select('id, name').ilike('name', `%${firmName}%`).limit(1).maybeSingle()
  if (!firm) return { error: `No firm matching "${firmName}"` }

  const { data: features } = await supabase.from('capability_features').select('id').eq('value_type', 'boolean')
  const featureIds = (features || []).map(f => f.id)
  if (featureIds.length === 0) return { error: 'No boolean capability features found.' }

  const { data: values } = await supabase
    .from('capability_values')
    .select('is_present, is_not_applicable')
    .eq('firm_id', firm.id)
    .eq('quarter_id', quarterId)
    .in('feature_id', featureIds)

  const notApplicable = (values || []).filter(v => v.is_not_applicable).length
  const present = (values || []).filter(v => v.is_present).length
  const denominator = featureIds.length - notApplicable
  const coveragePercent = denominator > 0 ? Math.round((present / denominator) * 100) : 0

  return { firm: firm.name, coverage_percent: coveragePercent, present_count: present, total_applicable: denominator }
}

export async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case 'list_firms':
      return listFirms()
    case 'list_capability_categories':
      return listCapabilityCategories()
    case 'list_product_categories':
      return listProductCategories()
    case 'search_capability_features':
      return searchCapabilityFeatures(input.query as string, input.category_name as string | undefined)
    case 'get_capability_values':
      return getCapabilityValues(input.feature_id as string, input.quarter_label as string | undefined)
    case 'search_product_features':
      return searchProductFeatures(input.query as string, input.category_name as string | undefined)
    case 'get_product_values':
      return getProductValues(input.feature_id as string, input.quarter_label as string | undefined)
    case 'list_products':
      return listProducts(input.firm_name as string | undefined, input.category_name as string | undefined)
    case 'get_firm_capability_coverage':
      return getFirmCapabilityCoverage(input.firm_name as string, input.quarter_label as string | undefined)
    default:
      throw new Error(`Unknown tool: ${name}`)
  }
}
