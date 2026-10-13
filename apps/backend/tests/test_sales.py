import pytest
from fastapi.testclient import TestClient
from app.core.config import settings


def get_auth_header(client: TestClient, email: str = settings.ADMIN_EMAIL, password: str = settings.ADMIN_PASSWORD) -> dict:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def create_prerequisites(client: TestClient, headers: dict):
    """Helper to create test customers, suppliers, warehouses, catalog, and stock."""
    # 1. Create Customer
    cust_res = client.post(
        "/api/v1/partners",
        json={
            "code": "CLI-TEST-001",
            "legal_name": "Pesage Industriel Maroc SARL",
            "trade_name": "PIM Maroc",
            "partner_type": "CUSTOMER",
            "is_active": True,
        },
        headers=headers,
    )
    assert cust_res.status_code == 201, f"Failed creating customer: {cust_res.text}"
    customer = cust_res.json()

    # 2. Create Supplier-Only Partner (should be rejected for sales)
    supp_res = client.post(
        "/api/v1/partners",
        json={
            "code": "FRS-ONLY-001",
            "legal_name": "Fournisseur Exclusif SA",
            "partner_type": "SUPPLIER",
            "is_active": True,
        },
        headers=headers,
    )
    assert supp_res.status_code == 201
    supplier_only = supp_res.json()

    # 3. Create Customer-Supplier Partner (should be accepted)
    cust_supp_res = client.post(
        "/api/v1/partners",
        json={
            "code": "CLI-FRS-001",
            "legal_name": "Partenaire Mixte SARL",
            "partner_type": "CUSTOMER_SUPPLIER",
            "is_active": True,
        },
        headers=headers,
    )
    assert cust_supp_res.status_code == 201
    customer_supplier = cust_supp_res.json()

    # 4. Create Catalog Prereqs
    cat = client.post("/api/v1/categories", json={"name": "Balances Commerciales", "code": "BAL"}, headers=headers).json()
    pt = client.post("/api/v1/product-types", json={"name": "Balances Poids-Prix", "code": "BPP"}, headers=headers).json()
    u = client.post("/api/v1/units", json={"name": "Pièce", "abbreviation": "PCE"}, headers=headers).json()

    # 5. Create Stock-Tracked Product
    prod_stock = client.post(
        "/api/v1/products",
        json={
            "sku": "PROD-BAL-001",
            "designation": "Balance Électronique 15kg / 5g",
            "category_id": cat["id"],
            "product_type_id": pt["id"],
            "unit_id": u["id"],
            "purchase_price": 800.00,
            "sale_price": 1200.00,
            "tax_rate": 20.00,
            "is_active": True,
            "track_stock": True,
        },
        headers=headers,
    ).json()

    # 6. Create Non-Stock Product (Service / Hors-stock)
    prod_non_stock = client.post(
        "/api/v1/products",
        json={
            "sku": "SERV-ETAL-001",
            "designation": "Prestation Étalonnage et Vérification Périodique",
            "category_id": cat["id"],
            "product_type_id": pt["id"],
            "unit_id": u["id"],
            "purchase_price": 0.00,
            "sale_price": 500.00,
            "tax_rate": 20.00,
            "is_active": True,
            "track_stock": False,
        },
        headers=headers,
    ).json()

    # 7. Create Inactive Product
    prod_inactive = client.post(
        "/api/v1/products",
        json={
            "sku": "PROD-OBS-001",
            "designation": "Balance Mécanique Ancienne",
            "category_id": cat["id"],
            "product_type_id": pt["id"],
            "unit_id": u["id"],
            "purchase_price": 100.00,
            "sale_price": 150.00,
            "tax_rate": 20.00,
            "is_active": False,
            "track_stock": True,
        },
        headers=headers,
    ).json()

    # 8. Create Warehouse
    wh = client.post(
        "/api/v1/warehouses",
        json={
            "code": "DEP-TEST-01",
            "name": "Dépôt Principal Casablanca",
            "type": "MAIN",
            "is_active": True,
        },
        headers=headers,
    ).json()

    return customer, supplier_only, customer_supplier, prod_stock, prod_non_stock, prod_inactive, wh


