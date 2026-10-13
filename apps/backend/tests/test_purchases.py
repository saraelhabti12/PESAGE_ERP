import pytest
from fastapi.testclient import TestClient
from app.core.config import settings


def get_auth_header(client: TestClient, email: str = settings.ADMIN_EMAIL, password: str = settings.ADMIN_PASSWORD) -> dict:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_prerequisites(client: TestClient, headers: dict):
    """Helper to create test supplier and products."""
    # 1. Create Supplier
    supp_res = client.post(
        "/api/v1/partners",
        json={
            "code": "FRS-TEST-PO",
            "legal_name": "Société Marocaine de Pesage Industriel",
            "trade_name": "SMPI Fournisseur",
            "partner_type": "SUPPLIER",
            "is_active": True,
        },
        headers=headers,
    )
    assert supp_res.status_code == 201, f"Failed creating supplier: {supp_res.text}"
    supplier = supp_res.json()

    # 2. Create Customer (for invalid supplier test)
    cust_res = client.post(
        "/api/v1/partners",
        json={
            "code": "CLI-TEST-PO",
            "legal_name": "Client Non Fournisseur SARL",
            "partner_type": "CUSTOMER",
            "is_active": True,
        },
        headers=headers,
    )
    assert cust_res.status_code == 201
    customer = cust_res.json()

    # 3. Create Catalog Prereqs
    cat = client.post("/api/v1/categories", json={"name": "Capteurs de Pesage", "code": "CAP"}, headers=headers).json()
    pt = client.post("/api/v1/product-types", json={"name": "Matériel Industriel", "code": "IND"}, headers=headers).json()
    u = client.post("/api/v1/units", json={"name": "Unité", "abbreviation": "U"}, headers=headers).json()

    # 4. Create Products
    prod1 = client.post(
        "/api/v1/products",
        json={
            "sku": "PROD-CAP-001",
            "designation": "Capteur de Charge 500kg IP68",
            "category_id": cat["id"],
            "product_type_id": pt["id"],
            "unit_id": u["id"],
            "purchase_price": 1200.00,
            "sale_price": 1800.00,
            "tax_rate": 20.00,
            "is_active": True,
            "track_stock": True,
        },
        headers=headers,
    ).json()

    prod2 = client.post(
        "/api/v1/products",
        json={
            "sku": "PROD-IND-002",
            "designation": "Indicateur Numérique LCD IP65",
            "category_id": cat["id"],
            "product_type_id": pt["id"],
            "unit_id": u["id"],
            "purchase_price": 3500.00,
            "sale_price": 5200.00,
            "tax_rate": 20.00,
            "is_active": True,
            "track_stock": True,
        },
        headers=headers,
    ).json()

    # 5. Create Warehouse
    wh = client.post(
        "/api/v1/warehouses",
        json={
            "code": "DEPOT-TEST-PO",
            "name": "Dépôt Réception Test",
            "type": "MAIN",
            "is_active": True,
        },
        headers=headers,
    ).json()

    return supplier, customer, prod1, prod2, wh


def test_create_purchase_order_and_totals(client: TestClient):
    headers = get_auth_header(client)
    supplier, _, prod1, prod2, wh = create_prerequisites(client, headers)

    # 1. Create Purchase Order with 2 line items and discount
    # Line 1: 10 units @ 1200 DH, tax 20%, discount 10%
    # gross = 12000, discount = 1200, subtotal = 10800, tax = 2160, ttc = 12960
    # Line 2: 2 units @ 3500 DH, tax 20%, discount 0%
    # gross = 7000, discount = 0, subtotal = 7000, tax = 1400, ttc = 8400
    # Order totals: subtotal_ht = 17800, tax_amount = 3560, total_ttc = 21360
    payload = {
        "reference": "PO-TEST-0001",
        "supplier_id": supplier["id"],
        "order_date": "2026-08-27T10:00:00Z",
        "payment_terms": "60 jours fin de mois",
        "payment_method": "Virement bancaire",
        "notes": "Commande prioritaire pour projet Pont-Bascule",
        "items": [
            {
                "product_id": prod1["id"],
                "quantity_ordered": 10,
                "unit_price_ht": 1200.00,
                "tax_rate": 20.00,
                "discount_rate": 10.00,
            },
            {
                "product_id": prod2["id"],
                "quantity_ordered": 2,
                "unit_price_ht": 3500.00,
                "tax_rate": 20.00,
                "discount_rate": 0.00,
            },
        ],
    }

    r = client.post("/api/v1/purchases", json=payload, headers=headers)
    assert r.status_code == 201, f"Failed creating PO: {r.text}"
    order = r.json()
    assert order["reference"] == "PO-TEST-0001"
    assert order["status"] == "DRAFT"
    assert order["subtotal_ht"] == 17800.00
    assert order["tax_amount"] == 3560.00
    assert order["total_ttc"] == 21360.00
    assert len(order["items"]) == 2

    # Check item lines calculation
    line1 = next(i for i in order["items"] if i["product_id"] == prod1["id"])
    assert line1["quantity_ordered"] == 10.0
    assert line1["quantity_received"] == 0.0
    assert line1["quantity_remaining"] == 10.0
    assert line1["line_subtotal_ht"] == 10800.00
    assert line1["line_tax"] == 2160.00
    assert line1["line_total_ttc"] == 12960.00


