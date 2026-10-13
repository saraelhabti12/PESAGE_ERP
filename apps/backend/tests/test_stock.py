import pytest
from datetime import datetime
from fastapi.testclient import TestClient
from app.core.config import settings


def get_auth_header(client: TestClient, email: str = settings.ADMIN_EMAIL, password: str = settings.ADMIN_PASSWORD) -> dict:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_stock_prerequisites(client: TestClient, headers: dict):
    # 1. Create Catalog Prereqs
    cat = client.post("/api/v1/categories", json={"name": "Pèse-Personnes Industriels", "code": "PPI"}, headers=headers).json()
    pt = client.post("/api/v1/product-types", json={"name": "Matériel de Pesage", "code": "PES"}, headers=headers).json()
    u = client.post("/api/v1/units", json={"name": "Unité", "abbreviation": "U"}, headers=headers).json()

    # 2. Create Tracked Product
    prod_tracked = client.post(
        "/api/v1/products",
        json={
            "sku": "PROD-STK-001",
            "designation": "Balance Électronique 30kg Précision 1g",
            "category_id": cat["id"],
            "product_type_id": pt["id"],
            "unit_id": u["id"],
            "purchase_price": 1500.00,
            "sale_price": 2200.00,
            "tax_rate": 20.00,
            "is_active": True,
            "track_stock": True,
        },
        headers=headers,
    ).json()

    # 3. Create Non-Tracked Product (Sur commande / hors stock)
    prod_nontracked = client.post(
        "/api/v1/products",
        json={
            "sku": "PROD-NOSTK-002",
            "designation": "Prestation d'étalonnage et certification sur site",
            "category_id": cat["id"],
            "product_type_id": pt["id"],
            "unit_id": u["id"],
            "purchase_price": 500.00,
            "sale_price": 1200.00,
            "tax_rate": 20.00,
            "is_active": True,
            "track_stock": False,
        },
        headers=headers,
    ).json()

    # 4. Create Supplier for receipts
    supplier = client.post(
        "/api/v1/partners",
        json={
            "code": "FRS-STK-001",
            "legal_name": "Fournisseur Métrologie Maroc",
            "partner_type": "SUPPLIER",
            "is_active": True,
        },
        headers=headers,
    ).json()

    return prod_tracked, prod_nontracked, supplier


def test_warehouse_crud_and_validations(client: TestClient):
    headers = get_auth_header(client)

    # 1. Create warehouse
    res = client.post(
        "/api/v1/warehouses",
        json={
            "code": "DEPOT-CASA-01",
            "name": "Dépôt Central Casablanca",
            "type": "MAIN",
            "address": "Zone Industrielle Ain Sebaa, Casablanca",
            "description": "Entrepôt principal de stockage",
            "is_active": True,
        },
        headers=headers,
    )
    assert res.status_code == 201, f"Failed creating warehouse: {res.text}"
    wh1 = res.json()
    assert wh1["code"] == "DEPOT-CASA-01"
    assert wh1["type"] == "MAIN"

    # 2. Duplicate warehouse code rejected
    res_dup = client.post(
        "/api/v1/warehouses",
        json={
            "code": "DEPOT-CASA-01",
            "name": "Autre nom",
            "type": "WAREHOUSE",
        },
        headers=headers,
    )
    assert res_dup.status_code == 409

    # 3. Update warehouse
    res_up = client.put(
        f"/api/v1/warehouses/{wh1['id']}",
        json={"name": "Dépôt Principal Casa Ain Sebaa", "description": "Mis à jour"},
        headers=headers,
    )
    assert res_up.status_code == 200
    assert res_up.json()["name"] == "Dépôt Principal Casa Ain Sebaa"

    # 4. List warehouses
    res_list = client.get("/api/v1/warehouses", headers=headers)
    assert res_list.status_code == 200
    assert any(w["id"] == wh1["id"] for w in res_list.json())