def test_create_sale_and_totals(client: TestClient):
    headers = get_auth_header(client)
    customer, _, _, prod_stock, prod_non_stock, _, wh = create_prerequisites(client, headers)

    # Add stock for prod_stock in warehouse
    client.post(
        "/api/v1/stock/adjustments",
        json={
            "product_id": prod_stock["id"],
            "warehouse_id": wh["id"],
            "new_quantity": 20.00,
            "reason": "Stock pour test création vente",
        },
        headers=headers,
    )

    # Line 1: 5 units @ 1200 DH, tax 20%, discount 10%, warehouse_id = wh["id"]
    # gross = 6000, discount = 600, subtotal = 5400, tax = 1080, ttc = 6480
    # Line 2: 2 units @ 500 DH, tax 20%, discount 0%, non-stock
    # gross = 1000, discount = 0, subtotal = 1000, tax = 200, ttc = 1200
    # Grand totals: subtotal_ht = 6400, discount_amount = 600, tax_amount = 1280, total_ttc = 7680
    payload = {
        "reference": "VTE-TEST-0001",
        "customer_id": customer["id"],
        "order_date": "2026-09-02T10:00:00Z",
        "payment_terms": "30 jours",
        "payment_method": "Virement bancaire",
        "notes": "Vente de balances et prestation",
        "items": [
            {
                "product_id": prod_stock["id"],
                "warehouse_id": wh["id"],
                "quantity": 5,
                "unit_price_ht": 1200.00,
                "tax_rate": 20.00,
                "discount_rate": 10.00,
            },
            {
                "product_id": prod_non_stock["id"],
                "quantity": 2,
                "unit_price_ht": 500.00,
                "tax_rate": 20.00,
                "discount_rate": 0.00,
            },
        ],
    }

    res = client.post("/api/v1/sales", json=payload, headers=headers)
    assert res.status_code == 201, f"Create sale failed: {res.text}"
    sale = res.json()

    assert sale["reference"] == "VTE-TEST-0001"
    assert sale["customer_id"] == customer["id"]
    assert sale["status"] == "DRAFT"
    assert len(sale["items"]) == 2
    assert float(sale["subtotal_ht"]) == 6400.00
    assert float(sale["discount_amount"]) == 600.00
    assert float(sale["tax_amount"]) == 1280.00
    assert float(sale["total_ttc"]) == 7680.00

    # Line 1 checks
    item1 = sale["items"][0]
    assert float(item1["quantity"]) == 5
    assert item1["warehouse_id"] == wh["id"]
    assert float(item1["unit_price_ht"]) == 1200.00
    assert float(item1["line_discount"]) == 600.00
    assert float(item1["line_subtotal_ht"]) == 5400.00
    assert float(item1["line_tax"]) == 1080.00
    assert float(item1["line_total_ttc"]) == 6480.00


def test_customer_validations(client: TestClient):
    headers = get_auth_header(client)
    customer, supplier_only, customer_supplier, _, prod_non_stock, _, _ = create_prerequisites(client, headers)

    # 1. Non-existent customer
    r1 = client.post(
        "/api/v1/sales",
        json={"customer_id": 999999, "items": [{"product_id": prod_non_stock["id"], "quantity": 1}]},
        headers=headers,
    )
    assert r1.status_code == 400
    assert "n'existe pas" in r1.json()["error"]["message"]

    # 2. Supplier-only partner rejected
    r2 = client.post(
        "/api/v1/sales",
        json={"customer_id": supplier_only["id"], "items": [{"product_id": prod_non_stock["id"], "quantity": 1}]},
        headers=headers,
    )
    assert r2.status_code == 400
    assert "pas configuré comme client" in r2.json()["error"]["message"]

    # 3. Customer + Supplier partner accepted
    r3 = client.post(
        "/api/v1/sales",
        json={"customer_id": customer_supplier["id"], "items": [{"product_id": prod_non_stock["id"], "quantity": 1}]},
        headers=headers,
    )
    assert r3.status_code == 201
    assert r3.json()["customer_id"] == customer_supplier["id"]