def test_supplier_and_product_validations(client: TestClient):
    headers = get_auth_header(client)
    supplier, customer, prod1, _, wh = create_prerequisites(client, headers)

    # Rejection 1: Non-existent supplier
    r1 = client.post(
        "/api/v1/purchases",
        json={
            "supplier_id": 99999,
            "items": [{"product_id": prod1["id"], "quantity_ordered": 1}],
        },
        headers=headers,
    )
    assert r1.status_code == 400
    assert "n'existe pas" in r1.json()["error"]["message"]

    # Rejection 2: Customer-only partner as supplier
    r2 = client.post(
        "/api/v1/purchases",
        json={
            "supplier_id": customer["id"],
            "items": [{"product_id": prod1["id"], "quantity_ordered": 1}],
        },
        headers=headers,
    )
    assert r2.status_code == 400
    assert "pas configuré comme fournisseur" in r2.json()["error"]["message"]

    # Rejection 3: Non-existent product
    r3 = client.post(
        "/api/v1/purchases",
        json={
            "supplier_id": supplier["id"],
            "items": [{"product_id": 88888, "quantity_ordered": 1}],
        },
        headers=headers,
    )
    assert r3.status_code == 400
    assert "n'existe pas" in r3.json()["error"]["message"]

    # Rejection 4: Negative price
    r4 = client.post(
        "/api/v1/purchases",
        json={
            "supplier_id": supplier["id"],
            "items": [{"product_id": prod1["id"], "quantity_ordered": 1, "unit_price_ht": -50.0}],
        },
        headers=headers,
    )
    assert r4.status_code == 422  # pydantic ge=0 validation

    # Rejection 5: Zero or negative quantity
    r5 = client.post(
        "/api/v1/purchases",
        json={
            "supplier_id": supplier["id"],
            "items": [{"product_id": prod1["id"], "quantity_ordered": 0}],
        },
        headers=headers,
    )
    assert r5.status_code == 422  # pydantic gt=0 validation


def test_approve_cancel_and_delete_workflow(client: TestClient):
    headers = get_auth_header(client)
    supplier, _, prod1, _, wh = create_prerequisites(client, headers)

    # 1. Create Draft Order
    order = client.post(
        "/api/v1/purchases",
        json={
            "reference": "PO-WORKFLOW-01",
            "supplier_id": supplier["id"],
            "items": [{"product_id": prod1["id"], "quantity_ordered": 5, "unit_price_ht": 1000.0}],
        },
        headers=headers,
    ).json()
    assert order["status"] == "DRAFT"

    # 2. Approve Order
    r_app = client.post(f"/api/v1/purchases/{order['id']}/approve", headers=headers)
    assert r_app.status_code == 200
    assert r_app.json()["status"] == "APPROVED"

    # 3. Cancel Order
    r_cnc = client.post(f"/api/v1/purchases/{order['id']}/cancel", headers=headers)
    assert r_cnc.status_code == 200
    assert r_cnc.json()["status"] == "CANCELLED"

    # 4. Cancelled order cannot be approved
    r_app_again = client.post(f"/api/v1/purchases/{order['id']}/approve", headers=headers)
    assert r_app_again.status_code == 400

    # 5. Delete Cancelled Order
    r_del = client.delete(f"/api/v1/purchases/{order['id']}", headers=headers)
    assert r_del.status_code == 204