def test_stock_adjustments_movements_and_negative_prevention(client: TestClient):
    headers = get_auth_header(client)
    prod_tracked, prod_nontracked, _ = create_stock_prerequisites(client, headers)

    # Create warehouse
    wh = client.post(
        "/api/v1/warehouses",
        json={"code": "WH-TEST-01", "name": "Magasin Test 01", "type": "WAREHOUSE"},
        headers=headers,
    ).json()

    # 1. Non-stock product adjustment rejected
    res_nostk = client.post(
        "/api/v1/stock/adjustments",
        json={
            "product_id": prod_nontracked["id"],
            "warehouse_id": wh["id"],
            "new_quantity": 50.0,
            "reason": "Tentative ajustement hors stock",
        },
        headers=headers,
    )
    assert res_nostk.status_code == 400
    assert "hors stock" in res_nostk.text

    # 2. Tracked product adjustment positive (0 -> 50)
    res_adj = client.post(
        "/api/v1/stock/adjustments",
        json={
            "product_id": prod_tracked["id"],
            "warehouse_id": wh["id"],
            "new_quantity": 50.0,
            "reason": "Stock initial inventaire physique",
        },
        headers=headers,
    )
    assert res_adj.status_code == 200
    bal = res_adj.json()
    assert bal["quantity"] == 50.0
    assert bal["available_quantity"] == 50.0
    assert bal["valuation"] == 50.0 * 1500.00

    # 3. Verify movement was created
    m_res = client.get(f"/api/v1/stock/movements?product_id={prod_tracked['id']}", headers=headers)
    assert m_res.status_code == 200
    moves = m_res.json()
    assert len(moves) >= 1
    assert moves[0]["movement_type"] == "ADJUSTMENT_IN"
    assert moves[0]["quantity"] == 50.0

    # 4. Adjustment downwards (50 -> 35)
    res_adj2 = client.post(
        "/api/v1/stock/adjustments",
        json={
            "product_id": prod_tracked["id"],
            "warehouse_id": wh["id"],
            "new_quantity": 35.0,
            "reason": "Correction suite à casse",
        },
        headers=headers,
    )
    assert res_adj2.status_code == 200
    assert res_adj2.json()["quantity"] == 35.0

    # Verify ADJUSTMENT_OUT movement
    m_res2 = client.get(f"/api/v1/stock/movements?product_id={prod_tracked['id']}", headers=headers)
    assert m_res2.json()[0]["movement_type"] == "ADJUSTMENT_OUT"
    assert m_res2.json()[0]["quantity"] == 15.0


def test_stock_transfers_workflow(client: TestClient):
    headers = get_auth_header(client)
    prod_tracked, _, _ = create_stock_prerequisites(client, headers)

    wh_src = client.post(
        "/api/v1/warehouses",
        json={"code": "WH-SRC-01", "name": "Dépôt Principal Source", "type": "MAIN"},
        headers=headers,
    ).json()

    wh_dst = client.post(
        "/api/v1/warehouses",
        json={"code": "WH-DST-02", "name": "Atelier Réparation Destination", "type": "WORKSHOP"},
        headers=headers,
    ).json()

    # Initial stock in source = 100
    client.post(
        "/api/v1/stock/adjustments",
        json={"product_id": prod_tracked["id"], "warehouse_id": wh_src["id"], "new_quantity": 100.0, "reason": "Init"},
        headers=headers,
    )

    # 1. Transfer 30 from source to destination
    transfer_res = client.post(
        "/api/v1/stock/transfers",
        json={
            "product_id": prod_tracked["id"],
            "source_warehouse_id": wh_src["id"],
            "dest_warehouse_id": wh_dst["id"],
            "quantity": 30.0,
            "reason": "Réapprovisionnement atelier",
        },
        headers=headers,
    )
    assert transfer_res.status_code == 200
    res_data = transfer_res.json()
    assert res_data["source_quantity"] == 70.0
    assert res_data["dest_quantity"] == 30.0

    # 2. Cannot transfer more than available
    fail_transfer = client.post(
        "/api/v1/stock/transfers",
        json={
            "product_id": prod_tracked["id"],
            "source_warehouse_id": wh_src["id"],
            "dest_warehouse_id": wh_dst["id"],
            "quantity": 90.0,
        },
        headers=headers,
    )
    assert fail_transfer.status_code == 400
    assert "insuffisant" in fail_transfer.text


