import pytest
from fastapi.testclient import TestClient
from app.core.config import settings


def get_admin_headers(client: TestClient):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": settings.ADMIN_EMAIL, "password": settings.ADMIN_PASSWORD},
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def setup_customer_and_product(client: TestClient, headers: dict):
    # Create category
    cat_res = client.post(
        "/api/v1/categories",
        headers=headers,
        json={"name": "Balances Industrielles", "code": "BAL-IND"},
    )
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["id"]

    # Create product type
    type_res = client.post(
        "/api/v1/product-types",
        headers=headers,
        json={"name": "Matériel de Pesage", "code": "MAT-PES"},
    )
    assert type_res.status_code == 201
    type_id = type_res.json()["id"]

    # Create unit
    unit_res = client.post(
        "/api/v1/units",
        headers=headers,
        json={"name": "Unité", "abbreviation": "U"},
    )
    assert unit_res.status_code == 201
    unit_id = unit_res.json()["id"]

    # Create warehouse
    wh_res = client.post(
        "/api/v1/warehouses",
        headers=headers,
        json={"name": "Dépôt Central Pesage", "code": "DEP-CENTRAL", "type": "MAIN"},
    )
    assert wh_res.status_code == 201
    wh_id = wh_res.json()["id"]

    # Create tracked product
    prod_res = client.post(
        "/api/v1/products",
        headers=headers,
        json={
            "sku": "PES-IND-500",
            "designation": "Indicateur de Pesage IP68 500kg",
            "category_id": cat_id,
            "product_type_id": type_id,
            "unit_id": unit_id,
            "purchase_price": 1000.0,
            "sale_price": 2000.0,
            "tax_rate": 20.0,
            "track_stock": True,
        },
    )
    assert prod_res.status_code == 201
    prod_id = prod_res.json()["id"]

    # Add initial stock in warehouse (e.g. 50 units)
    adj_res = client.post(
        "/api/v1/stock/adjustments",
        headers=headers,
        json={
            "product_id": prod_id,
            "warehouse_id": wh_id,
            "new_quantity": 50.0,
            "reason": "Initial stock setup",
        },
    )
    assert adj_res.status_code == 200

    # Create customer
    cust_res = client.post(
        "/api/v1/partners",
        headers=headers,
        json={
            "code": "CLI-ATLAS",
            "legal_name": "Société Atlas Métrologie SARL",
            "partner_type": "CUSTOMER",
            "email": "contact@atlas-metrologie.ma",
            "phone": "0522000000",
            "address": "Zone Industrielle Ain Sebaa, Casablanca",
        },
    )
    assert cust_res.status_code == 201
    cust_id = cust_res.json()["id"]

    return cust_id, prod_id, wh_id


def test_quote_crud_and_status_flow(client: TestClient):
    headers = get_admin_headers(client)
    cust_id, prod_id, wh_id = setup_customer_and_product(client, headers)

    # 1. Create Draft Quote
    create_res = client.post(
        "/api/v1/quotes",
        headers=headers,
        json={
            "customer_id": cust_id,
            "payment_terms": "30 jours",
            "items": [
                {
                    "product_id": prod_id,
                    "quantity": 5.0,
                    "unit_price_ht": 2000.0,
                    "discount_rate": 10.0,
                    "tax_rate": 20.0,
                }
            ],
        },
    )
    assert create_res.status_code == 201
    quote = create_res.json()
    assert quote["reference"].startswith("DEV-")
    assert quote["status"] == "DRAFT"
    # Gross: 5 * 2000 = 10000; Discount: 1000; HT: 9000; Tax 20%: 1800; TTC: 10800
    assert quote["subtotal_ht"] == 9000.0
    assert quote["discount_amount"] == 1000.0
    assert quote["tax_amount"] == 1800.0
    assert quote["total_ttc"] == 10800.0
    quote_id = quote["id"]

    # 2. Update Draft Quote
    upd_res = client.put(
        "/api/v1/quotes/{}".format(quote_id),
        headers=headers,
        json={"notes": "Offre spéciale rentrée"},
    )
    assert upd_res.status_code == 200
    assert upd_res.json()["notes"] == "Offre spéciale rentrée"

    # 3. Send Quote
    send_res = client.post(f"/api/v1/quotes/{quote_id}/send", headers=headers)
    assert send_res.status_code == 200
    assert send_res.json()["status"] == "SENT"

    # 4. Accept Quote
    acc_res = client.post(f"/api/v1/quotes/{quote_id}/accept", headers=headers)
    assert acc_res.status_code == 200
    assert acc_res.json()["status"] == "ACCEPTED"


