import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.models.partner_model import PartnerType


def test_full_application_client_lifecycle():
    client = TestClient(app)

    # 1. Login as Admin
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": "admin@example.com", "password": "CHANGE_THIS_PASSWORD"},
    )
    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Setup Category, Brand, Unit, Warehouse, and Product
    cat_res = client.post(
        "/api/v1/categories",
        json={"name": "Informatique & Balances", "code": "CAT-INFO"},
        headers=headers,
    )
    cat_id = cat_res.json()["id"] if cat_res.status_code == 201 else client.get("/api/v1/categories", headers=headers).json()[0]["id"]

    brand_res = client.post(
        "/api/v1/brands",
        json={"name": "Pesage Pro", "code": "BR-PES"},
        headers=headers,
    )
    brand_id = brand_res.json()["id"] if brand_res.status_code == 201 else client.get("/api/v1/brands", headers=headers).json()[0]["id"]

    unit_res = client.post(
        "/api/v1/units",
        json={"name": "Unité", "abbreviation": "U"},
        headers=headers,
    )
    unit_id = unit_res.json()["id"] if unit_res.status_code == 201 else client.get("/api/v1/units", headers=headers).json()[0]["id"]

    pt_res = client.post(
        "/api/v1/product-types",
        json={"name": "Matériel de Pesage", "code": "PT-PES"},
        headers=headers,
    )
    pt_id = pt_res.json()["id"] if pt_res.status_code == 201 else client.get("/api/v1/product-types", headers=headers).json()[0]["id"]

    wh_res = client.post(
        "/api/v1/warehouses",
        json={"name": "Dépôt Principal Casablanca", "code": "DEP-CASA"},
        headers=headers,
    )
    wh_id = wh_res.json()["id"] if wh_res.status_code == 201 else client.get("/api/v1/warehouses", headers=headers).json()[0]["id"]

    ts = int(datetime.now(timezone.utc).timestamp())
    prod_res = client.post(
        "/api/v1/products",
        json={
            "sku": f"BAL-IND-{ts}",
            "designation": f"Balance Industrielle 500kg #{ts}",
            "category_id": cat_id,
            "product_type_id": pt_id,
            "brand_id": brand_id,
            "unit_id": unit_id,
            "sale_price": 2500.00,
            "purchase_price": 1800.00,
            "tax_rate": 20.0,
            "track_stock": True,
        },
        headers=headers,
    )
    assert prod_res.status_code == 201, f"Product create failed: {prod_res.text}"
    product_id = prod_res.json()["id"]

    # Initial stock entry
    client.post(
        "/api/v1/stock/adjustments",
        json={
            "product_id": product_id,
            "warehouse_id": wh_id,
            "new_quantity": 50,
            "reason": "Stock initial pour test cycle complet",
        },
        headers=headers,
    )

    # 3. Create NEW Client (as CUSTOMER_SUPPLIER hybrid partner)
    cust_res = client.post(
        "/api/v1/partners",
        json={
            "legal_name": f"Atlas Industries SARL {ts}",
            "trade_name": "Atlas Ind",
            "code": f"CLI-ATLAS-{ts}",
            "partner_type": "CUSTOMER_SUPPLIER",
            "ice": f"{ts}00001",
            "email": f"contact{ts}@atlas-industries.ma",
            "phone": "+212522000000",
            "city": "Casablanca",
            "country": "Maroc",
        },
        headers=headers,
    )
    assert cust_res.status_code == 201, f"Customer create failed: {cust_res.text}"
    customer_data = cust_res.json()
    customer_id = customer_data["id"]

    # 4. Verify client visibility across lookup endpoints
    # 4a. /customers
    res = client.get("/api/v1/customers", headers=headers)
    assert any(c["id"] == customer_id for c in res.json()), "Client missing in /customers"

    # 4b. /partners?partner_type=CUSTOMER
    res = client.get("/api/v1/partners?partner_type=CUSTOMER", headers=headers)
    assert any(c["id"] == customer_id for c in res.json()), "Client missing in /partners?partner_type=CUSTOMER"

    # 5. Create Devis (Quote) for this client
    quote_res = client.post(
        "/api/v1/quotes",
        json={
            "customer_id": customer_id,
            "quote_date": datetime.now(timezone.utc).isoformat(),
            "items": [
                {
                    "product_id": product_id,
                    "quantity": 2,
                    "unit_price_ht": 2500.00,
                    "tax_rate": 20.0,
                    "discount_rate": 0.0,
                }
            ],
        },
        headers=headers,
    )
    assert quote_res.status_code == 201, f"Quote create failed: {quote_res.text}"
    quote_id = quote_res.json()["id"]

    # 6. Convert Quote to Sale Order
    conv_res = client.post(f"/api/v1/quotes/{quote_id}/convert-to-sale", headers=headers)
    assert conv_res.status_code in (200, 201), f"Convert quote failed: {conv_res.text}"
    sale_id = conv_res.json()["id"]

    # Confirm Sale Order
    client.post(f"/api/v1/sales/{sale_id}/confirm", headers=headers)

    # 7. Create and Validate Delivery Note (BL)
    bl_res = client.post(
        "/api/v1/delivery-notes",
        json={
            "sale_id": sale_id,
            "items": [
                {
                    "product_id": product_id,
                    "delivered_quantity": 2,
                    "warehouse_id": wh_id,
                }
            ],
        },
        headers=headers,
    )
    assert bl_res.status_code == 201, f"Delivery note create failed: {bl_res.text}"
    bl_id = bl_res.json()["id"]

    # 8. Create Customer Invoice from Sale
    inv_res = client.post(
        "/api/v1/invoices/from-sale",
        json={"sale_id": sale_id, "payment_terms": "30_DAYS"},
        headers=headers,
    )
    assert inv_res.status_code == 201, f"Invoice create failed: {inv_res.text}"
    invoice = inv_res.json()
    invoice_id = invoice["id"]
    assert invoice["customer_id"] == customer_id
    assert invoice["total_ttc"] == 6000.00  # 2 * 2500 * 1.20 = 6000.00

    # 9. Create Credit Note (Avoir) on Invoice with reason PRICE_CORRECTION & DEFECTIVE_PRODUCT
    inv_item = invoice["items"][0]
    cn_res = client.post(
        "/api/v1/credit-notes",
        json={
            "invoice_id": invoice_id,
            "reason": "PRICE_CORRECTION",
            "notes": "Remise rétroactive accordée sur balance",
            "items": [
                {
                    "invoice_item_id": inv_item["id"],
                    "product_id": product_id,
                    "warehouse_id": wh_id,
                    "description": "Correction tarifaire - Balance",
                    "quantity": 1,
                    "unit_price_ht": 500.00,
                    "tax_rate": 20.0,
                    "discount_rate": 0.0,
                    "return_to_stock": False,
                }
            ],
        },
        headers=headers,
    )
    assert cn_res.status_code == 201, f"Credit note create failed: {cn_res.text}"
    cn_data = cn_res.json()
    assert cn_data["customer_id"] == customer_id
    assert cn_data["reason"] == "PRICE_CORRECTION"
    assert cn_data["total_ttc"] == 600.00

    # Verify Invoice amount_due updated (6000 - 600 = 5400)
    updated_inv = client.get(f"/api/v1/invoices/{invoice_id}", headers=headers).json()
    assert abs(updated_inv["amount_due"] - 5400.00) < 0.01

    # 10. Test GET /credit-notes filtering
    cn_list = client.get(f"/api/v1/credit-notes?customer_id={customer_id}", headers=headers).json()
    assert len(cn_list) >= 1
    assert cn_list[0]["id"] == cn_data["id"]

    # Test filtering by reason
    cn_filtered = client.get("/api/v1/credit-notes?reason=PRICE_CORRECTION", headers=headers).json()
    assert any(c["id"] == cn_data["id"] for c in cn_filtered)

    # 11. Payment for the remaining invoice balance
    pay_res = client.post(
        "/api/v1/payments",
        json={
            "invoice_id": invoice_id,
            "amount": 5400.00,
            "payment_method": "VIREMENT",
            "payment_date": datetime.now(timezone.utc).isoformat(),
        },
        headers=headers,
    )
    assert pay_res.status_code == 201, f"Payment failed: {pay_res.text}"

    # 12. Register Client Equipment & Maintenance Intervention
    eq_res = client.post(
        "/api/v1/maintenance/equipments",
        json={
            "customer_id": customer_id,
            "designation": "Pont-Bascule Atlas 60T",
            "serial_number": f"PB-ATLAS-{ts}",
            "model": "PB-60",
            "status": "OPERATIONAL",
        },
        headers=headers,
    )
    assert eq_res.status_code == 201, f"Equipment failed: {eq_res.text}"
    equipment_id = eq_res.json()["id"]

    interv_res = client.post(
        "/api/v1/maintenance/interventions",
        json={
            "customer_id": customer_id,
            "equipment_id": equipment_id,
            "problem_description": "Étalonnage Périodique Pont-Bascule",
            "intervention_type": "CALIBRATION",
            "priority": "HIGH",
        },
        headers=headers,
    )
    assert interv_res.status_code == 201, f"Intervention failed: {interv_res.text}"

    # 13. Customer 360 Overview
    summary_res = client.get(f"/api/v1/partners/{customer_id}/summary", headers=headers)
    assert summary_res.status_code == 200, f"Customer 360 failed: {summary_res.text}"
    summary = summary_res.json()
    assert summary["partner_id"] == customer_id
    assert summary["total_quotes"] == 1
    assert summary["total_sales"] == 1
    assert summary["total_delivery_notes"] == 1
    assert summary["total_invoices"] == 1
    assert summary["total_credit_notes"] == 1
    assert summary["total_equipments"] == 1
    assert summary["total_interventions"] == 1