def test_stock_reservations_and_release_workflow(client: TestClient):
    headers = get_auth_header(client)
    prod_tracked, _, _ = create_stock_prerequisites(client, headers)

    wh = client.post(
        "/api/v1/warehouses",
        json={"code": "WH-RES-01", "name": "Dépôt Réservations", "type": "MAIN"},
        headers=headers,
    ).json()

    # Initial stock = 20
    client.post(
        "/api/v1/stock/adjustments",
        json={"product_id": prod_tracked["id"], "warehouse_id": wh["id"], "new_quantity": 20.0, "reason": "Init"},
        headers=headers,
    )

    # 1. Reserve 8
    res_resv = client.post(
        "/api/v1/stock/reservations",
        json={
            "product_id": prod_tracked["id"],
            "warehouse_id": wh["id"],
            "quantity": 8.0,
            "reference_type": "QUOTE",
            "reference_id": 101,
        },
        headers=headers,
    )
    assert res_resv.status_code == 201
    resv = res_resv.json()
    assert resv["quantity"] == 8.0
    assert resv["status"] == "ACTIVE"

    # Verify available stock decreased (20 - 8 = 12)
    stock_list = client.get(f"/api/v1/stock?search={prod_tracked['sku']}&warehouse_id={wh['id']}", headers=headers).json()
    assert stock_list[0]["quantity"] == 20.0
    assert stock_list[0]["reserved_quantity"] == 8.0
    assert stock_list[0]["available_quantity"] == 12.0

    # 2. Cannot reserve more than available (15 > 12)
    fail_resv = client.post(
        "/api/v1/stock/reservations",
        json={"product_id": prod_tracked["id"], "warehouse_id": wh["id"], "quantity": 15.0},
        headers=headers,
    )
    assert fail_resv.status_code == 400

    # 3. Release reservation
    rel_res = client.post(f"/api/v1/stock/reservations/{resv['id']}/release", headers=headers)
    assert rel_res.status_code == 200
    assert rel_res.json()["status"] == "RELEASED"

    # Verify available stock restored to 20
    stock_list2 = client.get(f"/api/v1/stock?search={prod_tracked['sku']}&warehouse_id={wh['id']}", headers=headers).json()
    assert stock_list2[0]["quantity"] == 20.0
    assert stock_list2[0]["reserved_quantity"] == 0.0
    assert stock_list2[0]["available_quantity"] == 20.0


def test_purchase_receipt_stock_integration(client: TestClient):
    headers = get_auth_header(client)
    prod_tracked, prod_nontracked, supplier = create_stock_prerequisites(client, headers)

    wh = client.post(
        "/api/v1/warehouses",
        json={"code": "WH-REC-01", "name": "Dépôt Réception Marchandises", "type": "MAIN"},
        headers=headers,
    ).json()

    # 1. Create Purchase Order with 1 tracked and 1 non-tracked item
    po_res = client.post(
        "/api/v1/purchases",
        json={
            "supplier_id": supplier["id"],
            "order_date": "2026-08-30T10:00:00Z",
            "items": [
                {"product_id": prod_tracked["id"], "quantity_ordered": 10.0, "unit_price_ht": 1500.0, "tax_rate": 20.0},
                {"product_id": prod_nontracked["id"], "quantity_ordered": 2.0, "unit_price_ht": 500.0, "tax_rate": 20.0},
            ],
        },
        headers=headers,
    )
    assert po_res.status_code == 201
    po = po_res.json()

    # 2. Approve Purchase Order
    app_res = client.post(f"/api/v1/purchases/{po['id']}/approve", headers=headers)
    assert app_res.status_code == 200

    # 3. Create and confirm Purchase Receipt
    # Fetch full PO items
    po_detail = client.get(f"/api/v1/purchases/{po['id']}", headers=headers).json()
    tracked_po_item = next(it for it in po_detail["items"] if it["product_id"] == prod_tracked["id"])
    nontracked_po_item = next(it for it in po_detail["items"] if it["product_id"] == prod_nontracked["id"])

    rec_res = client.post(
        "/api/v1/purchase-receipts",
        json={
            "purchase_order_id": po["id"],
            "notes": "Réception conforme",
            "items": [
                {
                    "purchase_order_item_id": tracked_po_item["id"],
                    "product_id": prod_tracked["id"],
                    "warehouse_id": wh["id"],
                    "quantity_received": 10.0,
                },
                {
                    "purchase_order_item_id": nontracked_po_item["id"],
                    "product_id": prod_nontracked["id"],
                    "warehouse_id": wh["id"],
                    "quantity_received": 2.0,
                },
            ],
        },
        headers=headers,
    )
    assert rec_res.status_code == 201
    receipt = rec_res.json()

    # 4. Verify tracked product stock balance increased to 10
    stk_res = client.get(f"/api/v1/stock?search={prod_tracked['sku']}&warehouse_id={wh['id']}", headers=headers).json()
    assert len(stk_res) == 1
    assert stk_res[0]["quantity"] == 10.0
    assert stk_res[0]["available_quantity"] == 10.0

    # 5. Verify non-tracked product has NO stock balance
    stk_nostk = client.get(f"/api/v1/stock?search={prod_nontracked['sku']}", headers=headers).json()
    assert len(stk_nostk) == 0

    # 6. Verify PURCHASE_RECEIPT movement created
    moves = client.get(f"/api/v1/stock/movements?product_id={prod_tracked['id']}", headers=headers).json()
    assert any(m["movement_type"] == "PURCHASE_RECEIPT" and m["quantity"] == 10.0 for m in moves)