def test_quote_conversion_to_sale_and_reject_duplicate(client: TestClient):
    headers = get_admin_headers(client)
    cust_id, prod_id, wh_id = setup_customer_and_product(client, headers)

    # 1. Create and accept quote
    create_res = client.post(
        "/api/v1/quotes",
        headers=headers,
        json={
            "customer_id": cust_id,
            "payment_terms": "45 jours",
            "items": [
                {
                    "product_id": prod_id,
                    "quantity": 10.0,
                    "unit_price_ht": 1800.0,
                    "discount_rate": 0.0,
                    "tax_rate": 20.0,
                }
            ],
        },
    )
    assert create_res.status_code == 201
    quote_id = create_res.json()["id"]

    # 2. Convert to Sale
    conv_res = client.post(f"/api/v1/quotes/{quote_id}/convert-to-sale", headers=headers)
    assert conv_res.status_code == 201
    sale = conv_res.json()
    assert sale["reference"].startswith("VTE-")
    assert sale["quote_id"] == quote_id
    assert sale["status"] == "DRAFT"
    assert sale["subtotal_ht"] == 18000.0
    assert len(sale["items"]) == 1
    assert sale["items"][0]["quantity"] == 10.0

    # 3. Re-converting the same quote must be rejected (400)
    dup_res = client.post(f"/api/v1/quotes/{quote_id}/convert-to-sale", headers=headers)
    assert dup_res.status_code == 400
    assert "déjà été converti" in dup_res.text