def test_product_validations(client: TestClient):
    headers = get_auth_header(client)
    customer, _, _, prod_stock, _, prod_inactive, wh = create_prerequisites(client, headers)

    # 1. Non-existent product
    r1 = client.post(
        "/api/v1/sales",
        json={"customer_id": customer["id"], "items": [{"product_id": 999999, "quantity": 1}]},
        headers=headers,
    )
    assert r1.status_code == 400
    assert "n'existe pas" in r1.json()["error"]["message"]

    # 2. Inactive product rejected
    r2 = client.post(
        "/api/v1/sales",
        json={"customer_id": customer["id"], "items": [{"product_id": prod_inactive["id"], "quantity": 1, "warehouse_id": wh["id"]}]},
        headers=headers,
    )
    assert r2.status_code == 400
    assert "inactif" in r2.json()["error"]["message"]

    # 3. Stock-tracked product without source warehouse rejected
    r3 = client.post(
        "/api/v1/sales",
        json={"customer_id": customer["id"], "items": [{"product_id": prod_stock["id"], "quantity": 1}]},
        headers=headers,
    )
    assert r3.status_code == 400
    assert "dépôt source" in r3.json()["error"]["message"]


def test_numeric_field_validations(client: TestClient):
    headers = get_auth_header(client)
    customer, _, _, _, prod_non_stock, _, _ = create_prerequisites(client, headers)

    # 1. Quantity <= 0
    r1 = client.post(
        "/api/v1/sales",
        json={"customer_id": customer["id"], "items": [{"product_id": prod_non_stock["id"], "quantity": 0}]},
        headers=headers,
    )
    assert r1.status_code in (400, 422)

    # 2. Negative price
    r2 = client.post(
        "/api/v1/sales",
        json={"customer_id": customer["id"], "items": [{"product_id": prod_non_stock["id"], "quantity": 1, "unit_price_ht": -100}]},
        headers=headers,
    )
    assert r2.status_code in (400, 422)

    # 3. Negative discount
    r3 = client.post(
        "/api/v1/sales",
        json={"customer_id": customer["id"], "items": [{"product_id": prod_non_stock["id"], "quantity": 1, "discount_rate": -5}]},
        headers=headers,
    )
    assert r3.status_code in (400, 422)

    # 4. Discount > 100
    r4 = client.post(
        "/api/v1/sales",
        json={"customer_id": customer["id"], "items": [{"product_id": prod_non_stock["id"], "quantity": 1, "discount_rate": 105}]},
        headers=headers,
    )
    assert r4.status_code in (400, 422)


def test_duplicate_reference_rejected(client: TestClient):
    headers = get_auth_header(client)
    customer, _, _, _, prod_non_stock, _, _ = create_prerequisites(client, headers)

    r1 = client.post(
        "/api/v1/sales",
        json={"reference": "VTE-UNIQUE-REF", "customer_id": customer["id"], "items": [{"product_id": prod_non_stock["id"], "quantity": 1}]},
        headers=headers,
    )
    assert r1.status_code == 201

    r2 = client.post(
        "/api/v1/sales",
        json={"reference": "VTE-UNIQUE-REF", "customer_id": customer["id"], "items": [{"product_id": prod_non_stock["id"], "quantity": 2}]},
        headers=headers,
    )
    assert r2.status_code == 409
    assert "existe déjà" in r2.json()["error"]["message"]


