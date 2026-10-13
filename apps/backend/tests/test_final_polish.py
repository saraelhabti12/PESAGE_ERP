import io
import pytest
from fastapi.testclient import TestClient
from tests.test_commercial_cycle import setup_customer_and_product, get_admin_headers


def test_dashboard_stats_has_facturation_and_maintenance(client: TestClient):
    headers = get_admin_headers(client)
    r = client.get("/api/v1/dashboard/stats", headers=headers)
    assert r.status_code == 200, f"Dashboard stats failed: {r.text}"
    data = r.json()

    # Facturation & Reglements live metrics under 'invoices'
    assert "invoices" in data
    inv = data["invoices"]
    assert "total_invoices" in inv
    assert "total_invoiced_ttc" in inv
    assert "total_amount_paid" in inv
    assert "total_amount_due" in inv
    assert "supplier_invoices_total" in inv
    assert "supplier_invoiced_ttc" in inv
    assert "month_collected_amount" in inv
    assert "supplier_payments_count" in inv

    # Interventions & Maintenance live metrics under 'maintenance'
    assert "maintenance" in data
    maint = data["maintenance"]
    assert "total_interventions" in maint
    assert "in_progress_interventions" in maint
    assert "completed_interventions" in maint
    assert "total_equipments" in maint
    assert "upcoming_maintenances" in maint
    assert "maintenance_cost_month" in maint


def test_quote_and_sale_delays(client: TestClient):
    headers = get_admin_headers(client)
    cust_id, prod_id, wh_id = setup_customer_and_product(client, headers)

    # 1. Create quote with delivery_delay & realization_delay
    quote_payload = {
        "customer_id": cust_id,
        "payment_terms": "30 jours net",
        "delivery_delay": "10 à 15 jours ouvrables",
        "realization_delay": "48h sur site",
        "notes": "Conditions spécifiques de test",
        "items": [
            {
                "product_id": prod_id,
                "quantity": 2.0,
                "unit_price_ht": 3000.0,
                "tax_rate": 20.0,
                "discount_rate": 5.0,
            }
        ],
    }
    r_quote = client.post("/api/v1/quotes", json=quote_payload, headers=headers)
    assert r_quote.status_code == 201, f"Create quote failed: {r_quote.text}"
    quote_data = r_quote.json()
    assert quote_data["delivery_delay"] == "10 à 15 jours ouvrables"
    assert quote_data["realization_delay"] == "48h sur site"
    quote_id = quote_data["id"]

    # 2. Get quote detail
    r_get_quote = client.get(f"/api/v1/quotes/{quote_id}", headers=headers)
    assert r_get_quote.status_code == 200
    detail = r_get_quote.json()
    assert detail["delivery_delay"] == "10 à 15 jours ouvrables"
    assert detail["realization_delay"] == "48h sur site"

    # 3. Update quote delays
    r_put_quote = client.put(
        f"/api/v1/quotes/{quote_id}",
        json={
            "delivery_delay": "3 semaines",
            "realization_delay": "1 semaine",
        },
        headers=headers,
    )
    assert r_put_quote.status_code == 200
    assert r_put_quote.json()["delivery_delay"] == "3 semaines"
    assert r_put_quote.json()["realization_delay"] == "1 semaine"

    # 4. Accept quote and convert to sale - verifies delay propagation
    r_acc = client.post(f"/api/v1/quotes/{quote_id}/accept", headers=headers)
    assert r_acc.status_code == 200
    r_conv = client.post(f"/api/v1/quotes/{quote_id}/convert-to-sale", headers=headers)
    assert r_conv.status_code == 201, f"Convert to sale failed: {r_conv.text}"
    sale_data = r_conv.json()
    assert sale_data["delivery_delay"] == "3 semaines"
    assert sale_data["realization_delay"] == "1 semaine"


