"""
One-off repair: the Q4 2025 Transaction History sheet titled a subcategory
"Table Headers Include:" (trailing colon) where Q1/Q2 2026 used "Table Headers
Include" (no colon). Subcategories are matched by exact name, so this created
a second, parallel subcategory with its own 30 duplicate features holding only
the Q4 2025 values, instead of merging into the existing ones.

This script: matches each duplicate feature to its canonical counterpart by
(name, parent's name) -- not by list position, since two features can share a
name under different parents -- moves that feature's capability_values rows
to point at the canonical feature_id, then deletes the now-empty duplicate
feature and subcategory rows.

Usage: SUPABASE_URL=... SUPABASE_KEY=... python scripts/fix_duplicate_subcategory.py
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from load_into_supabase import RestClient, get_config

CATEGORY_NAME = "Transaction History"
CANONICAL_NAME = "Table Headers Include"
DUPLICATE_NAME = "Table Headers Include:"


def main():
    base_url, api_key = get_config()
    client = RestClient(base_url, api_key)

    canon_sub = client.request("GET", "capability_subcategories", params={"name": f"eq.{CANONICAL_NAME}", "select": "id"})
    dup_sub = client.request("GET", "capability_subcategories", params={"name": f"eq.{DUPLICATE_NAME}", "select": "id"})
    if not canon_sub or not dup_sub:
        print("Nothing to fix -- one of the subcategories doesn't exist.")
        return
    canon_sub_id = canon_sub[0]["id"]
    dup_sub_id = dup_sub[0]["id"]
    print(f"Canonical subcategory: {canon_sub_id}")
    print(f"Duplicate subcategory: {dup_sub_id}")

    canon_feats = client.request("GET", "capability_features", params={"subcategory_id": f"eq.{canon_sub_id}", "select": "id,name,parent_feature_id"})
    dup_feats = client.request("GET", "capability_features", params={"subcategory_id": f"eq.{dup_sub_id}", "select": "id,name,parent_feature_id"})
    print(f"Canonical features: {len(canon_feats)}, duplicate features: {len(dup_feats)}")

    canon_by_id = {f["id"]: f for f in canon_feats}
    dup_by_id = {f["id"]: f for f in dup_feats}

    def parent_name(feat, by_id):
        pid = feat["parent_feature_id"]
        return by_id[pid]["name"] if pid else None

    # canonical (name, parent_name) -> canonical id
    canon_key_to_id = {(f["name"], parent_name(f, canon_by_id)): f["id"] for f in canon_feats}

    moved_values = 0
    unmatched = []
    id_map = {}  # dup feature id -> canonical feature id
    for f in dup_feats:
        key = (f["name"], parent_name(f, dup_by_id))
        canon_id = canon_key_to_id.get(key)
        if canon_id is None:
            unmatched.append(f)
            continue
        id_map[f["id"]] = canon_id

    if unmatched:
        print(f"\n{len(unmatched)} duplicate feature(s) had no canonical match (will be re-parented to the canonical subcategory, not merged):")
        for f in unmatched:
            print(f"  {f['name']!r} (parent={parent_name(f, dup_by_id)!r})")

    for dup_id, canon_id in id_map.items():
        values = client.request("GET", "capability_values", params={"feature_id": f"eq.{dup_id}", "select": "id"})
        for v in values:
            client.request("PATCH", "capability_values", params={"id": f"eq.{v['id']}"}, json_body={"feature_id": canon_id})
            moved_values += 1
        client.request("DELETE", "capability_features", params={"id": f"eq.{dup_id}"})

    for f in unmatched:
        client.request("PATCH", "capability_features", params={"id": f"eq.{f['id']}"}, json_body={"subcategory_id": canon_sub_id})

    remaining = client.request("GET", "capability_features", params={"subcategory_id": f"eq.{dup_sub_id}", "select": "id"})
    if not remaining:
        client.request("DELETE", "capability_subcategories", params={"id": f"eq.{dup_sub_id}"})
        print(f"\nDeleted now-empty duplicate subcategory {dup_sub_id}.")
    else:
        print(f"\n{len(remaining)} feature(s) still reference the duplicate subcategory -- left it in place.")

    print(f"Moved {moved_values} values onto canonical features. Merged {len(id_map)} duplicate features.")


if __name__ == "__main__":
    main()
