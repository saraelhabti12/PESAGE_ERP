import httpx

client = httpx.Client(base_url="http://127.0.0.1:8000/api/v1", timeout=15.0)

# Login
res = client.post("/auth/login", json={"email": "admin@example.com", "password": "CHANGE_THIS_PASSWORD"})
assert res.status_code == 200
token = res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Get a supplier and a product
suppliers = client.get("/partners?type=SUPPLIER", headers=headers).json()
supp = suppliers[0]
products = client.get("/products", headers=headers).json()
prod = products[0]

# 1. Create a fresh approved Purchase Order
po_payload = {
    "supplier_id": supp["id"],
    "payment_terms": "60 jours",
    "notes": "Commande d'achat en attente de facturation fournisseur pour démonstration UI",
    "items": [
        {
            "product_id": prod["id"],
            "quantity_ordered": 3.0,
            "unit_price_ht": prod["purchase_price"] or 10000.0,
            "tax_rate": 20.0,
            "discount_rate": 0.0,
        }
    ]
}
created_po_res = client.post("/purchases", headers=headers, json=po_payload)
assert created_po_res.status_code == 201, f"Failed to create PO: {created_po_res.text}"
created_po = created_po_res.json()
po_id = created_po["id"]
print(f"[+] Created Purchase Order {created_po['reference']} (ID: {po_id})")

# Approve PO
client.post(f"/purchases/{po_id}/approve", headers=headers)
print(f"[+] Approved Purchase Order {created_po['reference']}")

# 2. Verify candidate endpoint
cand_pos = client.get("/invoices/candidates/purchases", headers=headers).json()
assert any(p["id"] == po_id for p in cand_pos), "Approved PO should appear in candidates!"
print(f"[+] Purchase Order {created_po['reference']} is present in candidate purchases list.")

print("\nSUCCESS: Candidate purchases verified and ready in live database!")
