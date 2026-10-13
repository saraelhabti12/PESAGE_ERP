import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from app.main import app

def run_verification():
    client = TestClient(app)

    print("==================================================")
    print("PHASE 6 — PURCHASE MANAGEMENT VERIFICATION")
    print("==================================================")

    # 1. Admin Login
    print("\n1. Testing Admin Authentication...")
    r = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "CHANGE_THIS_PASSWORD"})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("  -> Admin authenticated successfully.")

    # 2. Ensure Supplier exists
    print("\n2. Creating / Getting Supplier...")
    r_supp = client.post(
        "/api/v1/partners",
        json={
            "code": "FRS-E2E-PESAGE",
            "legal_name": "Maroc Pesage Métrologie SARL",
            "trade_name": "MPM Casablanca",
            "partner_type": "SUPPLIER",
            "ice": "001998877665544",
            "phone": "+212522998877",
            "email": "contact@mpm.ma",
            "city": "Casablanca",
            "is_active": True,
        },
        headers=headers,
    )
    if r_supp.status_code == 201:
        supplier = r_supp.json()
    else:
        suppliers = client.get("/api/v1/suppliers", headers=headers).json()
        supplier = suppliers[0]
    supp_id = supplier["id"]
    print(f"  -> Supplier ready: ID {supp_id} ({supplier['legal_name']}).")

    # 3. Ensure Products exist
    print("\n3. Creating Products for Purchase...")
    cats = client.get("/api/v1/categories", headers=headers).json()
    if cats:
        cat = cats[0]
    else:
        cat = client.post("/api/v1/categories", json={"name": "Pèse-Essieux & Bascules", "code": "PEB"}, headers=headers).json()

    pts = client.get("/api/v1/product-types", headers=headers).json()
    if pts:
        pt = pts[0]
    else:
        pt = client.post("/api/v1/product-types", json={"name": "Matériel Électronique", "code": "ELEC"}, headers=headers).json()

    units = client.get("/api/v1/units", headers=headers).json()
    if units:
        u = units[0]
    else:
        u = client.post("/api/v1/units", json={"name": "Unité", "abbreviation": "U"}, headers=headers).json()

    r_p1 = client.post(
        "/api/v1/products",
        json={
            "sku": "E2E-CAP-50T",
            "designation": "Capteur Compression 50 Tonnes Inox",
            "category_id": cat["id"],
            "product_type_id": pt["id"],
            "unit_id": u["id"],
            "purchase_price": 4500.00,
            "sale_price": 7200.00,
            "tax_rate": 20.00,
            "is_active": True,
            "track_stock": True,
        },
        headers=headers,
    )
    prod1 = r_p1.json() if r_p1.status_code == 201 else client.get("/api/v1/products", headers=headers).json()[0]

    r_p2 = client.post(
        "/api/v1/products",
        json={
            "sku": "E2E-BOITIER-6V",
            "designation": "Boîte de Jonction 6 Voies Ajustable",
            "category_id": cat["id"],
            "product_type_id": pt["id"],
            "unit_id": u["id"],
            "purchase_price": 850.00,
            "sale_price": 1400.00,
            "tax_rate": 20.00,
            "is_active": True,
            "track_stock": True,
        },
        headers=headers,
    )
    prod2 = r_p2.json() if r_p2.status_code == 201 else client.get("/api/v1/products", headers=headers).json()[-1]
    print(f"  -> Products ready: {prod1['sku']} (P.U. {prod1['purchase_price']} DH) & {prod2['sku']} (P.U. {prod2['purchase_price']} DH).")

    # 4. Create Purchase Order
    print("\n4. Creating Purchase Order with calculated lines...")
    po_payload = {
        "reference": "PO-E2E-2026-001",
        "supplier_id": supp_id,
        "order_date": "2026-08-27T12:00:00Z",
        "expected_date": "2026-09-05T12:00:00Z",
        "payment_terms": "45 jours fin de mois",
        "payment_method": "Virement bancaire",
        "notes": "Commande de composants pour installation Bascule Settat",
        "items": [
            {
                "product_id": prod1["id"],
                "quantity_ordered": 4,
                "unit_price_ht": 4500.00,
                "tax_rate": 20.00,
                "discount_rate": 5.00,
            },
            {
                "product_id": prod2["id"],
                "quantity_ordered": 2,
                "unit_price_ht": 850.00,
                "tax_rate": 20.00,
                "discount_rate": 0.00,
            },
        ],
    }
    r_po = client.post("/api/v1/purchases", json=po_payload, headers=headers)
    assert r_po.status_code == 201, f"Failed creating PO: {r_po.text}"
    po = r_po.json()
    po_id = po["id"]
    assert po["status"] == "DRAFT"
    assert po["subtotal_ht"] == 18800.00
    assert po["tax_amount"] == 3760.00
    assert po["total_ttc"] == 22560.00
    print(f"  -> Purchase order {po['reference']} created. Status: {po['status']}, Total TTC: {po['total_ttc']} DH.")

    item1_id = po["items"][0]["id"]
    item2_id = po["items"][1]["id"]

    # 5. Approve Purchase Order
    print("\n5. Approving Purchase Order...")
    r_app = client.post(f"/api/v1/purchases/{po_id}/approve", headers=headers)
    assert r_app.status_code == 200
    assert r_app.json()["status"] == "APPROVED"
    print(f"  -> Purchase order approved successfully.")

    # 5b. Ensure Warehouse exists for reception
    whs = client.get("/api/v1/warehouses", headers=headers).json()
    if whs:
        wh = whs[0]
    else:
        wh = client.post(
            "/api/v1/warehouses",
            json={"code": "WH-VERIF-01", "name": "Dépôt Vérification Phase 6", "type": "MAIN"},
            headers=headers,
        ).json()
    wh_id = wh["id"]

    # 6. Create Partial Receipt 1 (Receiving 2 sensors out of 4)
    print("\n6. Creating Partial Receipt 1 (2 sensors / 4 ordered)...")
    r_rec1 = client.post(
        "/api/v1/purchase-receipts",
        json={
            "reference": "BL-MPM-00881",
            "purchase_order_id": po_id,
            "warehouse_id": wh_id,
            "receipt_date": "2026-08-28T09:00:00Z",
            "notes": "1er colis livré par transporteur",
            "items": [
                {
                    "purchase_order_item_id": item1_id,
                    "product_id": prod1["id"],
                    "quantity_received": 2,
                }
            ],
        },
        headers=headers,
    )
    assert r_rec1.status_code == 201
    rec1 = r_rec1.json()
    print(f"  -> Receipt {rec1['reference']} recorded.")

    # Check order status -> PARTIALLY_RECEIVED
    po_mid = client.get(f"/api/v1/purchases/{po_id}", headers=headers).json()
    assert po_mid["status"] == "PARTIALLY_RECEIVED"
    l1 = next(i for i in po_mid["items"] if i["id"] == item1_id)
    assert l1["quantity_received"] == 2.0
    assert l1["quantity_remaining"] == 2.0
    print(f"  -> Order status: {po_mid['status']}, Sensor remaining: {l1['quantity_remaining']}.")

    # 7. Create Full Final Receipt (Receiving 2 remaining sensors and 2 junction boxes)
    print("\n7. Creating Final Receipt (2 remaining sensors + 2 junction boxes)...")
    r_rec2 = client.post(
        "/api/v1/purchase-receipts",
        json={
            "reference": "BL-MPM-00895",
            "purchase_order_id": po_id,
            "warehouse_id": wh_id,
            "receipt_date": "2026-08-30T14:30:00Z",
            "notes": "Solde de la commande reçu complet",
            "items": [
                {
                    "purchase_order_item_id": item1_id,
                    "product_id": prod1["id"],
                    "quantity_received": 2,
                },
                {
                    "purchase_order_item_id": item2_id,
                    "product_id": prod2["id"],
                    "quantity_received": 2,
                },
            ],
        },
        headers=headers,
    )
    assert r_rec2.status_code == 201
    rec2 = r_rec2.json()
    print(f"  -> Final Receipt {rec2['reference']} recorded.")

    # Check final order status -> RECEIVED
    po_final = client.get(f"/api/v1/purchases/{po_id}", headers=headers).json()
    assert po_final["status"] == "RECEIVED"
    assert all(i["quantity_remaining"] == 0.0 for i in po_final["items"])
    assert len(po_final["receipts"]) == 2
    print(f"  -> Order status: {po_final['status']}. All line items fully received!")

    print("\n==================================================")
    print("PHASE 6 VERIFICATION COMPLETED WITH 100% SUCCESS!")
    print("==================================================")

if __name__ == "__main__":
    run_verification()