def test_inventory_session_counting_and_validation(client: TestClient):
    headers = get_auth_header(client)
    prod_tracked, _, _ = create_stock_prerequisites(client, headers)

    wh = client.post(
        "/api/v1/warehouses",
        json={"code": "WH-INV-01", "name": "Dépôt Inventaire Annuel", "type": "MAIN"},
        headers=headers,
    ).json()

    # Initial stock = 25
    client.post(
        "/api/v1/stock/adjustments",
        json={"product_id": prod_tracked["id"], "warehouse_id": wh["id"], "new_quantity": 25.0, "reason": "Init"},
        headers=headers,
    )

    # 1. Create inventory session
    inv_res = client.post(
        "/api/v1/inventory",
        json={"warehouse_id": wh["id"], "notes": "Inventaire semestriel"},
        headers=headers,
    )
    assert inv_res.status_code == 201
    inv = inv_res.json()
    assert inv["status"] == "DRAFT"
    assert len(inv["items"]) >= 1

    # 2. Start session
    start_res = client.post(f"/api/v1/inventory/{inv['id']}/start", headers=headers)
    assert start_res.status_code == 200
    assert start_res.json()["status"] == "IN_PROGRESS"

    # 3. Enter count (counted 22 instead of system 25 -> diff = -3)
    count_res = client.put(
        f"/api/v1/inventory/{inv['id']}/items/{prod_tracked['id']}",
        json={"product_id": prod_tracked["id"], "counted_quantity": 22.0, "reason": "Écart comptage physique"},
        headers=headers,
    )
    assert count_res.status_code == 200
    assert count_res.json()["counted_quantity"] == 22.0
    assert count_res.json()["difference"] == -3.0

    # 4. Validate inventory session
    val_res = client.post(f"/api/v1/inventory/{inv['id']}/validate", headers=headers)
    assert val_res.status_code == 200
    assert val_res.json()["status"] == "COMPLETED"

    # 5. Verify stock balance was automatically adjusted to 22.0
    stk = client.get(f"/api/v1/stock?search={prod_tracked['sku']}&warehouse_id={wh['id']}", headers=headers).json()
    assert stk[0]["quantity"] == 22.0

    # 6. Verify adjustment movement was recorded
    moves = client.get(f"/api/v1/stock/movements?product_id={prod_tracked['id']}", headers=headers).json()
    assert any(m["movement_type"] == "ADJUSTMENT_OUT" and m["quantity"] == 3.0 for m in moves)


def test_stock_thresholds_alerts_and_stats(client: TestClient):
    headers = get_auth_header(client)
    prod_tracked, _, _ = create_stock_prerequisites(client, headers)

    wh = client.post(
        "/api/v1/warehouses",
        json={"code": "WH-THR-01", "name": "Dépôt Alertes", "type": "MAIN"},
        headers=headers,
    ).json()

    # Initial stock = 5
    client.post(
        "/api/v1/stock/adjustments",
        json={"product_id": prod_tracked["id"], "warehouse_id": wh["id"], "new_quantity": 5.0, "reason": "Init"},
        headers=headers,
    )

    # Get balance
    bal = client.get(f"/api/v1/stock?search={prod_tracked['sku']}&warehouse_id={wh['id']}", headers=headers).json()[0]

    # Set minimum_quantity = 10, maximum_quantity = 50
    up_res = client.put(
        f"/api/v1/stock/{bal['id']}/thresholds",
        json={"minimum_quantity": 10.0, "maximum_quantity": 50.0},
        headers=headers,
    )
    assert up_res.status_code == 200
    assert up_res.json()["status"] == "LOW"  # 5 <= 10 -> LOW

    # Verify alerts endpoint includes this balance
    alerts = client.get("/api/v1/stock/alerts", headers=headers).json()
    assert any(a["id"] == bal["id"] for a in alerts)

    # Verify dashboard stock stats
    stats = client.get("/api/v1/stock/stats", headers=headers).json()
    assert stats["total_stock_value"] >= 5.0 * 1500.00
    assert stats["low_stock_count"] >= 1


