"""
Loads the parsed sheet data (from import_matrices.py) into Supabase via its
REST API (PostgREST), rather than a direct Postgres connection.

Why REST instead of psycopg2: new Supabase projects don't always publish a
directly-resolvable "db.<ref>.supabase.co" host (ours doesn't), and the
pooler hostname/region isn't always easy to find in the dashboard. The REST
API only needs the same HTTPS URL + anon key the Next.js app already uses,
which we already confirmed is reachable. RLS policies are "allow all", so
the anon/publishable key has full read/write access -- fine for this
single-tenant internal tool.

Requires env vars:
  SUPABASE_URL  (e.g. https://xxxx.supabase.co)
  SUPABASE_KEY  (the anon/publishable key)

Idempotent: safe to re-run. Categories/subcategories/features/firms/quarters
are upserted by their unique keys; values are upserted by (feature, entity,
quarter), so re-running after fixing a mapping just overwrites prior rows.
"""

import json
import os
import urllib.error
import urllib.request
from urllib.parse import urlencode

from import_matrices import FIRM_NAMES

BATCH_SIZE = 500


def get_config():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise SystemExit("Set SUPABASE_URL and SUPABASE_KEY env vars (same values as .env.local).")
    return url.rstrip("/"), key


class RestClient:
    def __init__(self, base_url, api_key):
        self.base_url = f"{base_url}/rest/v1"
        self.api_key = api_key

    def request(self, method, table, params=None, json_body=None, prefer=None):
        url = f"{self.base_url}/{table}"
        if params:
            url += "?" + urlencode(params)
        headers = {
            "apikey": self.api_key,
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        if prefer:
            headers["Prefer"] = prefer
        data = json.dumps(json_body).encode() if json_body is not None else None
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req) as resp:
                body = resp.read()
                return json.loads(body) if body else None
        except urllib.error.HTTPError as e:
            err_body = e.read().decode()
            raise RuntimeError(f"{method} {table} -> HTTP {e.code}: {err_body}")

    def upsert_one(self, table, row, on_conflict):
        result = self.request(
            "POST", table,
            params={"on_conflict": on_conflict, "select": "id"},
            json_body=row,
            prefer="resolution=merge-duplicates,return=representation",
        )
        return result[0]["id"]

    def upsert_many(self, table, rows, on_conflict):
        for i in range(0, len(rows), BATCH_SIZE):
            batch = rows[i:i + BATCH_SIZE]
            self.request(
                "POST", table,
                params={"on_conflict": on_conflict},
                json_body=batch,
                prefer="resolution=merge-duplicates",
            )

    def upsert_feature(self, table, subcategory_id, parent_feature_id, name, value_type, display_order):
        """
        capability_features/product_features can't use PostgREST's on_conflict
        upsert for their natural key: (subcategory_id, parent_feature_id, name)
        is a plain UNIQUE constraint, but SQL's NULL-distinctness means it never
        actually flags a conflict for root-level features (parent_feature_id
        IS NULL) -- so the insert proceeds and then fails against the *separate*
        partial index (capability_features_root_unique) that exists specifically
        to catch that case, which on_conflict wasn't told to target. PostgREST's
        on_conflict has no way to target a partial index's predicate. Sidestep
        the whole issue with a manual select-then-insert-or-update instead.
        """
        params = {
            "subcategory_id": f"eq.{subcategory_id}",
            "name": f"eq.{name}",
            "select": "id",
            "limit": "1",
        }
        params["parent_feature_id"] = "is.null" if parent_feature_id is None else f"eq.{parent_feature_id}"
        existing = self.request("GET", table, params=params)
        if existing:
            feature_id = existing[0]["id"]
            self.request(
                "PATCH", table,
                params={"id": f"eq.{feature_id}"},
                json_body={"value_type": value_type, "display_order": display_order},
            )
            return feature_id
        result = self.request(
            "POST", table,
            params={"select": "id"},
            json_body={
                "subcategory_id": subcategory_id,
                "parent_feature_id": parent_feature_id,
                "name": name,
                "value_type": value_type,
                "display_order": display_order,
            },
            prefer="return=representation",
        )
        return result[0]["id"]


def upsert_quarter(client, quarter_label, quarter_year, quarter_number, is_current):
    # NOTE: does not clear is_current on other quarters even when is_current=True --
    # the caller (import_matrices.py) is responsible for that, since it's the one
    # that knows whether "make this current" was actually requested.
    return client.upsert_one(
        "quarters",
        {"label": quarter_label, "year": quarter_year, "quarter_number": quarter_number, "is_current": is_current},
        on_conflict="label",
    )


