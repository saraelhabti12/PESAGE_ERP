from datetime import datetime, timedelta, timezone
import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.models.credit_note_model import CreditNoteReason, CreditNoteStatus
from app.models.invoice_model import InvoiceStatus, InvoiceType
from app.models.stock_model import StockMovementType


@pytest.fixture
def auth_headers(client: TestClient):
    res = client.post(
        "/api/v1/auth/login",
        json={"email": settings.ADMIN_EMAIL, "password": settings.ADMIN_PASSWORD},
    )
    assert res.status_code == 200, f"Login failed: {res.text}"
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ----------------------------------------------------------------------
# 1. AUTOMATIC CLIENT & SUPPLIER CODES
# ----------------------------------------------------------------------
def test_automatic_partner_codes(client: TestClient, auth_headers):
    # Preview code endpoint
    res = client.get("/api/v1/partners/next-code?partner_type=CUSTOMER", headers=auth_headers)
    assert res.status_code == 200
    assert "CLI-" in res.json()["code"]

    res = client.get("/api/v1/partners/next-code?partner_type=SUPPLIER", headers=auth_headers)
    assert res.status_code == 200
    assert "FOU-" in res.json()["code"]

    # Create customer without code -> auto-generated CLI-YYYY-XXXX
    res_c = client.post(
        "/api/v1/partners",
        json={
            "legal_name": f"Société Auto Client Test {int(datetime.now().timestamp())}",
            "partner_type": "CUSTOMER",
            "email": f"autoclient_{int(datetime.now().timestamp())}@test.ma",
            "phone": "0522000001",
        },
        headers=auth_headers,
    )
    assert res_c.status_code == 201
    c_data = res_c.json()
    assert c_data["code"].startswith("CLI-")

    # Create supplier without code -> auto-generated FOU-YYYY-XXXX
    res_s = client.post(
        "/api/v1/partners",
        json={
            "legal_name": f"Société Auto Fournisseur Test {int(datetime.now().timestamp())}",
            "partner_type": "SUPPLIER",
            "email": f"autofournisseur_{int(datetime.now().timestamp())}@test.ma",
            "phone": "0522000002",
        },
        headers=auth_headers,
    )
    assert res_s.status_code == 201
    s_data = res_s.json()
    assert s_data["code"].startswith("FOU-")


# ----------------------------------------------------------------------
# 2. INVOICE DUE DATE & PAYMENT TERMS CALCULATION
# ----------------------------------------------------------------------
def test_invoice_due_date_calculation(client: TestClient, auth_headers):
    # Create customer
    c_res = client.post(
        "/api/v1/partners",
        json={"legal_name": f"Client Conditions Test {int(datetime.now().timestamp())}", "partner_type": "CUSTOMER"},
        headers=auth_headers,
    )
    cust_id = c_res.json()["id"]

    # Test 60 days
    now = datetime.now(timezone.utc)
    inv_res = client.post(
        "/api/v1/invoices",
        json={
            "customer_id": cust_id,
            "invoice_type": "CUSTOMER",
            "payment_terms": "60 jours",
            "invoice_date": now.isoformat(),
            "items": [
                {
                    "description": "Prestation de pesage",
                    "quantity": 1,
                    "unit_price_ht": 1000.0,
                    "tax_rate": 20.0,
                }
            ],
        },
        headers=auth_headers,
    )
    assert inv_res.status_code == 201
    inv = inv_res.json()
    assert inv["total_ttc"] == 1200.0
    assert inv["amount_due"] == 1200.0

    due_dt = datetime.fromisoformat(inv["due_date"].replace("Z", "+00:00"))
    inv_dt = datetime.fromisoformat(inv["invoice_date"].replace("Z", "+00:00"))
    assert (due_dt.date() - inv_dt.date()).days in (59, 60, 61)