def test_cross_product_stock_isolation_and_transfer_validation(client: TestClient):
    """Regression test ensuring exact (product, warehouse) stock resolution with zero cross-product contamination."""
    headers = get_auth_header(client)

    # 1. Create Catalog Prereqs
    cat = client.post("/api/v1/categories", json={"name": "Électronique Pesage", "code": "ELEC"}, headers=headers).json()
    pt = client.post("/api/v1/product-types", json={"name": "Composants Électroniques", "code": "CMP"}, headers=headers).json()
    u = client.post("/api/v1/units", json={"name": "Kilogramme", "abbreviation": "kg"}, headers=headers).json()

    # Create Product A and Product B
    prod_a = client.post(
        "/api/v1/products",
        json={
            "sku": "PROD-A-01",
            "designation": "Afficheur Numérique Industriel",
            "category_id": cat["id"],
            "product_type_id": pt["id"],
            "unit_id": u["id"],
            "purchase_price": 450.00,
            "sale_price": 750.00,
            "is_active": True,
            "track_stock": True,
        },
        headers=headers,
    ).json()

    prod_b = client.post(
        "/api/v1/products",
        json={
            "sku": "PROD-B-02",
            "designation": "Carte Mère Mémoire Électronique",
            "category_id": cat["id"],
            "product_type_id": pt["id"],
            "unit_id": u["id"],
            "purchase_price": 900.00,
            "sale_price": 1400.00,
            "is_active": True,
            "track_stock": True,
        },
        headers=headers,
    ).json()

    # Create Warehouse A and Warehouse B
    wh_a = client.post(
        "/api/v1/warehouses",
        json={"code": "MAG-AIN-SBAA", "name": "Magasin 1 — Tanger Ain Sbaa", "type": "MAIN"},
        headers=headers,
    ).json()

    wh_b = client.post(
        "/api/v1/warehouses",
        json={"code": "MAG-TANGER-CENTRE", "name": "Magasin 2 — Tanger Centre", "type": "WAREHOUSE"},
        headers=headers,
    ).json()

    # Give Product A 79 units in Warehouse A
    client.post(
        "/api/v1/stock/adjustments",
        json={"product_id": prod_a["id"], "warehouse_id": wh_a["id"], "new_quantity": 79.0, "reason": "Stock Prod A in Wh A"},
        headers=headers,
    )

    # Give Product B 302 units in Warehouse B
    client.post(
        "/api/v1/stock/adjustments",
        json={"product_id": prod_b["id"], "warehouse_id": wh_b["id"], "new_quantity": 302.0, "reason": "Stock Prod B in Wh B"},
        headers=headers,
    )

    # 2. Test exact single-balance endpoint /api/v1/stock/balance
    # Product A in Warehouse A -> 79
    res_a_a = client.get(f"/api/v1/stock/balance?product_id={prod_a['id']}&warehouse_id={wh_a['id']}", headers=headers)
    assert res_a_a.status_code == 200
    assert res_a_a.json()["quantity"] == 79.0
    assert res_a_a.json()["available_quantity"] == 79.0

    # Product B in Warehouse A -> EXACTLY 0 (NO cross-product contamination from Product A's 79 kg!)
    res_b_a = client.get(f"/api/v1/stock/balance?product_id={prod_b['id']}&warehouse_id={wh_a['id']}", headers=headers)
    assert res_b_a.status_code == 200
    assert res_b_a.json()["quantity"] == 0.0
    assert res_b_a.json()["available_quantity"] == 0.0

    # Product B in Warehouse B -> 302
    res_b_b = client.get(f"/api/v1/stock/balance?product_id={prod_b['id']}&warehouse_id={wh_b['id']}", headers=headers)
    assert res_b_b.status_code == 200
    assert res_b_b.json()["quantity"] == 302.0
    assert res_b_b.json()["available_quantity"] == 302.0

    # Product A in Warehouse B -> EXACTLY 0
    res_a_b = client.get(f"/api/v1/stock/balance?product_id={prod_a['id']}&warehouse_id={wh_b['id']}", headers=headers)
    assert res_a_b.status_code == 200
    assert res_a_b.json()["quantity"] == 0.0

    # 3. Test list_stock filter by product_id and warehouse_id
    list_b_a = client.get(f"/api/v1/stock?product_id={prod_b['id']}&warehouse_id={wh_a['id']}", headers=headers)
    assert list_b_a.status_code == 200
    # No balance exists for (B, A) in DB
    assert len(list_b_a.json()) == 0

    # 4. Attempt transferring Product B from Warehouse A (requesting 91 units) -> MUST FAIL (available 0)
    invalid_transfer = client.post(
        "/api/v1/stock/transfers",
        json={
            "product_id": prod_b["id"],
            "source_warehouse_id": wh_a["id"],
            "dest_warehouse_id": wh_b["id"],
            "quantity": 91.0,
            "reason": "Test transfert impossible",
        },
        headers=headers,
    )
    assert invalid_transfer.status_code == 400
    assert "insuffisant" in invalid_transfer.text.lower()

    # 5. Valid transfer of Product A from Warehouse A (79 units) to Warehouse B (requesting 20 units) -> SUCCEEDS
    valid_transfer = client.post(
        "/api/v1/stock/transfers",
        json={
            "product_id": prod_a["id"],
            "source_warehouse_id": wh_a["id"],
            "dest_warehouse_id": wh_b["id"],
            "quantity": 20.0,
            "reason": "Transfert valide 20kg",
        },
        headers=headers,
    )
    assert valid_transfer.status_code == 200
    assert valid_transfer.json()["source_quantity"] == 59.0
    assert valid_transfer.json()["dest_quantity"] == 20.0

    # Re-verify balances after transfer
    check_a_a = client.get(f"/api/v1/stock/balance?product_id={prod_a['id']}&warehouse_id={wh_a['id']}", headers=headers).json()
    check_a_b = client.get(f"/api/v1/stock/balance?product_id={prod_a['id']}&warehouse_id={wh_b['id']}", headers=headers).json()
    assert check_a_a["quantity"] == 59.0
    assert check_a_b["quantity"] == 20.0


