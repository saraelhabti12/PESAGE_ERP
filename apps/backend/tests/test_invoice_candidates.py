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


def test_invoice_candidates_and_creation_workflow(client: TestClient):
    headers = get_admin_headers(client)

    # 1. Setup master data (Category, Product Type, Unit, Warehouse, Products, Customer, Supplier)
    cat_res = client.post(
        "/api/v1/categories",
        headers=headers,
        json={"name": "Ponts Bascules Tests", "code": "PB-TEST"},
    )
    assert cat_res.status_code == 201
    cat_id = cat_res.json()["id"]

    type_res = client.post(
        "/api/v1/product-types",
        headers=headers,
        json={"name": "Équipements Lourds", "code": "EQ-LOURD"},
    )
    assert type_res.status_code == 201
    type_id = type_res.json()["id"]

    unit_res = client.post(
        "/api/v1/units",
        headers=headers,
        json={"name": "Unité", "abbreviation": "U"},
    )
    assert unit_res.status_code == 201
    unit_id = unit_res.json()["id"]

    wh_res = client.post(
        "/api/v1/warehouses",
        headers=headers,
        json={"name": "Dépôt Casablanca Test", "code": "DEP-CASA-TEST", "type": "MAIN"},
    )
    assert wh_res.status_code == 201
    wh_id = wh_res.json()["id"]

    prod_res = client.post(
        "/api/v1/products",
        headers=headers,
        json={
            "sku": "PB-60T-TEST",
            "designation": "Pont-Bascule Métallique 60T 18x3m",
            "category_id": cat_id,
            "product_type_id": type_id,
            "unit_id": unit_id,
            "purchase_price": 85000.0,
            "sale_price": 145000.0,
            "tax_rate": 20.0,
            "track_stock": True,
        },
    )
    assert prod_res.status_code == 201
    prod_id = prod_res.json()["id"]

    # Initial stock
    client.post(
        "/api/v1/stock/adjustments",
        headers=headers,
        json={
            "product_id": prod_id,
            "warehouse_id": wh_id,
            "new_quantity": 10.0,
            "reason": "Test setup",
        },
    )

    # Customer
    cust_res = client.post(
        "/api/v1/partners",
        headers=headers,
        json={
            "code": "CLI-LAFARGE-TEST",
            "legal_name": "LafargeHolcim Maroc Test",
            "partner_type": "CUSTOMER",
            "email": "achats@lafarge-test.ma",
            "phone": "0522000111",
            "city": "Casablanca",
        },
    )
    assert cust_res.status_code == 201
    cust_id = cust_res.json()["id"]

    # Supplier
    supp_res = client.post(
        "/api/v1/partners",
        headers=headers,
        json={
            "code": "FRN-BILANCIAI-TEST",
            "legal_name": "Società Cooperativa Bilanciai Test",
            "partner_type": "SUPPLIER",
            "email": "sales@bilanciai-test.it",
            "phone": "0522000222",
            "city": "Campogalliano",
        },
    )
    assert supp_res.status_code == 201
    supp_id = supp_res.json()["id"]

    # =========================================================================
    # 2. CUSTOMER INVOICE CANDIDATES & CREATION
    # =========================================================================
    # Create a Sale (Draft)
    sale_res = client.post(
        "/api/v1/sales",
        headers=headers,
        json={
            "customer_id": cust_id,
            "items": [
                {
                    "product_id": prod_id,
                    "quantity": 1.0,
                    "unit_price_ht": 145000.0,
                    "tax_rate": 20.0,
                    "warehouse_id": wh_id,
                }
            ],
            "payment_terms": "30 jours",
        },
    )
    assert sale_res.status_code == 201
    sale_id = sale_res.json()["id"]

    # Draft sale should NOT be in candidates
    cand_sales_res = client.get("/api/v1/invoices/candidates/sales", headers=headers)
    assert cand_sales_res.status_code == 200
    assert not any(s["id"] == sale_id for s in cand_sales_res.json())

    # Confirm the sale
    client.post(f"/api/v1/sales/{sale_id}/confirm", headers=headers)

    # Confirmed sale MUST now appear in candidates
    cand_sales_res2 = client.get("/api/v1/invoices/candidates/sales", headers=headers)
    assert cand_sales_res2.status_code == 200
    candidate_sale = next((s for s in cand_sales_res2.json() if s["id"] == sale_id), None)
    assert candidate_sale is not None
    assert candidate_sale["reference"].startswith("VTE-")
    assert candidate_sale["customer"]["id"] == cust_id
    assert len(candidate_sale["items"]) == 1

    # Create Customer Invoice from candidate sale
    create_inv_res = client.post(
        "/api/v1/invoices/from-sale",
        headers=headers,
        json={"sale_id": sale_id, "payment_terms": "30 jours"},
    )
    assert create_inv_res.status_code == 201
    cust_inv = create_inv_res.json()
    assert cust_inv["invoice_type"] == "CUSTOMER"
    assert cust_inv["sale_id"] == sale_id
    assert cust_inv["customer_id"] == cust_id
    assert cust_inv["total_ttc"] == 174000.0
    assert cust_inv["amount_due"] == 174000.0

    # Once invoiced, sale must NO LONGER appear in candidates
    cand_sales_res3 = client.get("/api/v1/invoices/candidates/sales", headers=headers)
    assert cand_sales_res3.status_code == 200
    assert not any(s["id"] == sale_id for s in cand_sales_res3.json())

    # Duplicate invoice attempt must return 400
    dup_res = client.post(
        "/api/v1/invoices/from-sale",
        headers=headers,
        json={"sale_id": sale_id},
    )
    assert dup_res.status_code == 400
    assert "existe déjà" in dup_res.text

    # =========================================================================
    # 3. SUPPLIER INVOICE CANDIDATES & CREATION
    # =========================================================================
    # Create a Purchase Order (Draft)
    po_res = client.post(
        "/api/v1/purchases",
        headers=headers,
        json={
            "supplier_id": supp_id,
            "payment_terms": "60 jours",
            "items": [
                {
                    "product_id": prod_id,
                    "quantity_ordered": 2.0,
                    "unit_price_ht": 85000.0,
                    "tax_rate": 20.0,
                    "discount_rate": 0.0,
                }
            ],
        },
    )
    assert po_res.status_code == 201
    po_id = po_res.json()["id"]

    # Draft PO should NOT be in candidates
    cand_po_res = client.get("/api/v1/invoices/candidates/purchases", headers=headers)
    assert cand_po_res.status_code == 200
    assert not any(p["id"] == po_id for p in cand_po_res.json())

    # Approve the PO
    approve_res = client.post(f"/api/v1/purchases/{po_id}/approve", headers=headers)
    assert approve_res.status_code == 200

    # Approved PO MUST now appear in candidates
    cand_po_res2 = client.get("/api/v1/invoices/candidates/purchases", headers=headers)
    assert cand_po_res2.status_code == 200
    candidate_po = next((p for p in cand_po_res2.json() if p["id"] == po_id), None)
    assert candidate_po is not None
    assert candidate_po["reference"].startswith(("ACH-", "PO-"))
    assert candidate_po["supplier"]["id"] == supp_id
    assert len(candidate_po["items"]) == 1

    # Create Supplier Invoice from candidate PO
    create_supp_inv_res = client.post(
        "/api/v1/invoices/from-purchase",
        headers=headers,
        json={"purchase_order_id": po_id, "payment_terms": "60 jours"},
    )
    assert create_supp_inv_res.status_code == 201
    supp_inv = create_supp_inv_res.json()
    assert supp_inv["invoice_type"] == "SUPPLIER"
    assert supp_inv["purchase_order_id"] == po_id
    assert supp_inv["supplier_id"] == supp_id
    assert supp_inv["total_ttc"] == 204000.0

    # Once invoiced, PO must NO LONGER appear in candidates
    cand_po_res3 = client.get("/api/v1/invoices/candidates/purchases", headers=headers)
    assert cand_po_res3.status_code == 200
    assert not any(p["id"] == po_id for p in cand_po_res3.json())

    # Duplicate supplier invoice attempt must return 400
    dup_supp_res = client.post(
        "/api/v1/invoices/from-purchase",
        headers=headers,
        json={"purchase_order_id": po_id},
    )
    assert dup_supp_res.status_code == 400
    assert "existe déjà" in dup_supp_res.text

    # =========================================================================
    # 4. INVOICE TYPE SEPARATION QUERY VERIFICATION
    # =========================================================================
    cust_inv_list = client.get("/api/v1/invoices?invoice_type=CUSTOMER", headers=headers).json()
    assert all(i["invoice_type"] == "CUSTOMER" for i in cust_inv_list)
    assert any(i["id"] == cust_inv["id"] for i in cust_inv_list)
    assert not any(i["id"] == supp_inv["id"] for i in cust_inv_list)

    supp_inv_list = client.get("/api/v1/invoices?invoice_type=SUPPLIER", headers=headers).json()
    assert all(i["invoice_type"] == "SUPPLIER" for i in supp_inv_list)
    assert any(i["id"] == supp_inv["id"] for i in supp_inv_list)
    assert not any(i["id"] == cust_inv["id"] for i in supp_inv_list)