def upsert_firms(client):
    firm_ids = {}
    for i, name in enumerate(FIRM_NAMES):
        firm_ids[name] = client.upsert_one("firms", {"name": name, "display_order": i}, on_conflict="name")
    return firm_ids


def load_capability_sheet(client, parsed, category_order, quarter_id, firm_ids):
    category_id = client.upsert_one(
        "capability_categories",
        {"name": parsed.category_name, "display_order": category_order},
        on_conflict="name",
    )

    subcat_ids = {}
    for i, name in enumerate(parsed.subcategories):
        subcat_ids[name] = client.upsert_one(
            "capability_subcategories",
            {"category_id": category_id, "name": name, "display_order": i},
            on_conflict="category_id,name",
        )

    value_rows = []
    for order, feature in enumerate(parsed.features):
        parent_id = feature.parent.db_id if feature.parent else None
        feature.db_id = client.upsert_feature(
            "capability_features", subcat_ids[feature.subcategory_name], parent_id,
            feature.name, feature.value_type, order,
        )

        for firm_name, pv in feature.values.items():
            if firm_name is None or firm_name not in firm_ids:
                continue
            value_rows.append({
                "feature_id": feature.db_id,
                "firm_id": firm_ids[firm_name],
                "quarter_id": quarter_id,
                "raw_text": pv["raw_text"],
                "is_present": pv["is_present"],
                "is_not_applicable": pv["is_not_applicable"],
                "numeric_value": pv["numeric_value"],
                "detail": pv["detail"],
            })

    client.upsert_many("capability_values", value_rows, on_conflict="feature_id,firm_id,quarter_id")
    return len(value_rows)


def load_product_sheet(client, parsed, category_order, quarter_id, firm_ids):
    category_id = client.upsert_one(
        "product_categories",
        {"name": parsed.category_name, "display_order": category_order},
        on_conflict="name",
    )

    subcat_ids = {}
    for i, name in enumerate(parsed.subcategories):
        subcat_ids[name] = client.upsert_one(
            "product_subcategories",
            {"category_id": category_id, "name": name, "display_order": i},
            on_conflict="category_id,name",
        )

    product_ids = {}
    for order, (firm_name, product_name) in enumerate(parsed.column_keys):
        if (firm_name, product_name) in product_ids:
            continue
        product_ids[(firm_name, product_name)] = client.upsert_one(
            "products",
            {
                "firm_id": firm_ids[firm_name],
                "category_id": category_id,
                "name": product_name,
                "display_order": order,
            },
            on_conflict="firm_id,category_id,name",
        )

    value_rows = []
    for order, feature in enumerate(parsed.features):
        parent_id = feature.parent.db_id if feature.parent else None
        feature.db_id = client.upsert_feature(
            "product_features", subcat_ids[feature.subcategory_name], parent_id,
            feature.name, feature.value_type, order,
        )

        for key, pv in feature.values.items():
            product_id = product_ids.get(key)
            if product_id is None:
                continue
            value_rows.append({
                "feature_id": feature.db_id,
                "product_id": product_id,
                "quarter_id": quarter_id,
                "raw_text": pv["raw_text"],
                "is_present": pv["is_present"],
                "is_not_applicable": pv["is_not_applicable"],
                "numeric_value": pv["numeric_value"],
                "detail": pv["detail"],
            })

    client.upsert_many("product_values", value_rows, on_conflict="feature_id,product_id,quarter_id")
    return len(value_rows)


def load_all(cap_parsed, prod_parsed, quarter_label, quarter_year, quarter_number, is_current=False):
    base_url, api_key = get_config()
    client = RestClient(base_url, api_key)

    if is_current:
        # Only one quarter should be "current" -- unset the others first so the
        # newly-loaded quarter (often a backfilled historical one) doesn't
        # accidentally leave two quarters marked current.
        client.request("PATCH", "quarters", params={"is_current": "eq.true"}, json_body={"is_current": False})

    quarter_id = upsert_quarter(client, quarter_label, quarter_year, quarter_number, is_current)
    firm_ids = upsert_firms(client)
    print(f"  quarter + {len(firm_ids)} firms upserted")

    total_values = 0
    for i, parsed in enumerate(cap_parsed):
        n = load_capability_sheet(client, parsed, i, quarter_id, firm_ids)
        total_values += n
        print(f"  loaded {parsed.category_name}: {n} values")

    for i, parsed in enumerate(prod_parsed):
        n = load_product_sheet(client, parsed, i, quarter_id, firm_ids)
        total_values += n
        print(f"  loaded {parsed.category_name}: {n} values")

    print(f"\nDone. {total_values} total values loaded for {quarter_label}.")
