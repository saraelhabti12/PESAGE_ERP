import httpx

client = httpx.Client(base_url="http://127.0.0.1:8000/api/v1", timeout=15.0)

# Login
res = client.post("/auth/login", json={"email": "admin@example.com", "password": "CHANGE_THIS_PASSWORD"})
assert res.status_code == 200
token = res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

# Get a customer and a product
customers = client.get("/partners?partner_type=CUSTOMER", headers=headers).json()
cust = customers[0]
products = client.get("/products", headers=headers).json()
prod = products[0]

# 1. Create a new confirmed Sale
sale_payload = {
    "customer_id": cust["id"],
    "payment_terms": "30 jours",
    "notes": "Commande de vente de démonstration pour facturation",
    "items": [
        {
            "product_id": prod["id"],
            "quantity": 2.0,
            "unit_price_ht": prod["sale_price"],
            "tax_rate": prod["tax_rate"],
            "discount_rate": 0.0,
        }
    ]
}
created_sale = client.post("/sales", headers=headers, json=sale_payload).json()
sale_id = created_sale["id"]
print(f"[+] Created Sale {created_sale['reference']} (ID: {sale_id})")

# Confirm sale
client.post(f"/sales/{sale_id}/confirm", headers=headers)
print(f"[+] Confirmed Sale {created_sale['reference']}")

# 2. Check that the candidate endpoint returns this sale
cand_sales = client.get("/invoices/candidates/sales", headers=headers).json()
assert any(s["id"] == sale_id for s in cand_sales), "New confirmed sale should appear in candidates!"
print(f"[+] Sale {created_sale['reference']} is present in candidate sales list.")

# 3. Create a customer invoice from this candidate sale
inv_payload = {
    "sale_id": sale_id,
    "payment_terms": "30 jours",
    "notes": "Facture générée automatiquement"
}
created_inv = client.post("/invoices/from-sale", headers=headers, json=inv_payload).json()
assert created_inv["invoice_type"] == "CUSTOMER"
assert created_inv["sale_id"] == sale_id
print(f"[+] Created Customer Invoice {created_inv['reference']} (TTC: {created_inv['total_ttc']} DH)")

# 4. Verify that the sale is no longer returned in candidate sales
cand_sales_after = client.get("/invoices/candidates/sales", headers=headers).json()
assert not any(s["id"] == sale_id for s in cand_sales_after), "Invoiced sale must not appear in candidates!"
print(f"[+] Invoiced Sale {created_sale['reference']} is now excluded from candidate sales list.")

# 5. Create another fresh confirmed sale so there is ALWAYS a valid candidate sale available in the live UI!
fresh_sale_payload = {
    "customer_id": cust["id"],
    "payment_terms": "45 jours fin de mois",
    "notes": "Vente confirmée en attente de facturation pour le test utilisateur",
    "items": [
        {
            "product_id": prod["id"],
            "quantity": 1.0,
            "unit_price_ht": prod["sale_price"],
            "tax_rate": prod["tax_rate"],
            "discount_rate": 5.0,
        }
    ]
}
fresh_sale = client.post("/sales", headers=headers, json=fresh_sale_payload).json()
client.post(f"/sales/{fresh_sale['id']}/confirm", headers=headers)
print(f"[+] Created & confirmed fresh candidate Sale {fresh_sale['reference']} for UI dropdown demonstration.")

print("\nSUCCESS: Candidate sales and invoice lifecycle verified!")