def test_partial_and_full_receipt_workflow(client: TestClient):
    headers = get_auth_header(client)
    supplier, _, prod1, prod2, wh = create_prerequisites(client, headers)

    # 1. Create and Approve Order: 10 of Prod1, 5 of Prod2
    order = client.post(
        "/api/v1/purchases",
        json={
            "reference": "PO-RECEIPT-FLOW",
            "supplier_id": supplier["id"],
            "items": [
                {"product_id": prod1["id"], "quantity_ordered": 10, "unit_price_ht": 1200.0},
                {"product_id": prod2["id"], "quantity_ordered": 5, "unit_price_ht": 3000.0},
            ],
        },
        headers=headers,
    ).json()

    po_id = order["id"]
    item1_id = order["items"][0]["id"]
    item2_id = order["items"][1]["id"]

    # Draft order cannot be received
    r_rec_draft = client.post(
        "/api/v1/purchase-receipts",
        json={
            "purchase_order_id": po_id,
            "warehouse_id": wh["id"],
            "items": [{"purchase_order_item_id": item1_id, "product_id": prod1["id"], "quantity_received": 5}],
        },
        headers=headers,
    )
    assert r_rec_draft.status_code == 400
    assert "doit être approuvée" in r_rec_draft.json()["error"]["message"]

    # Approve order
    client.post(f"/api/v1/purchases/{po_id}/approve", headers=headers)

    # 2. Over-receipt rejection: try to receive 15 for item1 (ordered 10)
    r_over = client.post(
        "/api/v1/purchase-receipts",
        json={
            "purchase_order_id": po_id,
            "warehouse_id": wh["id"],
            "items": [{"purchase_order_item_id": item1_id, "product_id": prod1["id"], "quantity_received": 15}],
        },
        headers=headers,
    )
    assert r_over.status_code == 400
    assert "dépasse le reste à recevoir" in r_over.json()["error"]["message"]

    # 3. Create Partial Receipt 1: 6 of Prod1, 2 of Prod2
    r_rec1 = client.post(
        "/api/v1/purchase-receipts",
        json={
            "reference": "BL-FOURN-001",
            "purchase_order_id": po_id,
            "warehouse_id": wh["id"],
            "items": [
                {"purchase_order_item_id": item1_id, "product_id": prod1["id"], "quantity_received": 6},
                {"purchase_order_item_id": item2_id, "product_id": prod2["id"], "quantity_received": 2},
            ],
        },
        headers=headers,
    )
    assert r_rec1.status_code == 201
    rec1 = r_rec1.json()
    assert rec1["reference"] == "BL-FOURN-001"
    assert rec1["warehouse_id"] == wh["id"]
    assert rec1["warehouse"]["code"] == wh["code"]
    assert len(rec1["items"]) == 2

    # Check Order status after partial receipt -> PARTIALLY_RECEIVED
    po_after_rec1 = client.get(f"/api/v1/purchases/{po_id}", headers=headers).json()
    assert po_after_rec1["status"] == "PARTIALLY_RECEIVED"
    
    line1 = next(i for i in po_after_rec1["items"] if i["id"] == item1_id)
    assert line1["quantity_received"] == 6.0
    assert line1["quantity_remaining"] == 4.0

    line2 = next(i for i in po_after_rec1["items"] if i["id"] == item2_id)
    assert line2["quantity_received"] == 2.0
    assert line2["quantity_remaining"] == 3.0

    # Partially received order cannot be cancelled
    r_cnc_fail = client.post(f"/api/v1/purchases/{po_id}/cancel", headers=headers)
    assert r_cnc_fail.status_code == 400
    assert "ayant déjà fait l'objet de réceptions" in r_cnc_fail.json()["error"]["message"]

    # 4. Create Partial Receipt 2 (Completing the remaining quantities): 4 of Prod1, 3 of Prod2
    r_rec2 = client.post(
        "/api/v1/purchase-receipts",
        json={
            "reference": "BL-FOURN-002",
            "purchase_order_id": po_id,
            "warehouse_id": wh["id"],
            "items": [
                {"purchase_order_item_id": item1_id, "product_id": prod1["id"], "quantity_received": 4},
                {"purchase_order_item_id": item2_id, "product_id": prod2["id"], "quantity_received": 3},
            ],
        },
        headers=headers,
    )
    assert r_rec2.status_code == 201

    # Check Order status after full receipt -> RECEIVED
    po_final = client.get(f"/api/v1/purchases/{po_id}", headers=headers).json()
    assert po_final["status"] == "RECEIVED"
    assert len(po_final["receipts"]) == 2

    final_line1 = next(i for i in po_final["items"] if i["id"] == item1_id)
    assert final_line1["quantity_received"] == 10.0
    assert final_line1["quantity_remaining"] == 0.0

    final_line2 = next(i for i in po_final["items"] if i["id"] == item2_id)
    assert final_line2["quantity_received"] == 5.0
    assert final_line2["quantity_remaining"] == 0.0

    # Cannot receive more on a fully RECEIVED order
    r_rec3 = client.post(
        "/api/v1/purchase-receipts",
        json={
            "purchase_order_id": po_id,
            "warehouse_id": wh["id"],
            "items": [{"purchase_order_item_id": item1_id, "product_id": prod1["id"], "quantity_received": 1}],
        },
        headers=headers,
    )
    assert r_rec3.status_code == 400