def test_warehouse_edit_and_deactivation_workflows(client: TestClient):
    """Tests warehouse modification, duplicate code validation, and toggle deactivation/reactivation."""
    headers = get_auth_header(client)

    # 1. Create two warehouses
    wh1 = client.post(
        "/api/v1/warehouses",
        json={"code": "WH-EDIT-01", "name": "Entrepôt Fès Principal", "type": "MAIN", "address": "Route de Sefrou"},
        headers=headers,
    ).json()

    wh2 = client.post(
        "/api/v1/warehouses",
        json={"code": "WH-EDIT-02", "name": "Entrepôt Fès Nord", "type": "WAREHOUSE", "address": "Route de Meknès"},
        headers=headers,
    ).json()

    # 2. Modify wh1 code to duplicate of wh2 -> 409 Conflict
    dup_res = client.put(
        f"/api/v1/warehouses/{wh1['id']}",
        json={"code": "WH-EDIT-02", "name": "Nouveau Nom"},
        headers=headers,
    )
    assert dup_res.status_code == 409
    assert "existe déjà" in dup_res.text

    # 3. Successful modification of wh1
    up_res = client.put(
        f"/api/v1/warehouses/{wh1['id']}",
        json={
            "code": "WH-EDIT-01-MOD",
            "name": "Entrepôt Fès Principal Modifié",
            "type": "WORKSHOP",
            "address": "Nouvelle adresse industrielle",
            "description": "Atelier de calibrage",
            "is_active": True,
        },
        headers=headers,
    )
    assert up_res.status_code == 200
    updated = up_res.json()
    assert updated["code"] == "WH-EDIT-01-MOD"
    assert updated["name"] == "Entrepôt Fès Principal Modifié"
    assert updated["type"] == "WORKSHOP"

    # 4. Toggle active state (deactivate)
    toggle_deact = client.patch(f"/api/v1/warehouses/{wh1['id']}/toggle-active", headers=headers)
    assert toggle_deact.status_code == 200
    assert toggle_deact.json()["is_active"] is False

    # 5. Toggle active state (reactivate)
    toggle_react = client.patch(f"/api/v1/warehouses/{wh1['id']}/toggle-active", headers=headers)
    assert toggle_react.status_code == 200
    assert toggle_react.json()["is_active"] is True