# ----------------------------------------------------------------------
# 3. CRITICAL BUSINESS CONSISTENCY: SALE -> DELIVERY NOTE -> CREDIT NOTE + STOCK RETURN
# ----------------------------------------------------------------------
def test_critical_sale_delivery_credit_note_stock_flow(client: TestClient, auth_headers):
    """
    TEST 1:
    Sale: PROD 10 from WAREHOUSE
    After confirmation: stock = previous - 10
    Create delivery note: stock must NOT decrease again
    Create customer credit note for return quantity 2 with return_to_stock=True
    Result: stock = previous - 8
    Audit movements: SALE -10, CUSTOMER_RETURN +2.
    """
    ts = int(datetime.now().timestamp())
    # 1. Create catalog prerequisites
    cat_res = client.post("/api/v1/categories", headers=auth_headers, json={"name": f"Cat {ts}", "code": f"C{ts % 100000}"})
    cat_id = cat_res.json()["id"]

    type_res = client.post("/api/v1/product-types", headers=auth_headers, json={"name": f"Type {ts}", "code": f"T{ts % 100000}"})
    type_id = type_res.json()["id"]

    unit_res = client.post("/api/v1/units", headers=auth_headers, json={"name": f"Unité {ts}", "abbreviation": f"U{ts % 1000}"})
    unit_id = unit_res.json()["id"]

    # 2. Create warehouse
    wh_code = f"MAG-{ts % 100000}"
    wh_res = client.post(
        "/api/v1/warehouses",
        json={"code": wh_code, "name": "Magasin Principal Test", "type": "MAIN"},
        headers=auth_headers,
    )
    assert wh_res.status_code == 201
    wh_id = wh_res.json()["id"]

    # 3. Create product with stock tracking
    sku = f"PROD-AUTO-{ts}"
    p_res = client.post(
        "/api/v1/products",
        json={
            "sku": sku,
            "designation": "Balance Pese-Personne Pro",
            "category_id": cat_id,
            "product_type_id": type_id,
            "unit_id": unit_id,
            "sale_price": 500.0,
            "purchase_price": 300.0,
            "tax_rate": 20.0,
            "track_stock": True,
        },
        headers=auth_headers,
    )
    assert p_res.status_code == 201
    prod_id = p_res.json()["id"]

    # 4. Initial stock entry: +50 in warehouse
    adj_res = client.post(
        "/api/v1/stock/adjustments",
        json={
            "product_id": prod_id,
            "warehouse_id": wh_id,
            "new_quantity": 50.0,
            "reason": "Stock initial pour test",
        },
        headers=auth_headers,
    )
    assert adj_res.status_code == 200

    # Verify initial stock = 50
    b_res = client.get(f"/api/v1/stock?product_id={prod_id}&warehouse_id={wh_id}", headers=auth_headers)
    assert b_res.status_code == 200
    assert b_res.json()[0]["available_quantity"] == 50.0

    # 5. Create customer
    c_res = client.post(
        "/api/v1/partners",
        json={"legal_name": f"Client Test Stock Flow {sku}", "partner_type": "CUSTOMER"},
        headers=auth_headers,
    )
    cust_id = c_res.json()["id"]

    # 6. Create Sale of quantity 10
    sale_res = client.post(
        "/api/v1/sales",
        json={
            "customer_id": cust_id,
            "warehouse_id": wh_id,
            "items": [
                {
                    "product_id": prod_id,
                    "quantity": 10,
                    "unit_price_ht": 500.0,
                    "tax_rate": 20.0,
                    "warehouse_id": wh_id,
                }
            ],
        },
        headers=auth_headers,
    )
    assert sale_res.status_code == 201
    sale_id = sale_res.json()["id"]

    # 7. Confirm sale -> Deducts stock by 10 (Available becomes 40)
    conf_res = client.post(f"/api/v1/sales/{sale_id}/confirm", headers=auth_headers)
    assert conf_res.status_code == 200

    b_after_sale = client.get(f"/api/v1/stock?product_id={prod_id}&warehouse_id={wh_id}", headers=auth_headers).json()
    assert b_after_sale[0]["available_quantity"] == 40.0

    # 8. Create Delivery Note (BL) -> MUST NOT deduct stock again!
    bl_res = client.post(
        "/api/v1/delivery-notes",
        json={
            "sale_id": sale_id,
            "items": [
                {
                    "sale_item_id": conf_res.json()["items"][0]["id"],
                    "product_id": prod_id,
                    "warehouse_id": wh_id,
                    "delivered_quantity": 10.0,
                }
            ],
        },
        headers=auth_headers,
    )
    assert bl_res.status_code == 201

    # Verify stock is STILL 40.0 (zero double deduction!)
    b_after_bl = client.get(f"/api/v1/stock?product_id={prod_id}&warehouse_id={wh_id}", headers=auth_headers).json()
    assert b_after_bl[0]["available_quantity"] == 40.0

    # 9. Create Customer Invoice from Sale
    inv_res = client.post("/api/v1/invoices/from-sale", json={"sale_id": sale_id}, headers=auth_headers)
    assert inv_res.status_code == 201
    invoice = inv_res.json()
    invoice_id = invoice["id"]
    assert invoice["total_ttc"] == 6000.0  # 10 * 500 * 1.20 = 6000 DH

    # 10. Register Partial Payment of 4000 DH
    pay_res = client.post(
        "/api/v1/payments",
        json={
            "invoice_id": invoice_id,
            "amount": 4000.0,
            "payment_method": "Virement bancaire",
        },
        headers=auth_headers,
    )
    assert pay_res.status_code == 201

    # Check invoice status: amount_paid=4000, amount_due=2000, status=PARTIALLY_PAID
    inv_check = client.get(f"/api/v1/invoices/{invoice_id}", headers=auth_headers).json()
    assert inv_check["amount_paid"] == 4000.0
    assert inv_check["amount_due"] == 2000.0
    assert inv_check["status"] == "PARTIALLY_PAID"

    # 11. Customer returns 2 items -> Issue Credit Note with return_to_stock=True
    inv_item_id = invoice["items"][0]["id"]
    cn_res = client.post(
        "/api/v1/credit-notes",
        json={
            "invoice_id": invoice_id,
            "reason": "RETURN",
            "items": [
                {
                    "product_id": prod_id,
                    "invoice_item_id": inv_item_id,
                    "warehouse_id": wh_id,
                    "description": "Retour 2 balances",
                    "quantity": 2,
                    "unit_price_ht": 500.0,
                    "tax_rate": 20.0,
                    "return_to_stock": True,
                }
            ],
        },
        headers=auth_headers,
    )
    assert cn_res.status_code == 201
    cn = cn_res.json()
    assert cn["total_ttc"] == 1200.0  # 2 * 500 * 1.20 = 1200 DH

    # Verify invoice updated due amount: 6000 - 4000 (paid) - 1200 (credit note) = 800 DH
    inv_after_cn = client.get(f"/api/v1/invoices/{invoice_id}", headers=auth_headers).json()
    assert inv_after_cn["amount_due"] == 800.0

    # 12. Verify Stock increased from 40 to 42 (previous - 8 = 42)!
    b_after_return = client.get(f"/api/v1/stock?product_id={prod_id}&warehouse_id={wh_id}", headers=auth_headers).json()
    assert b_after_return[0]["available_quantity"] == 42.0