def test_rbac_purchase_permissions(client: TestClient):
    admin_headers = get_auth_header(client)
    supplier, _, prod1, _, wh = create_prerequisites(client, admin_headers)

    # 1. Create a User with only 'TECHNICIEN' role (no purchases.create permission)
    tech_email = "technicien.test@example.com"
    tech_pwd = "TechnicienPassword123!"
    
    # Get TECHNICIEN role
    roles_res = client.get("/api/v1/roles", headers=admin_headers).json()
    tech_role = next(r for r in roles_res if r["name"] == "TECHNICIEN")

    client.post(
        "/api/v1/users",
        json={
            "email": tech_email,
            "password": tech_pwd,
            "first_name": "Karim",
            "last_name": "Technicien",
            "role_ids": [tech_role["id"]],
        },
        headers=admin_headers,
    )

    tech_headers = get_auth_header(client, email=tech_email, password=tech_pwd)

    # Technicien cannot view purchases
    r_view = client.get("/api/v1/purchases", headers=tech_headers)
    assert r_view.status_code == 403

    # Technicien cannot create purchases
    r_create = client.post(
        "/api/v1/purchases",
        json={
            "supplier_id": supplier["id"],
            "items": [{"product_id": prod1["id"], "quantity_ordered": 1}],
        },
        headers=tech_headers,
    )
    assert r_create.status_code == 403


def test_purchase_order_flow_selection_and_save_scenario(client: TestClient):
    """Step 16 scenario verification: select real supplier & product, qty 10, real purchase price, TVA 20, discount 0, save and verify."""
    headers = get_auth_header(client)
    supplier, customer, product, prod2, wh = create_prerequisites(client, headers)

    # User Scenario: Supplier selected, Product selected, Quantity=10, Price=1200.00, TVA=20, Discount=0
    payload = {
        "supplier_id": supplier["id"],
        "order_date": "2026-08-27T10:00:00Z",
        "payment_terms": "30 jours fin de mois",
        "payment_method": "bank_transfer",
        "items": [
            {
                "product_id": product["id"],
                "quantity_ordered": 10.0,
                "unit_price_ht": float(product["purchase_price"]),
                "tax_rate": 20.0,
                "discount_rate": 0.0,
            }
        ],
    }

    res = client.post("/api/v1/purchases", json=payload, headers=headers)
    assert res.status_code == 201, f"Failed creating purchase order: {res.text}"
    created_po = res.json()

    assert created_po["supplier_id"] == supplier["id"]
    assert created_po["subtotal_ht"] == 12000.00
    assert created_po["tax_amount"] == 2400.00
    assert created_po["total_ttc"] == 14400.00
    assert created_po["status"] == "DRAFT"

    # Verify purchase order is retrieved by ID
    get_res = client.get(f"/api/v1/purchases/{created_po['id']}", headers=headers)
    assert get_res.status_code == 200
    detail = get_res.json()
    assert detail["reference"] == created_po["reference"]
    assert len(detail["items"]) == 1
    assert detail["items"][0]["product_id"] == product["id"]
    assert detail["items"][0]["quantity_ordered"] == 10.0
    assert detail["items"][0]["unit_price_ht"] == 1200.00
    assert detail["items"][0]["line_subtotal_ht"] == 12000.00
    assert detail["items"][0]["line_tax"] == 2400.00
    assert detail["items"][0]["line_total_ttc"] == 14400.00