def test_stock_stats_tracked_product_without_stock_balance(client: TestClient):
    """Verifies that active products with track_stock=True but no StockBalance rows are counted as managed_products and out_of_stock."""
    headers = get_auth_header(client)

    cat = client.post("/api/v1/categories", json={"name": "Cat Stats Test", "code": f"CAT-ST-{datetime.now().timestamp()}"}, headers=headers).json()
    pt = client.post("/api/v1/product-types", json={"name": "Type Stats Test", "code": f"TYP-ST-{datetime.now().timestamp()}"}, headers=headers).json()
    u = client.post("/api/v1/units", json={"name": "Unité Stats", "abbreviation": "UST"}, headers=headers).json()

    # Create tracked product with NO stock balance
    prod = client.post(
        "/api/v1/products",
        json={
            "sku": f"PROD-NO-BAL-{datetime.now().timestamp()}",
            "designation": "Produit Sans Balance Stock",
            "category_id": cat["id"],
            "product_type_id": pt["id"],
            "unit_id": u["id"],
            "purchase_price": 500.00,
            "sale_price": 800.00,
            "is_active": True,
            "track_stock": True,
        },
        headers=headers,
    ).json()

    stats = client.get("/api/v1/stock/stats", headers=headers).json()
    assert stats["managed_products"] >= 1
    assert stats["total_tracked_products"] >= 1
    assert stats["tracked_products_count"] >= 1
    assert stats["out_of_stock"] >= 1
    assert stats["out_of_stock_count"] >= 1


def test_stock_stats_business_rules_matrix(client: TestClient):
    """Tests the exact matrix:
    - Product A: track_stock=true, stock=79
    - Product B: track_stock=true, no stock_balance row
    - Product C: track_stock=true, stock=0
    - Product D: track_stock=false
    """
    headers = get_auth_header(client)
    ts = int(datetime.now().timestamp() * 1000)

    cat = client.post("/api/v1/categories", json={"name": f"Cat Matrix {ts}", "code": f"CM-{ts}"}, headers=headers).json()
    pt = client.post("/api/v1/product-types", json={"name": f"Type Matrix {ts}", "code": f"TM-{ts}"}, headers=headers).json()
    u = client.post("/api/v1/units", json={"name": f"Unit Matrix {ts}", "abbreviation": f"u{ts}"}, headers=headers).json()
    wh = client.post("/api/v1/warehouses", json={"code": f"WH-M-{ts}", "name": f"Warehouse Matrix {ts}", "type": "MAIN"}, headers=headers).json()

    # Product A: track_stock=true, stock=79, purchase_price=100
    prod_a = client.post(
        "/api/v1/products",
        json={
            "sku": f"PROD-A-{ts}",
            "designation": f"Product A {ts}",
            "category_id": cat["id"],
            "product_type_id": pt["id"],
            "unit_id": u["id"],
            "purchase_price": 100.00,
            "sale_price": 150.00,
            "is_active": True,
            "track_stock": True,
        },
        headers=headers,
    ).json()
    client.post(
        "/api/v1/stock/adjustments",
        json={"product_id": prod_a["id"], "warehouse_id": wh["id"], "new_quantity": 79.0, "reason": "Stock initial A"},
        headers=headers,
    )

    # Product B: track_stock=true, no stock balance, purchase_price=200
    prod_b = client.post(
        "/api/v1/products",
        json={
            "sku": f"PROD-B-{ts}",
            "designation": f"Product B {ts}",
            "category_id": cat["id"],
            "product_type_id": pt["id"],
            "unit_id": u["id"],
            "purchase_price": 200.00,
            "sale_price": 250.00,
            "is_active": True,
            "track_stock": True,
        },
        headers=headers,
    ).json()

    # Product C: track_stock=true, stock=0, purchase_price=300
    prod_c = client.post(
        "/api/v1/products",
        json={
            "sku": f"PROD-C-{ts}",
            "designation": f"Product C {ts}",
            "category_id": cat["id"],
            "product_type_id": pt["id"],
            "unit_id": u["id"],
            "purchase_price": 300.00,
            "sale_price": 350.00,
            "is_active": True,
            "track_stock": True,
        },
        headers=headers,
    ).json()
    # Explicit zero balance
    client.post(
        "/api/v1/stock/adjustments",
        json={"product_id": prod_c["id"], "warehouse_id": wh["id"], "new_quantity": 0.0, "reason": "Initial zero C"},
        headers=headers,
    )

    # Product D: track_stock=false, purchase_price=400
    prod_d = client.post(
        "/api/v1/products",
        json={
            "sku": f"PROD-D-{ts}",
            "designation": f"Product D Non Stock {ts}",
            "category_id": cat["id"],
            "product_type_id": pt["id"],
            "unit_id": u["id"],
            "purchase_price": 400.00,
            "sale_price": 450.00,
            "is_active": True,
            "track_stock": False,
        },
        headers=headers,
    ).json()

    stats = client.get("/api/v1/stock/stats", headers=headers).json()

    # Verify tracked products
    assert stats["managed_products"] >= 3
    assert stats["total_tracked_products"] >= 3
    assert stats["out_of_stock"] >= 2  # Product B and Product C
    assert stats["total_quantity"] >= 79.0
    assert stats["total_value_ht"] >= 79.0 * 100.0