def test_full_commercial_cycle_delivery_invoice_payment(client: TestClient):
    headers = get_admin_headers(client)
    cust_id, prod_id, wh_id = setup_customer_and_product(client, headers)

    # 1. CREATE SALE
    sale_res = client.post(
        "/api/v1/sales",
        headers=headers,
        json={
            "customer_id": cust_id,
            "payment_terms": "30 jours",
            "items": [
                {
                    "product_id": prod_id,
                    "warehouse_id": wh_id,
                    "quantity": 20.0,
                    "unit_price_ht": 2000.0,
                    "discount_rate": 0.0,
                    "tax_rate": 20.0,
                }
            ],
        },
    )
    assert sale_res.status_code == 201
    sale = sale_res.json()
    sale_id = sale["id"]
    assert sale["total_ttc"] == 48000.0  # 20 * 2000 * 1.2 = 48,000

    # 2. CONFIRM SALE -> STOCK DEDUCTION
    # Check initial stock (50)
    bal_res = client.get(f"/api/v1/stock/balance?product_id={prod_id}&warehouse_id={wh_id}", headers=headers)
    assert bal_res.status_code == 200
    assert bal_res.json()["available_quantity"] == 50.0

    conf_res = client.post(f"/api/v1/sales/{sale_id}/confirm", headers=headers)
    assert conf_res.status_code == 200
    assert conf_res.json()["status"] == "CONFIRMED"

    # Verify stock deducted from 50 to 30
    bal_res = client.get(f"/api/v1/stock/balance?product_id={prod_id}&warehouse_id={wh_id}", headers=headers)
    assert bal_res.json()["available_quantity"] == 30.0

    # 3. PARTIAL DELIVERY (12 out of 20)
    dn1_res = client.post(
        "/api/v1/delivery-notes",
        headers=headers,
        json={
            "sale_id": sale_id,
            "items": [
                {
                    "product_id": prod_id,
                    "warehouse_id": wh_id,
                    "delivered_quantity": 12.0,
                }
            ],
        },
    )
    assert dn1_res.status_code == 201
    dn1 = dn1_res.json()
    assert dn1["reference"].startswith("BL-")
    assert dn1["items"][0]["ordered_quantity"] == 20.0
    assert dn1["items"][0]["delivered_quantity"] == 12.0
    assert dn1["items"][0]["remaining_quantity"] == 8.0

    # Check sale status updated to PARTIALLY_DELIVERED
    sale_check = client.get(f"/api/v1/sales/{sale_id}", headers=headers).json()
    assert sale_check["status"] == "PARTIALLY_DELIVERED"

    # CRITICAL CHECK: Delivery note did NOT touch stock (still 30)
    bal_after_dn1 = client.get(f"/api/v1/stock/balance?product_id={prod_id}&warehouse_id={wh_id}", headers=headers).json()
    assert bal_after_dn1["available_quantity"] == 30.0

    # 4. OVER-DELIVERY REJECTION (Attempt to deliver 10 when remaining is 8)
    over_deliv_res = client.post(
        "/api/v1/delivery-notes",
        headers=headers,
        json={
            "sale_id": sale_id,
            "items": [
                {
                    "product_id": prod_id,
                    "warehouse_id": wh_id,
                    "delivered_quantity": 10.0,
                }
            ],
        },
    )
    assert over_deliv_res.status_code == 400
    assert "supérieure au reste à livrer" in over_deliv_res.text

    # 5. REMAINING DELIVERY (8 out of 8)
    dn2_res = client.post(
        "/api/v1/delivery-notes",
        headers=headers,
        json={
            "sale_id": sale_id,
            "items": [
                {
                    "product_id": prod_id,
                    "warehouse_id": wh_id,
                    "delivered_quantity": 8.0,
                }
            ],
        },
    )
    assert dn2_res.status_code == 201
    dn2 = dn2_res.json()
    assert dn2["items"][0]["remaining_quantity"] == 0.0

    # Sale is now fully DELIVERED
    sale_check2 = client.get(f"/api/v1/sales/{sale_id}", headers=headers).json()
    assert sale_check2["status"] == "DELIVERED"

    # Stock is still exactly 30 (no double deduction)
    bal_after_dn2 = client.get(f"/api/v1/stock/balance?product_id={prod_id}&warehouse_id={wh_id}", headers=headers).json()
    assert bal_after_dn2["available_quantity"] == 30.0

    # 6. INVOICE CREATION FROM SALE
    inv_res = client.post(
        "/api/v1/invoices/from-sale",
        headers=headers,
        json={
            "sale_id": sale_id,
            "payment_terms": "30 jours",
        },
    )
    assert inv_res.status_code == 201
    inv = inv_res.json()
    inv_id = inv["id"]
    assert inv["reference"].startswith("FAC-")
    assert inv["status"] == "ISSUED"
    assert inv["total_ttc"] == 48000.0
    assert inv["amount_paid"] == 0.0
    assert inv["amount_due"] == 48000.0
    assert len(inv["items"]) == 1

    # Duplicate invoice for the same sale must be rejected
    dup_inv_res = client.post(
        "/api/v1/invoices/from-sale",
        headers=headers,
        json={"sale_id": sale_id},
    )
    assert dup_inv_res.status_code == 400

    # 7. RECORD PARTIAL PAYMENT (20,000 DH)
    pay1_res = client.post(
        "/api/v1/payments",
        headers=headers,
        json={
            "invoice_id": inv_id,
            "amount": 20000.0,
            "payment_method": "Virement bancaire",
            "transaction_reference": "VIR-2026-09-001",
        },
    )
    assert pay1_res.status_code == 201
    pay1 = pay1_res.json()
    assert pay1["reference"].startswith("PAY-")
    assert pay1["amount"] == 20000.0

    # Check invoice status updated to PARTIALLY_PAID
    inv_check1 = client.get(f"/api/v1/invoices/{inv_id}", headers=headers).json()
    assert inv_check1["status"] == "PARTIALLY_PAID"
    assert inv_check1["amount_paid"] == 20000.0
    assert inv_check1["amount_due"] == 28000.0

    # Overpayment rejection (attempting to pay 30,000 when due is 28,000)
    over_pay_res = client.post(
        "/api/v1/payments",
        headers=headers,
        json={
            "invoice_id": inv_id,
            "amount": 30000.0,
            "payment_method": "Chèque",
        },
    )
    assert over_pay_res.status_code == 400
    assert "dépasse le solde" in over_pay_res.text

    # 8. RECORD FINAL PAYMENT (28,000 DH)
    pay2_res = client.post(
        "/api/v1/payments",
        headers=headers,
        json={
            "invoice_id": inv_id,
            "amount": 28000.0,
            "payment_method": "Chèque",
            "transaction_reference": "CHQ-778899",
        },
    )
    assert pay2_res.status_code == 201

    # Check invoice status is now PAID
    inv_check2 = client.get(f"/api/v1/invoices/{inv_id}", headers=headers).json()
    assert inv_check2["status"] == "PAID"
    assert inv_check2["amount_paid"] == 48000.0
    assert inv_check2["amount_due"] == 0.0

    # 9. CUSTOMER FINANCIAL SUMMARY
    summary_res = client.get(f"/api/v1/payments/customer-summary/{cust_id}", headers=headers)
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["total_invoiced"] == 48000.0
    assert summary["total_paid"] == 48000.0
    assert summary["balance_due"] == 0.0
    assert summary["invoice_count"] == 1
    assert summary["unpaid_invoice_count"] == 0


def test_dashboard_commercial_cycle_metrics(client: TestClient):
    headers = get_admin_headers(client)
    res = client.get("/api/v1/dashboard/stats", headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "quotes" in data
    assert "invoices" in data
    assert "payments" in data
    assert "stock" in data
    assert "sales" in data
