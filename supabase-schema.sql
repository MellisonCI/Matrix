-- Matrix Dashboard schema
-- Apply this once via the Supabase SQL Editor on a fresh project.

-- ============================================================
-- SHARED
-- ============================================================

CREATE TABLE firms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE quarters (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  label TEXT NOT NULL UNIQUE,          -- e.g. 'Q1 2026'
  year INTEGER NOT NULL,
  quarter_number SMALLINT NOT NULL CHECK (quarter_number BETWEEN 1 AND 4),
  is_current BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (year, quarter_number)
);

CREATE TYPE value_type_enum AS ENUM ('boolean', 'numeric', 'text');

-- ============================================================
-- CAPABILITIES FAMILY (per firm)
-- ============================================================

CREATE TABLE capability_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,            -- 'Public Site', 'Authentication and Security', ...
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE capability_subcategories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES capability_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                   -- 'Online Funds Transfers'
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (category_id, name)
);

CREATE TABLE capability_features (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subcategory_id UUID NOT NULL REFERENCES capability_subcategories(id) ON DELETE CASCADE,
  parent_feature_id UUID REFERENCES capability_features(id) ON DELETE CASCADE,
                                          -- NULL = depth 0 (indent 0 in source);
                                          -- set = nested under another feature (indent 1/2)
  name TEXT NOT NULL,
  value_type value_type_enum NOT NULL DEFAULT 'boolean',
  unit_label TEXT,                       -- e.g. 'months', '$', for numeric display
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,  -- soft-retire a feature without deleting history
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (subcategory_id, parent_feature_id, name)
);
-- Postgres treats NULL parent_feature_id as distinct per row in the UNIQUE constraint
-- above, so depth-0 duplicates would slip through -- enforce those separately:
CREATE UNIQUE INDEX capability_features_root_unique
  ON capability_features (subcategory_id, name)
  WHERE parent_feature_id IS NULL;

CREATE TABLE capability_values (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_id UUID NOT NULL REFERENCES capability_features(id) ON DELETE CASCADE,
  firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  quarter_id UUID NOT NULL REFERENCES quarters(id) ON DELETE CASCADE,
  raw_text TEXT,                 -- verbatim cell text as entered/imported, incl. detail notes
  is_present BOOLEAN,            -- true = present, false = explicitly absent, NULL = no data
  is_not_applicable BOOLEAN NOT NULL DEFAULT false,
  numeric_value NUMERIC,         -- parsed number for numeric-type features (dollars, months, etc.)
  detail TEXT,                   -- free-text qualifier, e.g. 'Spanish', 'CSV, QFX', 'minimum $100'
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,               -- researcher's name/email, free text (no auth table to FK to)
  UNIQUE (feature_id, firm_id, quarter_id)
);

CREATE INDEX idx_capability_values_pivot
  ON capability_values (quarter_id, feature_id, firm_id);
CREATE INDEX idx_capability_values_firm_quarter
  ON capability_values (firm_id, quarter_id);
CREATE INDEX idx_capability_features_subcategory
  ON capability_features (subcategory_id, parent_feature_id);

-- ============================================================
-- PRODUCTS FAMILY (per product; product belongs to firm)
-- ============================================================

CREATE TABLE product_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,     -- 'Checking Accounts', 'Savings & Money Market Accounts', 'Certificates of Deposit'
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  firm_id UUID NOT NULL REFERENCES firms(id) ON DELETE CASCADE,
  category_id UUID NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,            -- 'Spending Account', 'Rewards Checking', 'Citigold'
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,  -- product discontinued but keep historical values
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (firm_id, category_id, name)
);

CREATE TABLE product_subcategories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE,
  name TEXT NOT NULL,            -- 'General Account Features', 'Other Account Fees'
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (category_id, name)
);

CREATE TABLE product_features (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subcategory_id UUID NOT NULL REFERENCES product_subcategories(id) ON DELETE CASCADE,
  parent_feature_id UUID REFERENCES product_features(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  value_type value_type_enum NOT NULL DEFAULT 'boolean',
  unit_label TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (subcategory_id, parent_feature_id, name)
);
CREATE UNIQUE INDEX product_features_root_unique
  ON product_features (subcategory_id, name)
  WHERE parent_feature_id IS NULL;

CREATE TABLE product_values (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_id UUID NOT NULL REFERENCES product_features(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quarter_id UUID NOT NULL REFERENCES quarters(id) ON DELETE CASCADE,
  raw_text TEXT,
  is_present BOOLEAN,
  is_not_applicable BOOLEAN NOT NULL DEFAULT false,
  numeric_value NUMERIC,
  detail TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by TEXT,
  UNIQUE (feature_id, product_id, quarter_id)
);

CREATE INDEX idx_product_values_pivot
  ON product_values (quarter_id, feature_id, product_id);
CREATE INDEX idx_product_values_product_quarter
  ON product_values (product_id, quarter_id);
CREATE INDEX idx_products_firm_category
  ON products (firm_id, category_id);
CREATE INDEX idx_product_features_subcategory
  ON product_features (subcategory_id, parent_feature_id);

-- ============================================================
-- RLS (mirrors pe-tracker: permissive "allow all", single shared password gate at app layer)
-- ============================================================

ALTER TABLE firms ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarters ENABLE ROW LEVEL SECURITY;
ALTER TABLE capability_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE capability_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE capability_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE capability_values ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all" ON firms FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON quarters FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON capability_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON capability_subcategories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON capability_features FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON capability_values FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON product_categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON product_subcategories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON product_features FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all" ON product_values FOR ALL USING (true) WITH CHECK (true);