def test_confirm_sale_with_stock_validation_and_deduction(client: TestClient):
    headers = get_auth_header(client)
    customer, _, _, prod_stock, prod_non_stock, _, wh = create_prerequisites(client, headers)

    # 1. Add initial stock: 10 units in warehouse using /adjustments
    stock_add_res = client.post(
        "/api/v1/stock/adjustments",
        json={
            "product_id": prod_stock["id"],
            "warehouse_id": wh["id"],
            "new_quantity": 10.00,
            "reason": "Stock initial pour test vente",
        },
        headers=headers,
    )
    assert stock_add_res.status_code == 200

    # 2. Create Sale requesting 4 units of stock product (from wh) and 3 units of non-stock product
    sale_res = client.post(
        "/api/v1/sales",
        json={
            "customer_id": customer["id"],
            "items": [
                {"product_id": prod_stock["id"], "warehouse_id": wh["id"], "quantity": 4},
                {"product_id": prod_non_stock["id"], "quantity": 3},
            ],
        },
        headers=headers,
    )
    assert sale_res.status_code == 201
    sale_id = sale_res.json()["id"]

    # 3. Confirm Sale
    confirm_res = client.post(f"/api/v1/sales/{sale_id}/confirm", headers=headers)
    assert confirm_res.status_code == 200, f"Confirm sale failed: {confirm_res.text}"
    confirmed_sale = confirm_res.json()
    assert confirmed_sale["status"] == "CONFIRMED"

    # 4. Verify stock decreased by 4 (from 10 to 6)
    balance_res = client.get(f"/api/v1/stock/balance?product_id={prod_stock['id']}&warehouse_id={wh['id']}", headers=headers)
    assert balance_res.status_code == 200
    assert float(balance_res.json()["quantity"]) == 6.00

    # 5. Verify SALE stock movement was created with warehouse_id
    movements_res = client.get(f"/api/v1/stock/movements?product_id={prod_stock['id']}&warehouse_id={wh['id']}", headers=headers)
    assert movements_res.status_code == 200
    movements = movements_res.json()
    sale_movements = [m for m in movements if m["movement_type"] == "SALE"]
    assert len(sale_movements) >= 1
    assert float(sale_movements[0]["quantity"]) == 4.00
    assert sale_movements[0]["warehouse_id"] == wh["id"]
    assert sale_movements[0]["reference_type"] == "SALE"
    assert sale_movements[0]["reference_id"] == sale_id


def test_confirm_sale_insufficient_stock_rejected(client: TestClient):
    headers = get_auth_header(client)
    customer, _, _, prod_stock, _, _, wh = create_prerequisites(client, headers)

    # 1. Add 5 units in warehouse
    client.post(
        "/api/v1/stock/adjustments",
        json={
            "product_id": prod_stock["id"],
            "warehouse_id": wh["id"],
            "new_quantity": 5.00,
            "reason": "Stock 5 unités",
        },
        headers=headers,
    )

    # 2. Attempt to create Sale requesting 10 units (more than 5 available in wh) -> rejected
    sale_res = client.post(
        "/api/v1/sales",
        json={
            "customer_id": customer["id"],
            "items": [{"product_id": prod_stock["id"], "warehouse_id": wh["id"], "quantity": 10}],
        },
        headers=headers,
    )
    assert sale_res.status_code == 400
    assert "Stock insuffisant" in sale_res.json()["error"]["message"]


def test_confirm_sale_non_stock_product_accepted_without_stock(client: TestClient):
    headers = get_auth_header(client)
    customer, _, _, _, prod_non_stock, _, _ = create_prerequisites(client, headers)

    # Create sale with only non-stock product (warehouse optional)
    sale_res = client.post(
        "/api/v1/sales",
        json={
            "customer_id": customer["id"],
            "items": [{"product_id": prod_non_stock["id"], "quantity": 15}],
        },
        headers=headers,
    )
    assert sale_res.status_code == 201
    sale_id = sale_res.json()["id"]

    # Confirm sale -> should succeed smoothly without requiring stock balance
    confirm_res = client.post(f"/api/v1/sales/{sale_id}/confirm", headers=headers)
    assert confirm_res.status_code == 200
    assert confirm_res.json()["status"] == "CONFIRMED"