def test_stock_stats_multi_warehouse_aggregation(client: TestClient):
    """Verifies that a product in multiple warehouses has its stock summed and is counted once for managed_products."""
    headers = get_auth_header(client)
    ts = int(datetime.now().timestamp() * 1000)

    cat = client.post("/api/v1/categories", json={"name": f"Cat MW {ts}", "code": f"CMW-{ts}"}, headers=headers).json()
    pt = client.post("/api/v1/product-types", json={"name": f"Type MW {ts}", "code": f"TMW-{ts}"}, headers=headers).json()
    u = client.post("/api/v1/units", json={"name": f"Unit MW {ts}", "abbreviation": f"umw{ts}"}, headers=headers).json()

    wh1 = client.post("/api/v1/warehouses", json={"code": f"WH-MW1-{ts}", "name": "Dépôt Ain Sbaa", "type": "MAIN"}, headers=headers).json()
    wh2 = client.post("/api/v1/warehouses", json={"code": f"WH-MW2-{ts}", "name": "Dépôt Tanger", "type": "WAREHOUSE"}, headers=headers).json()

    prod = client.post(
        "/api/v1/products",
        json={
            "sku": f"PROD-MW-{ts}",
            "designation": f"Product Multi Warehouse {ts}",
            "category_id": cat["id"],
            "product_type_id": pt["id"],
            "unit_id": u["id"],
            "purchase_price": 50.00,
            "sale_price": 80.00,
            "is_active": True,
            "track_stock": True,
        },
        headers=headers,
    ).json()

    # Add 50 in WH1, 20 in WH2 -> Total 70
    client.post(
        "/api/v1/stock/adjustments",
        json={"product_id": prod["id"], "warehouse_id": wh1["id"], "new_quantity": 50.0, "reason": "Init WH1"},
        headers=headers,
    )
    client.post(
        "/api/v1/stock/adjustments",
        json={"product_id": prod["id"], "warehouse_id": wh2["id"], "new_quantity": 20.0, "reason": "Init WH2"},
        headers=headers,
    )

    stats_global = client.get("/api/v1/stock/stats", headers=headers).json()
    assert stats_global["managed_products"] >= 1
    assert stats_global["total_quantity"] >= 70.0

    # Depot specific stats
    stats_wh1 = client.get(f"/api/v1/stock/stats?warehouse_id={wh1['id']}", headers=headers).json()
    assert stats_wh1["total_quantity"] >= 50.0


def test_main_dashboard_stats_endpoint_includes_stock(client: TestClient):
    """Verifies that /api/v1/dashboard/stats returns the stock section conforming to section 12 requirements."""
    headers = get_auth_header(client)

    res = client.get("/api/v1/dashboard/stats", headers=headers)
    assert res.status_code == 200
    data = res.json()

    assert "stock" in data
    assert data["stock"] is not None
    stock = data["stock"]

    assert "managed_products" in stock
    assert "total_quantity" in stock
    assert "total_value_ht" in stock
    assert "low_stock" in stock
    assert "out_of_stock" in stock
    assert "overstock" in stock
    assert "active_warehouses" in stock
    assert "movement_count" in stock
    assert isinstance(stock["managed_products"], int)
    assert isinstance(stock["total_quantity"], (int, float))
    assert isinstance(stock["total_value_ht"], (int, float))