# ----------------------------------------------------------------------
# 4. RECURRING EXPENSES IDEMPOTENCY
# ----------------------------------------------------------------------
def test_recurring_expense_generation_idempotency(client: TestClient, auth_headers):
    # Ensure categories exist
    cats = client.get("/api/v1/expenses/categories", headers=auth_headers).json()
    assert len(cats) > 0
    cat_id = cats[0]["id"]

    # Create monthly recurring expense of 500 DH
    now = datetime.now(timezone.utc)
    rec_res = client.post(
        "/api/v1/expenses/recurring",
        json={
            "category_id": cat_id,
            "label": f"Abonnement Fibre Pro {int(now.timestamp())}",
            "amount": 500.0,
            "frequency": "MONTHLY",
            "start_date": (now - timedelta(days=5)).isoformat(),
            "day_of_month": 1,
        },
        headers=auth_headers,
    )
    assert rec_res.status_code == 201

    # First generation run -> generates expenses
    gen1 = client.post("/api/v1/expenses/generate-recurring", headers=auth_headers).json()
    assert gen1["status"] == "ok"
    assert gen1["generated_count"] >= 1

    # Second generation run in same month -> generates 0 (idempotent!)
    gen2 = client.post("/api/v1/expenses/generate-recurring", headers=auth_headers).json()
    assert gen2["status"] == "ok"
    assert gen2["generated_count"] == 0


