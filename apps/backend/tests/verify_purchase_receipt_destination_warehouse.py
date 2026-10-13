import httpx
from sqlalchemy import text
from app.core.config import settings
from app.db.database import SessionLocal

BASE_URL = "http://localhost:8000"

def run_verification():
    print("==================================================================")
    print("STARTING COMPLETE PURCHASE RECEIPT -> DESTINATION WAREHOUSE TEST")
    print("==================================================================")
    client = httpx.Client(base_url=BASE_URL, timeout=30.0)

    # 1. Login as ADMIN
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": settings.ADMIN_EMAIL, "password": settings.ADMIN_PASSWORD},
    )
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    client.headers.update({"Authorization": f"Bearer {token}"})
    print("[OK] 1. Logged in successfully as Admin.")

    # 2. Create Two Distinct Warehouses (Warehouse A and Warehouse B) + One Inactive Warehouse
    wh_a_res = client.post(
        "/api/v1/warehouses",
        json={
            "code": "WH-E2E-CASA",
            "name": "Dépôt Principal Casablanca E2E",
            "type": "MAIN",
            "is_active": True,
        },
    )
    if wh_a_res.status_code == 201:
        wh_a = wh_a_res.json()
    else:
        whs = client.get("/api/v1/warehouses").json()
        wh_a = next(w for w in whs if w["code"] == "WH-E2E-CASA")
    print(f"[OK] 2a. Warehouse A ready: ID={wh_a['id']} ({wh_a['code']} - {wh_a['name']})")

    wh_b_res = client.post(
        "/api/v1/warehouses",
        json={
            "code": "WH-E2E-TANGER",
            "name": "Dépôt Secondaire Tanger E2E",
            "type": "WAREHOUSE",
            "is_active": True,
        },
    )
    if wh_b_res.status_code == 201:
        wh_b = wh_b_res.json()
    else:
        whs = client.get("/api/v1/warehouses").json()
        wh_b = next(w for w in whs if w["code"] == "WH-E2E-TANGER")
    print(f"[OK] 2b. Warehouse B ready: ID={wh_b['id']} ({wh_b['code']} - {wh_b['name']})")

    wh_inact_res = client.post(
        "/api/v1/warehouses",
        json={
            "code": "WH-E2E-INACTIF",
            "name": "Dépôt Inactif E2E",
            "type": "WAREHOUSE",
            "is_active": False,
        },
    )
    if wh_inact_res.status_code == 201:
        wh_inact = wh_inact_res.json()
    else:
        whs = client.get("/api/v1/warehouses").json()
        wh_inact = next(w for w in whs if w["code"] == "WH-E2E-INACTIF")
    print(f"[OK] 2c. Inactive Warehouse ready: ID={wh_inact['id']} ({wh_inact['code']})")

    # 3. Create Supplier and Products (1 Tracked Product + 1 Non-Stock Product)
    supp_res = client.post(
        "/api/v1/partners",
        json={
            "code": "FRS-E2E-WH",
            "legal_name": "Fournisseur Pesage E2E Maroc",
            "partner_type": "SUPPLIER",
            "is_active": True,
        },
    )
    if supp_res.status_code == 201:
        supplier = supp_res.json()
    else:
        supps = client.get("/api/v1/suppliers").json()
        supplier = next(s for s in supps if s["code"] == "FRS-E2E-WH")
    print(f"[OK] 3a. Supplier ready: ID={supplier['id']} ({supplier['legal_name']})")

    import time
    ts = int(time.time())
    cat = client.post("/api/v1/categories", json={"name": f"Capteurs E2E {ts}", "code": f"CAP-{ts}"}).json()
    pt = client.post("/api/v1/product-types", json={"name": f"Électronique E2E {ts}", "code": f"ELEC-{ts}"}).json()
    u = client.post("/api/v1/units", json={"name": f"Unité {ts}", "abbreviation": f"U{ts % 1000}"}).json()

    p_tracked = client.post(
        "/api/v1/products",
        json={
            "sku": f"PROD-TRK-{ts}",
            "designation": "Module Indicateur Numérique Haute Précision",
            "category_id": cat["id"],
            "product_type_id": pt["id"],
            "unit_id": u["id"],
            "purchase_price": 2500.0,
            "sale_price": 4000.0,
            "tax_rate": 20.0,
            "track_stock": True,
        },
    ).json()

    p_nonstock = client.post(
        "/api/v1/products",
        json={
            "sku": f"SRV-CALIB-{ts}",
            "designation": "Prestation Étalonnage et Certificat ONSSA",
            "category_id": cat["id"],
            "product_type_id": pt["id"],
            "unit_id": u["id"],
            "purchase_price": 750.0,
            "sale_price": 1500.0,
            "tax_rate": 20.0,
            "track_stock": False,
        },
    ).json()
    print(f"[OK] 3b. Products ready: Tracked '{p_tracked['sku']}' (ID={p_tracked['id']}) & Non-Stock '{p_nonstock['sku']}' (ID={p_nonstock['id']})")

    # 4. Create Purchase Order with 10 Tracked Products + 3 Non-Stock Services
    po_res = client.post(
        "/api/v1/purchases",
        json={
            "reference": f"PO-E2E-WH-{ts}",
            "supplier_id": supplier["id"],
            "order_date": "2026-09-16T12:00:00Z",
            "items": [
                {"product_id": p_tracked["id"], "quantity_ordered": 10.0, "unit_price_ht": 2500.0, "tax_rate": 20.0},
                {"product_id": p_nonstock["id"], "quantity_ordered": 3.0, "unit_price_ht": 750.0, "tax_rate": 20.0},
            ],
        },
    )
    assert po_res.status_code == 201, f"Failed creating PO: {po_res.text}"
    po = po_res.json()
    po_id = po["id"]
    item_tracked_id = next(it["id"] for it in po["items"] if it["product_id"] == p_tracked["id"])
    item_nonstock_id = next(it["id"] for it in po["items"] if it["product_id"] == p_nonstock["id"])
    print(f"[OK] 4. Purchase Order created: {po['reference']} (ID={po_id}, Total TTC={po['total_ttc']} DH)")

    # 5. Approve Order
    app_res = client.post(f"/api/v1/purchases/{po_id}/approve")
    assert app_res.status_code == 200
    print(f"[OK] 5. Purchase Order {po['reference']} approved.")

    # 6. Test Validations:
    # 6a. Missing warehouse -> 400 with French error
    r_no_wh = client.post(
        "/api/v1/purchase-receipts",
        json={
            "purchase_order_id": po_id,
            "items": [{"purchase_order_item_id": item_tracked_id, "product_id": p_tracked["id"], "quantity_received": 5}],
        },
    )
    assert r_no_wh.status_code == 400
    print(f"[OK] 6a. Missing warehouse properly rejected (HTTP 400): '{r_no_wh.json()['error']['message']}'")

    # 6b. Inactive warehouse -> 400 with French error
    r_inact_wh = client.post(
        "/api/v1/purchase-receipts",
        json={
            "purchase_order_id": po_id,
            "warehouse_id": wh_inact["id"],
            "items": [{"purchase_order_item_id": item_tracked_id, "product_id": p_tracked["id"], "quantity_received": 5}],
        },
    )
    assert r_inact_wh.status_code == 400
    print(f"[OK] 6b. Inactive warehouse properly rejected (HTTP 400): '{r_inact_wh.json()['error']['message']}'")

    # 7. Execute Partial Receipt 1 into Destination Warehouse A (Casablanca)
    # Receive 6 Tracked units + 2 Non-Stock units
    r_rec1 = client.post(
        "/api/v1/purchase-receipts",
        json={
            "reference": f"BL-CASA-REC-{ts}",
            "purchase_order_id": po_id,
            "warehouse_id": wh_a["id"],
            "notes": "1ère réception partielle dans le dépôt Casablanca",
            "items": [
                {"purchase_order_item_id": item_tracked_id, "product_id": p_tracked["id"], "quantity_received": 6.0},
                {"purchase_order_item_id": item_nonstock_id, "product_id": p_nonstock["id"], "quantity_received": 2.0},
            ],
        },
    )
    assert r_rec1.status_code == 201, f"Failed receipt 1: {r_rec1.text}"
    rec1 = r_rec1.json()
    assert rec1["warehouse_id"] == wh_a["id"]
    assert rec1["warehouse"]["code"] == wh_a["code"]
    print(f"[OK] 7. Receipt 1 recorded into {wh_a['code']} (ID={rec1['id']}, Ref={rec1['reference']})")

    # 8. Check Stock Balances & Isolation after Receipt 1
    stk_a = client.get(f"/api/v1/stock?search={p_tracked['sku']}&warehouse_id={wh_a['id']}").json()
    assert len(stk_a) == 1
    assert stk_a[0]["quantity"] == 6.0
    print(f"[OK] 8a. Stock in {wh_a['code']}: {stk_a[0]['quantity']} units (expected 6.0)")

    stk_b = client.get(f"/api/v1/stock?search={p_tracked['sku']}&warehouse_id={wh_b['id']}").json()
    assert len(stk_b) == 0
    print(f"[OK] 8b. Multi-Warehouse Isolation verified: Stock in {wh_b['code']} is empty (0 units).")

    stk_srv = client.get(f"/api/v1/stock?search={p_nonstock['sku']}").json()
    assert len(stk_srv) == 0
    print(f"[OK] 8c. Non-Stock product '{p_nonstock['sku']}' has no stock balance (track_stock=False verified).")

    # 9. Execute Final Receipt 2 into Destination Warehouse B (Tanger)
    # Receive remaining 4 Tracked units + 1 Non-Stock unit
    r_rec2 = client.post(
        "/api/v1/purchase-receipts",
        json={
            "reference": f"BL-TANGER-REC-{ts}",
            "purchase_order_id": po_id,
            "warehouse_id": wh_b["id"],
            "notes": "2ème réception finale dans le dépôt Tanger",
            "items": [
                {"purchase_order_item_id": item_tracked_id, "product_id": p_tracked["id"], "quantity_received": 4.0},
                {"purchase_order_item_id": item_nonstock_id, "product_id": p_nonstock["id"], "quantity_received": 1.0},
            ],
        },
    )
    assert r_rec2.status_code == 201, f"Failed receipt 2: {r_rec2.text}"
    rec2 = r_rec2.json()
    assert rec2["warehouse_id"] == wh_b["id"]
    assert rec2["warehouse"]["code"] == wh_b["code"]
    print(f"[OK] 9. Receipt 2 recorded into {wh_b['code']} (ID={rec2['id']}, Ref={rec2['reference']})")

    # 10. Verify Stock Balances across both warehouses
    stk_a_final = client.get(f"/api/v1/stock?search={p_tracked['sku']}&warehouse_id={wh_a['id']}").json()
    assert len(stk_a_final) == 1 and stk_a_final[0]["quantity"] == 6.0
    print(f"[OK] 10a. Final Stock in {wh_a['code']}: {stk_a_final[0]['quantity']} units (unchanged at 6.0).")

    stk_b_final = client.get(f"/api/v1/stock?search={p_tracked['sku']}&warehouse_id={wh_b['id']}").json()
    assert len(stk_b_final) == 1 and stk_b_final[0]["quantity"] == 4.0
    print(f"[OK] 10b. Final Stock in {wh_b['code']}: {stk_b_final[0]['quantity']} units (correctly updated to 4.0).")

    # 11. Verify Stock Movements logged for each warehouse
    moves_a = client.get(f"/api/v1/stock/movements?warehouse_id={wh_a['id']}&product_id={p_tracked['id']}").json()
    assert any(m["movement_type"] == "PURCHASE_RECEIPT" and m["quantity"] == 6.0 for m in moves_a)
    print(f"[OK] 11a. PURCHASE_RECEIPT movement in {wh_a['code']} verified (Qty=6.0).")

    moves_b = client.get(f"/api/v1/stock/movements?warehouse_id={wh_b['id']}&product_id={p_tracked['id']}").json()
    assert any(m["movement_type"] == "PURCHASE_RECEIPT" and m["quantity"] == 4.0 for m in moves_b)
    print(f"[OK] 11b. PURCHASE_RECEIPT movement in {wh_b['code']} verified (Qty=4.0).")

    # 12. Check PO Detail returns receipts with destination warehouses
    po_detail = client.get(f"/api/v1/purchases/{po_id}").json()
    assert po_detail["status"] == "RECEIVED"
    assert len(po_detail["receipts"]) == 2
    for r in po_detail["receipts"]:
        assert r["warehouse"] is not None
        assert "code" in r["warehouse"] and "name" in r["warehouse"]
        print(f"[OK] 12. PO Detail Receipt {r['reference']}: Dépôt = {r['warehouse']['code']} — {r['warehouse']['name']}")

    # 13. Direct PostgreSQL Database Verification
    print("\n------------------------------------------------------------------")
    print("13. DIRECT POSTGRESQL DATABASE VERIFICATION (SQL Engine)")
    print("------------------------------------------------------------------")
    db = SessionLocal()
    try:
        rows = db.execute(text("""
            SELECT id, reference, warehouse_id, status 
            FROM purchase_receipts 
            WHERE purchase_order_id = :po_id 
            ORDER BY id;
        """), {"po_id": po_id}).fetchall()
        print("purchase_receipts table records in PostgreSQL:")
        for row in rows:
            print(f"  -> ID={row[0]}, Reference={row[1]}, Warehouse_ID={row[2]}, Status={row[3]}")
            assert row[2] in [wh_a["id"], wh_b["id"]]

        bal_rows = db.execute(text("""
            SELECT product_id, warehouse_id, quantity, reserved_quantity 
            FROM stock_balances 
            WHERE product_id = :prod_id 
            ORDER BY warehouse_id;
        """), {"prod_id": p_tracked["id"]}).fetchall()
        print("\nstock_balances table records in PostgreSQL:")
        for b in bal_rows:
            print(f"  -> Product_ID={b[0]}, Warehouse_ID={b[1]}, Quantity={b[2]}, Reserved={b[3]}")

        mov_rows = db.execute(text("""
            SELECT id, product_id, warehouse_id, movement_type, quantity, reference_id 
            FROM stock_movements 
            WHERE product_id = :prod_id 
            ORDER BY id;
        """), {"prod_id": p_tracked["id"]}).fetchall()
        print("\nstock_movements table records in PostgreSQL:")
        for m in mov_rows:
            print(f"  -> ID={m[0]}, Product_ID={m[1]}, Warehouse_ID={m[2]}, Type={m[3]}, Quantity={m[4]}, Ref_ID={m[5]}")
    finally:
        db.close()

    print("\n==================================================================")
    print("ALL PURCHASE RECEIPT -> DESTINATION WAREHOUSE VERIFICATIONS PASSED!")
    print("==================================================================")

if __name__ == "__main__":
    run_verification()