def test_partner_summary_and_attachments(client: TestClient):
    headers = get_admin_headers(client)

    # 1. Create a customer
    cust_code = f"CLI-SUMM-{abs(hash('test_cust')) % 100000}"
    r_cust = client.post(
        "/api/v1/partners",
        json={
            "code": cust_code,
            "legal_name": "Entreprise Reseau Test SARL",
            "partner_type": "CUSTOMER",
            "is_active": True,
        },
        headers=headers,
    )
    assert r_cust.status_code == 201
    cust_id = r_cust.json()["id"]

    # 2. Get customer summary
    r_summary = client.get(f"/api/v1/partners/{cust_id}/summary", headers=headers)
    assert r_summary.status_code == 200, f"Customer summary failed: {r_summary.text}"
    summ = r_summary.json()
    assert summ["partner_id"] == cust_id
    assert summ["partner_type"] == "CUSTOMER"
    assert "total_quotes" in summ
    assert "total_sales" in summ
    assert "total_delivery_notes" in summ
    assert "total_invoices" in summ
    assert "total_credit_notes" in summ
    assert "total_interventions" in summ
    assert "total_equipments" in summ
    assert "total_payments" in summ
    assert "total_documents" in summ
    assert "total_invoiced_ttc" in summ
    assert "amount_paid" in summ
    assert "amount_due" in summ

    # 3. Create a supplier
    supp_code = f"FRN-SUMM-{abs(hash('test_supp')) % 100000}"
    r_supp = client.post(
        "/api/v1/partners",
        json={
            "code": supp_code,
            "legal_name": "Fournisseur Test SARL",
            "partner_type": "SUPPLIER",
            "is_active": True,
        },
        headers=headers,
    )
    assert r_supp.status_code == 201
    supp_id = r_supp.json()["id"]

    # 4. Get supplier summary
    r_supp_summary = client.get(f"/api/v1/partners/{supp_id}/summary", headers=headers)
    assert r_supp_summary.status_code == 200
    supp_summ = r_supp_summary.json()
    assert supp_summ["partner_id"] == supp_id
    assert supp_summ["partner_type"] == "SUPPLIER"
    assert "total_purchases" in supp_summ
    assert "total_receipts" in supp_summ
    assert "total_supplier_invoices" in supp_summ
    assert "supplier_amount_paid" in supp_summ
    assert "supplier_amount_due" in supp_summ

    # 5. Attachment CRUD for Customer
    file_content = b"%PDF-1.4 Mock PDF Content For Test Attachment"
    files = {
        "file": ("fiche_technique_client.pdf", io.BytesIO(file_content), "application/pdf")
    }
    data = {
        "entity_type": "CUSTOMER",
        "entity_id": str(cust_id),
        "category": "contract",
        "description": "Fiche technique et contrat client",
    }
    r_upload = client.post("/api/v1/attachments/upload", data=data, files=files, headers=headers)
    assert r_upload.status_code == 201, f"Upload attachment failed: {r_upload.text}"
    att = r_upload.json()
    assert att["entity_type"] == "CUSTOMER"
    assert att["entity_id"] == cust_id
    assert att["category"].upper() == "CONTRACT"
    assert att["filename"] == "fiche_technique_client.pdf"
    att_id = att["id"]

    # 6. List attachments
    r_list_att = client.get(f"/api/v1/attachments?entity_type=CUSTOMER&entity_id={cust_id}", headers=headers)
    assert r_list_att.status_code == 200
    att_items = r_list_att.json()
    assert len(att_items) >= 1
    assert any(a["id"] == att_id for a in att_items)

    # 7. Download attachment
    r_dl = client.get(f"/api/v1/attachments/{att_id}/download", headers=headers)
    assert r_dl.status_code == 200
    assert r_dl.content == file_content
    assert "fiche_technique_client.pdf" in r_dl.headers.get("content-disposition", "")

    # 8. Re-check customer summary attachments count
    r_summary_after = client.get(f"/api/v1/partners/{cust_id}/summary", headers=headers)
    assert r_summary_after.status_code == 200
    assert r_summary_after.json()["total_documents"] >= 1

    # 9. Delete attachment
    r_del = client.delete(f"/api/v1/attachments/{att_id}", headers=headers)
    assert r_del.status_code == 204

    # 10. Verify deleted
    r_dl_after = client.get(f"/api/v1/attachments/{att_id}/download", headers=headers)
    assert r_dl_after.status_code == 404