# ----------------------------------------------------------------------
# 5. VEHICLE, MAINTENANCE, FUEL & STATS
# ----------------------------------------------------------------------
def test_vehicle_maintenance_fuel_and_statistics(client: TestClient, auth_headers):
    # Create employee as driver
    emp_res = client.post(
        "/api/v1/employees",
        json={
            "first_name": "Karim",
            "last_name": "Chraibi",
            "job_title": "Chauffeur / Livreur",
            "department": "Logistique",
        },
        headers=auth_headers,
    )
    assert emp_res.status_code == 201
    driver_id = emp_res.json()["id"]

    # Create vehicle
    reg_num = f"{int(datetime.now().timestamp()) % 1000000}-A-1"
    v_res = client.post(
        "/api/v1/vehicles",
        json={
            "registration_number": reg_num,
            "brand": "Renault",
            "model": "Master Fourgon",
            "current_mileage": 50000.0,
            "fuel_type": "DIESEL",
            "default_driver_id": driver_id,
        },
        headers=auth_headers,
    )
    assert v_res.status_code == 201
    veh_id = v_res.json()["id"]
    assert v_res.json()["vehicle_code"].startswith("VH-")

    # Add Maintenance: 1200 DH total
    m_res = client.post(
        "/api/v1/vehicles/maintenances",
        json={
            "vehicle_id": veh_id,
            "mileage": 52000.0,
            "maintenance_type": "OIL_CHANGE",
            "description": "Vidange complète filtres",
            "labor_cost": 400.0,
            "parts_cost": 800.0,
        },
        headers=auth_headers,
    )
    assert m_res.status_code == 201
    assert m_res.json()["total_cost"] == 1200.0

    # Add Fuel Log: 60 Liters @ 11.40 DH = 684.00 DH
    f_res = client.post(
        "/api/v1/vehicles/fuel",
        json={
            "vehicle_id": veh_id,
            "mileage": 52500.0,
            "liters": 60.0,
            "price_per_liter": 11.40,
            "driver_id": driver_id,
        },
        headers=auth_headers,
    )
    assert f_res.status_code == 201
    assert f_res.json()["total_cost"] == 684.0

    # Verify vehicle stats: total_expenses = 1200 + 684 = 1884 DH
    stats_res = client.get(f"/api/v1/vehicles/statistics?vehicle_id={veh_id}", headers=auth_headers)
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["total_vehicle_expenses"] == 1884.0
    assert stats["maintenance_cost_month"] == 1200.0
    assert stats["fuel_cost_month"] == 684.0


# ----------------------------------------------------------------------
# 6. EXCEL EXPORTS
# ----------------------------------------------------------------------
def test_excel_export_endpoints(client: TestClient, auth_headers):
    endpoints = [
        "/api/v1/exports/customers",
        "/api/v1/exports/suppliers",
        "/api/v1/exports/products",
        "/api/v1/exports/quotes",
        "/api/v1/exports/sales",
        "/api/v1/exports/purchases",
        "/api/v1/exports/invoices/customers",
        "/api/v1/exports/invoices/suppliers",
        "/api/v1/exports/credit-notes",
        "/api/v1/exports/payments",
        "/api/v1/exports/stock",
        "/api/v1/exports/stock/movements",
        "/api/v1/exports/expenses",
        "/api/v1/exports/vehicles",
        "/api/v1/exports/vehicles/maintenances",
    ]

    for ep in endpoints:
        res = client.get(ep, headers=auth_headers)
        assert res.status_code == 200, f"Export failed for {ep}: {res.status_code}"
        assert res.headers["content-type"] == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        assert len(res.content) > 100
