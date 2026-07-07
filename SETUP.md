# Matrix Dashboard — Setup Guide

A password-protected web app that replaces the quarterly Bank Capabilities Matrix and
Bank Product Matrix Excel files with a real database, browsable pivot-table reports,
and web-based data-entry screens. Built for Corporate Insight.

---

## What You'll Need

- A free [Supabase](https://supabase.com) account (database)
- A free [Vercel](https://vercel.com) account (hosting)
- A free [GitHub](https://github.com) account (code deployment)
- Python 3.10+ with `pip` (only needed once, to run the one-time Excel import)

---

## Step 1: Set Up Supabase (Database)

1. Go to [supabase.com](https://supabase.com) → **New project**
2. Name it `matrix-dashboard`, choose a region, set a database password
3. Once created, go to **SQL Editor** in the left sidebar
4. Paste the contents of `supabase-schema.sql` and click **Run**
5. Go to **Settings → API** and copy:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **anon public** key (long JWT string)
6. Go to **Settings → Database → Connection string → URI** and copy that too
   (you'll need it once, for the import script — it's different from the anon key)

---

## Step 2: Import the Q1 2026 Excel Data

This is a one-time migration. After this, all data entry happens in the web app —
nobody needs to touch the Excel files again.

```bash
cd "matrix dashboard"
pip install openpyxl psycopg2-binary

# Dry run first — parses both files and prints a validation report, writes nothing.
python scripts/import_matrices.py

# Review the report: subcategory/feature counts per sheet, any discarded artifact
# rows, and the product header -> (firm, product) mapping. Cross-check a couple of
# sheets against the open Excel files if you want extra confidence.

# Once you're satisfied, load it into Supabase:
export DATABASE_URL="postgresql://postgres:[password]@[host]:5432/postgres"   # from Step 1.6
python scripts/import_matrices.py --load
```

The load is safe to re-run — it upserts by name/key, so fixing something and
re-running won't create duplicates.

---

## Step 3: Push to GitHub

```bash
cd "matrix dashboard"
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/matrix-dashboard.git
git push -u origin main
```

---

## Step 4: Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import your `matrix-dashboard` GitHub repository
3. Under **Environment Variables**, add:

| Variable | Value |
|----------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `APP_PASSWORD` | A password you choose to protect the app |
| `ANTHROPIC_API_KEY` | From [console.anthropic.com](https://console.anthropic.com) — powers the "Ask a question" feature on the dashboard |

4. Confirm **Framework Preset** says **Next.js** (Vercel usually detects this automatically, but if it ever shows "Other," switch it manually — Next.js apps deployed under the wrong preset fail with a "No Output Directory" error).
5. Click **Deploy**.
6. Check **Project Settings → Deployment Protection** and make sure "Vercel Authentication" isn't blocking Production — this app already has its own password gate (`APP_PASSWORD`), so a second Vercel-level login wall in front of it would stop anyone without a Vercel account on this team from reaching the app at all.

---

## Using the App

- **Home page**: pick Capabilities or Product Matrix, browse by category. Quarter
  selector defaults to whichever quarter is marked "current."
- **Report view** (each category): read-only pivot table — features as rows, firms
  or products as columns, adoption % per row, filter box, CSV export.
- **Edit view** (pencil icon on a report page): the same layout but every cell is
  editable. Changes save automatically when you click out of a cell (a small
  checkmark confirms the save).
- **Manage** (top right of home page): add/rename/reorder firms, create new
  quarters and mark one "current," and edit the category/subcategory/feature
  definitions themselves (including adding brand-new features going forward).
- **Dashboard** (top right of home page): coverage/adoption charts, and an
  "Ask a question" box that answers plain-language questions about the data
  (e.g. "which firms don't offer live chat?") by looking up real values —
  requires `ANTHROPIC_API_KEY` to be set.

To start a new quarter: **Manage → Quarters → Add Quarter**. It automatically
copies every value forward from the current quarter (tagged "Carried over" so
you can tell what's unreviewed) — edit only what actually changed, then mark
the new quarter current when it's ready.

---

## Known Data Quality Note From the Import

The Product Matrix's own "Summary" sheet undercounts/overcounts Citizens Bank's
savings & money market products relative to the actual per-product sheet (it says
6, the sheet only lists 4). This is a pre-existing inconsistency in the source
Excel file, not an import bug — worth a quick check against whichever is authoritative.