def test_cancel_and_delete_sale(client: TestClient):
    headers = get_auth_header(client)
    customer, _, _, _, prod_non_stock, _, _ = create_prerequisites(client, headers)

    # 1. Create Draft Sale
    sale_res = client.post(
        "/api/v1/sales",
        json={
            "customer_id": customer["id"],
            "items": [{"product_id": prod_non_stock["id"], "quantity": 2}],
        },
        headers=headers,
    )
    sale_id = sale_res.json()["id"]

    # 2. Cancel Draft Sale
    cancel_res = client.post(f"/api/v1/sales/{sale_id}/cancel", headers=headers)
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "CANCELLED"

    # 3. Delete Cancelled Sale
    del_res = client.delete(f"/api/v1/sales/{sale_id}", headers=headers)
    assert del_res.status_code == 204

    # 4. Verify 404 on get
    get_res = client.get(f"/api/v1/sales/{sale_id}", headers=headers)
    assert get_res.status_code == 404


def test_sales_rbac_comptable_and_unauthorized(client: TestClient):
    admin_headers = get_auth_header(client)
    customer, _, _, _, prod_non_stock, _, _ = create_prerequisites(client, admin_headers)

    # Get roles from API
    roles_res = client.get("/api/v1/roles", headers=admin_headers).json()
    comp_role = next(r for r in roles_res if r["name"] == "COMPTABLE")
    user_role = next(r for r in roles_res if r["name"] == "USER")

    # 1. Create a COMPTABLE user
    comp_user_res = client.post(
        "/api/v1/users",
        json={
            "email": "comptable.sales@pesage2000.ma",
            "password": "Password123!",
            "first_name": "Karim",
            "last_name": "Comptable",
            "is_active": True,
            "role_ids": [comp_role["id"]],
        },
        headers=admin_headers,
    )
    assert comp_user_res.status_code == 201

    # Login as COMPTABLE
    comp_headers = get_auth_header(client, email="comptable.sales@pesage2000.ma", password="Password123!")

    # COMPTABLE should be able to create sales
    sale_res = client.post(
        "/api/v1/sales",
        json={
            "customer_id": customer["id"],
            "items": [{"product_id": prod_non_stock["id"], "quantity": 1}],
        },
        headers=comp_headers,
    )
    assert sale_res.status_code == 201

    # COMPTABLE should be able to list sales
    list_res = client.get("/api/v1/sales", headers=comp_headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) >= 1

    # 2. Create standard USER without sales permissions
    user_res = client.post(
        "/api/v1/users",
        json={
            "email": "basic.user@pesage2000.ma",
            "password": "Password123!",
            "first_name": "Basic",
            "last_name": "User",
            "is_active": True,
            "role_ids": [user_role["id"]],
        },
        headers=admin_headers,
    )
    assert user_res.status_code == 201

    # Login as basic USER
    user_headers = get_auth_header(client, email="basic.user@pesage2000.ma", password="Password123!")

    # Basic USER cannot list or create sales
    r_unauth = client.get("/api/v1/sales", headers=user_headers)
    assert r_unauth.status_code == 403

    r_unauth_create = client.post(
        "/api/v1/sales",
        json={"customer_id": customer["id"], "items": [{"product_id": prod_non_stock["id"], "quantity": 1}]},
        headers=user_headers,
    )
    assert r_unauth_create.status_code == 403


def test_dashboard_sales_stats_integration(client: TestClient):
    headers = get_auth_header(client)
    customer, _, _, prod_stock, _, _, wh = create_prerequisites(client, headers)

    # Add stock
    client.post(
        "/api/v1/stock/adjustments",
        json={
            "product_id": prod_stock["id"],
            "warehouse_id": wh["id"],
            "new_quantity": 20.00,
            "reason": "Stock pour test dashboard",
        },
        headers=headers,
    )

    # 1. Create a draft sale
    client.post(
        "/api/v1/sales",
        json={
            "customer_id": customer["id"],
            "items": [{"product_id": prod_stock["id"], "warehouse_id": wh["id"], "quantity": 2, "unit_price_ht": 1000}],
        },
        headers=headers,
    )

    # 2. Create and confirm a second sale
    s2 = client.post(
        "/api/v1/sales",
        json={
            "customer_id": customer["id"],
            "items": [{"product_id": prod_stock["id"], "warehouse_id": wh["id"], "quantity": 3, "unit_price_ht": 1000}],
        },
        headers=headers,
    ).json()
    client.post(f"/api/v1/sales/{s2['id']}/confirm", headers=headers)

    # 3. Fetch Dashboard Stats
    dash_res = client.get("/api/v1/dashboard/stats", headers=headers)
    assert dash_res.status_code == 200
    stats = dash_res.json()

    assert "sales" in stats and stats["sales"] is not None
    sales_kpis = stats["sales"]
    assert sales_kpis["total_orders"] == 2
    assert sales_kpis["draft_orders"] == 1
    assert sales_kpis["confirmed_orders"] == 1
    assert sales_kpis["total_subtotal_ht"] > 0
    assert sales_kpis["total_ttc"] > 0

    # Recent activity must have sale items
    recent_sales = [a for a in stats["recent_activity"] if a["type"] == "sale"]
    assert len(recent_sales) >= 1