def test_purchase_receipt_destination_warehouse_validation(client: TestClient):
    """Test warehouse validation: missing warehouse, inactive warehouse, non-existent warehouse, and valid active warehouse."""
    headers = get_auth_header(client)
    supplier, _, prod_tracked, _, wh_active = create_prerequisites(client, headers)

    # Create inactive warehouse
    wh_inactive = client.post(
        "/api/v1/warehouses",
        json={"code": "WH-INACTIVE-01", "name": "Dépôt Inactif", "type": "WAREHOUSE", "is_active": False},
        headers=headers,
    ).json()

    # Create & approve PO
    order = client.post(
        "/api/v1/purchases",
        json={
            "reference": "PO-WH-VAL-01",
            "supplier_id": supplier["id"],
            "items": [{"product_id": prod_tracked["id"], "quantity_ordered": 5, "unit_price_ht": 1000.0}],
        },
        headers=headers,
    ).json()
    po_id = order["id"]
    item_id = order["items"][0]["id"]
    client.post(f"/api/v1/purchases/{po_id}/approve", headers=headers)

    # 1. Rejection: Missing warehouse_id
    r_no_wh = client.post(
        "/api/v1/purchase-receipts",
        json={
            "purchase_order_id": po_id,
            "items": [{"purchase_order_item_id": item_id, "product_id": prod_tracked["id"], "quantity_received": 2}],
        },
        headers=headers,
    )
    assert r_no_wh.status_code == 400
    assert "sélectionner le dépôt de réception" in r_no_wh.json()["error"]["message"]

    # 2. Rejection: Inactive warehouse_id
    r_inact_wh = client.post(
        "/api/v1/purchase-receipts",
        json={
            "purchase_order_id": po_id,
            "warehouse_id": wh_inactive["id"],
            "items": [{"purchase_order_item_id": item_id, "product_id": prod_tracked["id"], "quantity_received": 2}],
        },
        headers=headers,
    )
    assert r_inact_wh.status_code == 400
    assert "inactif" in r_inact_wh.json()["error"]["message"]

    # 3. Rejection: Non-existent warehouse_id
    r_notfound_wh = client.post(
        "/api/v1/purchase-receipts",
        json={
            "purchase_order_id": po_id,
            "warehouse_id": 999999,
            "items": [{"purchase_order_item_id": item_id, "product_id": prod_tracked["id"], "quantity_received": 2}],
        },
        headers=headers,
    )
    assert r_notfound_wh.status_code == 400
    assert "introuvable" in r_notfound_wh.json()["error"]["message"]

    # 4. Success: Valid active warehouse_id
    r_ok = client.post(
        "/api/v1/purchase-receipts",
        json={
            "reference": "BL-VAL-OK-01",
            "purchase_order_id": po_id,
            "warehouse_id": wh_active["id"],
            "items": [{"purchase_order_item_id": item_id, "product_id": prod_tracked["id"], "quantity_received": 2}],
        },
        headers=headers,
    )
    assert r_ok.status_code == 201
    rec = r_ok.json()
    assert rec["warehouse_id"] == wh_active["id"]
    assert rec["warehouse"]["id"] == wh_active["id"]
    assert rec["warehouse"]["code"] == wh_active["code"]
    assert rec["warehouse"]["name"] == wh_active["name"]


