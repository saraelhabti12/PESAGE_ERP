import pytest
from fastapi.testclient import TestClient
from tests.test_commercial_cycle import setup_customer_and_product, get_admin_headers


def test_canonical_customer_lookup_consistency(client: TestClient):
    headers = get_admin_headers(client)

    # 1. Create a customer with partner_type = CUSTOMER
    cust_pure_payload = {
        "code": "CLI-LOOKUP-01",
        "legal_name": "Entreprise Alpha SARL",
        "trade_name": "Alpha Maroc",
        "partner_type": "CUSTOMER",
        "is_active": True,
    }
    r = client.post("/api/v1/partners", json=cust_pure_payload, headers=headers)
    assert r.status_code in (201, 409)
    if r.status_code == 201:
        pure_cust_id = r.json()["id"]
    else:
        pure_cust_id = client.get("/api/v1/partners?search=CLI-LOOKUP-01", headers=headers).json()[0]["id"]

    # 2. Create a customer with partner_type = CUSTOMER_SUPPLIER
    cust_hybrid_payload = {
        "code": "CLI-LOOKUP-02",
        "legal_name": "Entreprise Beta Hybride SARL",
        "trade_name": "Beta Maroc",
        "partner_type": "CUSTOMER_SUPPLIER",
        "is_active": True,
    }
    r_hyb = client.post("/api/v1/partners", json=cust_hybrid_payload, headers=headers)
    assert r_hyb.status_code in (201, 409)
    if r_hyb.status_code == 201:
        hybrid_cust_id = r_hyb.json()["id"]
    else:
        hybrid_cust_id = client.get("/api/v1/partners?search=CLI-LOOKUP-02", headers=headers).json()[0]["id"]

    # 3. Create an INACTIVE customer
    cust_inactive_payload = {
        "code": "CLI-LOOKUP-03",
        "legal_name": "Entreprise Inactive SARL",
        "partner_type": "CUSTOMER",
        "is_active": False,
    }
    r_inact = client.post("/api/v1/partners", json=cust_inactive_payload, headers=headers)
    assert r_inact.status_code in (201, 409)
    if r_inact.status_code == 201:
        inactive_cust_id = r_inact.json()["id"]
    else:
        inactive_cust_id = client.get("/api/v1/partners?search=CLI-LOOKUP-03", headers=headers).json()[0]["id"]

    # Verify CANONICAL lookup /customers (active only)
    r_active = client.get("/api/v1/customers?is_active=true", headers=headers)
    assert r_active.status_code == 200
    active_customers = r_active.json()
    active_ids = {c["id"] for c in active_customers}

    # BOTH CUSTOMER and CUSTOMER_SUPPLIER must be returned in customer lookup!
    assert pure_cust_id in active_ids, "Pure customer missing from /customers"
    assert hybrid_cust_id in active_ids, "Hybrid CUSTOMER_SUPPLIER missing from /customers"
    # Inactive customer must NOT be returned when is_active=true
    assert inactive_cust_id not in active_ids, "Inactive customer should be excluded when is_active=true"

    # Verify /partners?partner_type=CUSTOMER returns BOTH pure customer and hybrid customer!
    r_part_cust = client.get("/api/v1/partners?partner_type=CUSTOMER&is_active=true", headers=headers)
    assert r_part_cust.status_code == 200
    part_cust_ids = {c["id"] for c in r_part_cust.json()}
    assert pure_cust_id in part_cust_ids
    assert hybrid_cust_id in part_cust_ids

    # Verify /partners?type=CUSTOMER returns BOTH pure customer and hybrid customer!
    r_type_cust = client.get("/api/v1/partners?type=CUSTOMER&is_active=true", headers=headers)
    assert r_type_cust.status_code == 200
    type_cust_ids = {c["id"] for c in r_type_cust.json()}
    assert pure_cust_id in type_cust_ids
    assert hybrid_cust_id in type_cust_ids