def test_sales_source_warehouse_multi_depot_scenario(client: TestClient):
    """
    BUSINESS RULE VERIFICATION (User Prompt Section 13):
    Product PROD01:
      MAG01 = 800
      MAG02 = 200

    1. Create sale: PROD01, MAG02, 50
       Confirm sale
       Expected: MAG01 = 800, MAG02 = 150

    2. Create sale: PROD01, MAG01, 100
       Confirm sale
       Expected: MAG01 = 700, MAG02 = 150

    3. Test invalid: PROD01, MAG02, 500
       Expected: Rejected with "Stock insuffisant. Disponible : 150"
    """
    headers = get_auth_header(client)

    # 1. Create Customer
    customer = client.post(
        "/api/v1/partners",
        json={
            "code": "CLI-MULTI-WH",
            "legal_name": "Client Multi Dépôt SARL",
            "partner_type": "CUSTOMER",
            "is_active": True,
        },
        headers=headers,
    ).json()

    # 2. Create Warehouses: MAG01 and MAG02
    mag01 = client.post(
        "/api/v1/warehouses",
        json={
            "code": "MAG01",
            "name": "Dépôt principal",
            "type": "MAIN",
            "is_active": True,
        },
        headers=headers,
    ).json()

    mag02 = client.post(
        "/api/v1/warehouses",
        json={
            "code": "MAG02",
            "name": "Atelier Casablanca",
            "type": "WORKSHOP",
            "is_active": True,
        },
        headers=headers,
    ).json()

    # 3. Create Product PROD01
    cat = client.post("/api/v1/categories", json={"name": "Armoires Électriques", "code": "ARM"}, headers=headers).json()
    pt = client.post("/api/v1/product-types", json={"name": "Équipement Pesage", "code": "EQP"}, headers=headers).json()
    u = client.post("/api/v1/units", json={"name": "Unité", "abbreviation": "U"}, headers=headers).json()

    prod01 = client.post(
        "/api/v1/products",
        json={
            "sku": "PROD01",
            "designation": "Armoire électrique de pesage",
            "category_id": cat["id"],
            "product_type_id": pt["id"],
            "unit_id": u["id"],
            "purchase_price": 2000.00,
            "sale_price": 3500.00,
            "tax_rate": 20.00,
            "is_active": True,
            "track_stock": True,
        },
        headers=headers,
    ).json()

    # 4. Set Initial Balances: MAG01 = 800, MAG02 = 200
    r_adj1 = client.post(
        "/api/v1/stock/adjustments",
        json={
            "product_id": prod01["id"],
            "warehouse_id": mag01["id"],
            "new_quantity": 800.00,
            "reason": "Stock initial MAG01",
        },
        headers=headers,
    )
    assert r_adj1.status_code == 200

    r_adj2 = client.post(
        "/api/v1/stock/adjustments",
        json={
            "product_id": prod01["id"],
            "warehouse_id": mag02["id"],
            "new_quantity": 200.00,
            "reason": "Stock initial MAG02",
        },
        headers=headers,
    )
    assert r_adj2.status_code == 200

    # 5. Check initial balances
    b_mag01 = client.get(f"/api/v1/stock/balance?product_id={prod01['id']}&warehouse_id={mag01['id']}", headers=headers).json()
    b_mag02 = client.get(f"/api/v1/stock/balance?product_id={prod01['id']}&warehouse_id={mag02['id']}", headers=headers).json()
    assert float(b_mag01["quantity"]) == 800.00
    assert float(b_mag02["quantity"]) == 200.00

    # 6. Step 1: Create sale PROD01 from MAG02 for quantity 50
    s1 = client.post(
        "/api/v1/sales",
        json={
            "reference": "VTE-MAG02-001",
            "customer_id": customer["id"],
            "items": [
                {
                    "product_id": prod01["id"],
                    "warehouse_id": mag02["id"],
                    "quantity": 50,
                    "unit_price_ht": 3500.00,
                }
            ],
        },
        headers=headers,
    )
    assert s1.status_code == 201
    s1_id = s1.json()["id"]

    # Confirm sale 1
    conf1 = client.post(f"/api/v1/sales/{s1_id}/confirm", headers=headers)
    assert conf1.status_code == 200
    assert conf1.json()["status"] == "CONFIRMED"

    # Verify: MAG01 = 800, MAG02 = 150
    b_mag01 = client.get(f"/api/v1/stock/balance?product_id={prod01['id']}&warehouse_id={mag01['id']}", headers=headers).json()
    b_mag02 = client.get(f"/api/v1/stock/balance?product_id={prod01['id']}&warehouse_id={mag02['id']}", headers=headers).json()
    assert float(b_mag01["quantity"]) == 800.00, "MAG01 stock must remain untouched at 800"
    assert float(b_mag02["quantity"]) == 150.00, "MAG02 stock must decrease from 200 to 150"

    # 7. Step 2: Create sale PROD01 from MAG01 for quantity 100
    s2 = client.post(
        "/api/v1/sales",
        json={
            "reference": "VTE-MAG01-002",
            "customer_id": customer["id"],
            "items": [
                {
                    "product_id": prod01["id"],
                    "warehouse_id": mag01["id"],
                    "quantity": 100,
                    "unit_price_ht": 3500.00,
                }
            ],
        },
        headers=headers,
    )
    assert s2.status_code == 201
    s2_id = s2.json()["id"]

    # Confirm sale 2
    conf2 = client.post(f"/api/v1/sales/{s2_id}/confirm", headers=headers)
    assert conf2.status_code == 200
    assert conf2.json()["status"] == "CONFIRMED"

    # Verify: MAG01 = 700, MAG02 = 150
    b_mag01 = client.get(f"/api/v1/stock/balance?product_id={prod01['id']}&warehouse_id={mag01['id']}", headers=headers).json()
    b_mag02 = client.get(f"/api/v1/stock/balance?product_id={prod01['id']}&warehouse_id={mag02['id']}", headers=headers).json()
    assert float(b_mag01["quantity"]) == 700.00, "MAG01 stock must decrease from 800 to 700"
    assert float(b_mag02["quantity"]) == 150.00, "MAG02 stock must remain at 150"

    # 8. Step 3: Test invalid: PROD01 from MAG02 for quantity 500 (available is 150)
    s3_invalid = client.post(
        "/api/v1/sales",
        json={
            "reference": "VTE-MAG02-INVALID",
            "customer_id": customer["id"],
            "items": [
                {
                    "product_id": prod01["id"],
                    "warehouse_id": mag02["id"],
                    "quantity": 500,
                    "unit_price_ht": 3500.00,
                }
            ],
        },
        headers=headers,
    )
    assert s3_invalid.status_code == 400
    error_msg = s3_invalid.json()["error"]["message"]
    assert "Stock insuffisant. Disponible : 150" in error_msg, f"Expected French error message but got: {error_msg}"

    # Verify final stock remains exactly MAG01 = 700, MAG02 = 150
    b_mag01 = client.get(f"/api/v1/stock/balance?product_id={prod01['id']}&warehouse_id={mag01['id']}", headers=headers).json()
    b_mag02 = client.get(f"/api/v1/stock/balance?product_id={prod01['id']}&warehouse_id={mag02['id']}", headers=headers).json()
    assert float(b_mag01["quantity"]) == 700.00
    assert float(b_mag02["quantity"]) == 150.00
