import { createClient } from '@supabase/supabase-js'

// These placeholders let the app build; real values come from env vars at runtime
const PLACEHOLDER_URL = 'https://xyzxyzxyzxyz.supabase.co'
const PLACEHOLDER_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5enh5enh5enh5eiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNjAwMDAwMDAwLCJleHAiOjE5MTU1NjAwMDB9.placeholder'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || PLACEHOLDER_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || PLACEHOLDER_KEY

export const supabase = createClient(supabaseUrl, supabaseKey)

export type ValueType = 'boolean' | 'numeric' | 'text'

export interface Firm {
  id: string
  name: string
  display_order: number
  created_at: string
}

export interface Quarter {
  id: string
  label: string
  year: number
  quarter_number: number
  is_current: boolean
  created_at: string
}

export interface CapabilityCategory {
  id: string
  name: string
  display_order: number
}

export interface CapabilitySubcategory {
  id: string
  category_id: string
  name: string
  display_order: number
}

export interface CapabilityFeature {
  id: string
  subcategory_id: string
  parent_feature_id: string | null
  name: string
  value_type: ValueType
  unit_label: string | null
  display_order: number
  is_active: boolean
}

export interface CapabilityValue {
  id: string
  feature_id: string
  firm_id: string
  quarter_id: string
  raw_text: string | null
  is_present: boolean | null
  is_not_applicable: boolean
  numeric_value: number | null
  detail: string | null
  updated_at: string
  updated_by: string | null
}

export interface ProductCategory {
  id: string
  name: string
  display_order: number
}

export interface Product {
  id: string
  firm_id: string
  category_id: string
  name: string
  display_order: number
  is_active: boolean
}

export interface ProductSubcategory {
  id: string
  category_id: string
  name: string
  display_order: number
}

export interface ProductFeature {
  id: string
  subcategory_id: string
  parent_feature_id: string | null
  name: string
  value_type: ValueType
  unit_label: string | null
  display_order: number
  is_active: boolean
}

export interface ProductValue {
  id: string
  feature_id: string
  product_id: string
  quarter_id: string
  raw_text: string | null
  is_present: boolean | null
  is_not_applicable: boolean
  numeric_value: number | null
  detail: string | null
  updated_at: string
  updated_by: string | null
}