def test_purchase_receipt_multi_warehouse_isolation_and_stock_balances(client: TestClient):
    """Test stock balance routing to selected warehouse, multi-warehouse isolation, non-stock item handling, and movement creation."""
    headers = get_auth_header(client)
    supplier, _, prod1, _, _ = create_prerequisites(client, headers)

    # Create Warehouse A and Warehouse B
    wh_a = client.post(
        "/api/v1/warehouses",
        json={"code": "WH-RABAT-01", "name": "Dépôt Rabat", "type": "MAIN", "is_active": True},
        headers=headers,
    ).json()

    wh_b = client.post(
        "/api/v1/warehouses",
        json={"code": "WH-TANGER-01", "name": "Dépôt Tanger", "type": "WAREHOUSE", "is_active": True},
        headers=headers,
    ).json()

    # Create Non-Stock Product (track_stock=False)
    cat = client.post("/api/v1/categories", json={"name": "Prestations", "code": "PREST"}, headers=headers).json()
    pt = client.post("/api/v1/product-types", json={"name": "Services", "code": "SRV"}, headers=headers).json()
    u = client.post("/api/v1/units", json={"name": "Forfait", "abbreviation": "FF"}, headers=headers).json()
    prod_service = client.post(
        "/api/v1/products",
        json={
            "sku": "SRV-ETALONNAGE",
            "designation": "Forfait Installation & Étalonnage",
            "category_id": cat["id"],
            "product_type_id": pt["id"],
            "unit_id": u["id"],
            "purchase_price": 800.0,
            "sale_price": 1500.0,
            "track_stock": False,
        },
        headers=headers,
    ).json()

    # Create PO with Tracked Product (10 units) and Service (3 units)
    po = client.post(
        "/api/v1/purchases",
        json={
            "reference": "PO-MULTI-WH-01",
            "supplier_id": supplier["id"],
            "items": [
                {"product_id": prod1["id"], "quantity_ordered": 10, "unit_price_ht": 1200.0},
                {"product_id": prod_service["id"], "quantity_ordered": 3, "unit_price_ht": 800.0},
            ],
        },
        headers=headers,
    ).json()
    po_id = po["id"]
    item_p1 = next(it for it in po["items"] if it["product_id"] == prod1["id"])
    item_srv = next(it for it in po["items"] if it["product_id"] == prod_service["id"])

    # Approve PO
    client.post(f"/api/v1/purchases/{po_id}/approve", headers=headers)

    # 1. Receipt 1: Receive 6 units of Tracked Product + 2 units of Service into Warehouse A
    r_rec1 = client.post(
        "/api/v1/purchase-receipts",
        json={
            "reference": "BL-RABAT-01",
            "purchase_order_id": po_id,
            "warehouse_id": wh_a["id"],
            "items": [
                {"purchase_order_item_id": item_p1["id"], "product_id": prod1["id"], "quantity_received": 6},
                {"purchase_order_item_id": item_srv["id"], "product_id": prod_service["id"], "quantity_received": 2},
            ],
        },
        headers=headers,
    )
    assert r_rec1.status_code == 201

    # Verify Stock in Warehouse A is 6.0
    stk_a = client.get(f"/api/v1/stock?search={prod1['sku']}&warehouse_id={wh_a['id']}", headers=headers).json()
    assert len(stk_a) == 1
    assert stk_a[0]["quantity"] == 6.0
    assert stk_a[0]["available_quantity"] == 6.0

    # Verify Stock in Warehouse B is 0 / empty (Multi-warehouse isolation)
    stk_b = client.get(f"/api/v1/stock?search={prod1['sku']}&warehouse_id={wh_b['id']}", headers=headers).json()
    assert len(stk_b) == 0

    # Verify Service Product has NO stock balances anywhere
    stk_srv = client.get(f"/api/v1/stock?search={prod_service['sku']}", headers=headers).json()
    assert len(stk_srv) == 0

    # Verify Stock Movement logged for Warehouse A
    moves_a = client.get(f"/api/v1/stock/movements?warehouse_id={wh_a['id']}&product_id={prod1['id']}", headers=headers).json()
    assert any(m["movement_type"] == "PURCHASE_RECEIPT" and m["quantity"] == 6.0 for m in moves_a)

    # Verify NO Stock Movement logged for Warehouse B
    moves_b = client.get(f"/api/v1/stock/movements?warehouse_id={wh_b['id']}&product_id={prod1['id']}", headers=headers).json()
    assert len(moves_b) == 0

    # 2. Receipt 2: Receive remaining 4 units of Tracked Product + 1 unit of Service into Warehouse B
    r_rec2 = client.post(
        "/api/v1/purchase-receipts",
        json={
            "reference": "BL-TANGER-01",
            "purchase_order_id": po_id,
            "warehouse_id": wh_b["id"],
            "items": [
                {"purchase_order_item_id": item_p1["id"], "product_id": prod1["id"], "quantity_received": 4},
                {"purchase_order_item_id": item_srv["id"], "product_id": prod_service["id"], "quantity_received": 1},
            ],
        },
        headers=headers,
    )
    assert r_rec2.status_code == 201

    # Verify Warehouse A stock remains untouched at 6.0
    stk_a_after = client.get(f"/api/v1/stock?search={prod1['sku']}&warehouse_id={wh_a['id']}", headers=headers).json()
    assert len(stk_a_after) == 1
    assert stk_a_after[0]["quantity"] == 6.0

    # Verify Warehouse B stock is now 4.0
    stk_b_after = client.get(f"/api/v1/stock?search={prod1['sku']}&warehouse_id={wh_b['id']}", headers=headers).json()
    assert len(stk_b_after) == 1
    assert stk_b_after[0]["quantity"] == 4.0

    # Verify PO status is RECEIVED
    po_final = client.get(f"/api/v1/purchases/{po_id}", headers=headers).json()
    assert po_final["status"] == "RECEIVED"
    assert len(po_final["receipts"]) == 2
    rec_wh_names = {r["warehouse"]["code"] for r in po_final["receipts"]}
    assert "WH-RABAT-01" in rec_wh_names
    assert "WH-TANGER-01" in rec_wh_names