def test_customer_complete_lifecycle_and_customer360(client: TestClient):
    headers = get_admin_headers(client)
    cust_id, prod_id, wh_id = setup_customer_and_product(client, headers)

    # 1. TEST CLIENT -> DEVIS
    quote_res = client.post(
        "/api/v1/quotes",
        json={
            "customer_id": cust_id,
            "payment_terms": "30 jours net",
            "delivery_delay": "10 jours",
            "notes": "Devis de test d'intégration",
            "items": [
                {
                    "product_id": prod_id,
                    "quantity": 1.0,
                    "unit_price_ht": 3500.0,
                    "tax_rate": 20.0,
                    "discount_rate": 0.0,
                }
            ],
        },
        headers=headers,
    )
    assert quote_res.status_code == 201
    quote = quote_res.json()
    assert quote["customer_id"] == cust_id
    quote_id = quote["id"]

    # 2. TEST CLIENT -> SALES (Convert Quote to Sale)
    client.post(f"/api/v1/quotes/{quote_id}/accept", headers=headers)
    conv_res = client.post(f"/api/v1/quotes/{quote_id}/convert-to-sale", headers=headers)
    assert conv_res.status_code == 201
    sale = conv_res.json()
    assert sale["customer_id"] == cust_id
    sale_id = sale["id"]

    # Confirm Sale
    confirm_res = client.post(f"/api/v1/sales/{sale_id}/confirm", headers=headers)
    assert confirm_res.status_code == 200

    # 3. TEST CLIENT -> DELIVERY NOTE (BL)
    bl_res = client.post(
        "/api/v1/delivery-notes",
        json={
            "sale_id": sale_id,
            "items": [
                {
                    "sale_item_id": sale["items"][0]["id"],
                    "delivered_quantity": 1.0,
                }
            ],
        },
        headers=headers,
    )
    assert bl_res.status_code == 201
    bl = bl_res.json()
    assert bl["customer_id"] == cust_id
    bl_id = bl["id"]

    # Confirm BL
    client.post(f"/api/v1/delivery-notes/{bl_id}/confirm", headers=headers)

    # 4. TEST CLIENT -> CUSTOMER INVOICE
    inv_res = client.post(
        "/api/v1/invoices/from-sale",
        json={"sale_id": sale_id},
        headers=headers,
    )
    assert inv_res.status_code == 201
    invoice = inv_res.json()
    assert invoice["customer_id"] == cust_id
    invoice_id = invoice["id"]

    # Issue Invoice
    client.post(f"/api/v1/invoices/{invoice_id}/issue", headers=headers)

    # 5. TEST CLIENT -> PAYMENT (Encaisser le client)
    pay_res = client.post(
        "/api/v1/payments",
        json={
            "invoice_id": invoice_id,
            "amount": invoice["total_ttc"],
            "payment_method": "CHEQUE",
            "reference": "CHQ-123456",
        },
        headers=headers,
    )
    assert pay_res.status_code == 201
    payment = pay_res.json()
    assert payment["customer_id"] == cust_id

    # 6. TEST CLIENT -> MAINTENANCE (Équipement + Intervention)
    eq_res = client.post(
        "/api/v1/maintenance/equipments",
        json={
            "customer_id": cust_id,
            "equipment_type": "PONTS_BASCULES",
            "designation": "Pont-Bascule Industriel 60T",
            "brand": "Pesage 2000",
            "model": "PB-60T",
            "serial_number": f"SN-TEST-{cust_id}",
            "capacity_max": 60000.0,
        },
        headers=headers,
    )
    assert eq_res.status_code == 201
    equipment = eq_res.json()
    assert equipment["customer_id"] == cust_id
    eq_id = equipment["id"]

    # Create Intervention for this customer & equipment
    interv_res = client.post(
        "/api/v1/maintenance",
        json={
            "customer_id": cust_id,
            "equipment_id": eq_id,
            "intervention_type": "CALIBRATION",
            "priority": "HIGH",
            "title": "Étalonnage Périodique Métrologie Légale",
            "description": "Contrôle des capteurs et étalonnage avec masses étalons",
        },
        headers=headers,
    )
    assert interv_res.status_code == 201
    interv = interv_res.json()
    assert interv["customer_id"] == cust_id

    # 7. TEST CUSTOMER 360 SUMMARY
    summary_res = client.get(f"/api/v1/partners/{cust_id}/summary", headers=headers)
    assert summary_res.status_code == 200
    summary = summary_res.json()
    assert summary["partner_id"] == cust_id
    assert summary["total_quotes"] >= 1
    assert summary["total_sales"] >= 1
    assert summary["total_delivery_notes"] >= 1
    assert summary["total_invoices"] >= 1
    assert summary["total_payments"] >= 1
    assert summary["total_interventions"] >= 1
    assert summary["total_equipments"] >= 1
    assert summary["amount_paid"] > 0
