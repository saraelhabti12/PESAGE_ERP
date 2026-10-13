import httpx

client = httpx.Client(base_url="http://127.0.0.1:8000/api/v1", timeout=15.0)

# Login
res = client.post("/auth/login", json={"email": "admin@example.com", "password": "CHANGE_THIS_PASSWORD"})
assert res.status_code == 200, f"Login failed: {res.text}"
token = res.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

print("[1] Verifying Candidate Sales Endpoint...")
cand_sales = client.get("/invoices/candidates/sales", headers=headers)
assert cand_sales.status_code == 200, f"Failed: {cand_sales.text}"
sales_list = cand_sales.json()
print(f"    Found {len(sales_list)} candidate sales:")
for s in sales_list[:3]:
    print(f"      - ID: {s['id']}, Ref: {s['reference']}, Client: {s['customer']['legal_name']}, Total TTC: {s['total_ttc']} DH, Status: {s['status']}")

print("\n[2] Verifying Candidate Purchases Endpoint...")
cand_purchases = client.get("/invoices/candidates/purchases", headers=headers)
assert cand_purchases.status_code == 200, f"Failed: {cand_purchases.text}"
purchases_list = cand_purchases.json()
print(f"    Found {len(purchases_list)} candidate purchases:")
for p in purchases_list[:3]:
    print(f"      - ID: {p['id']}, Ref: {p['reference']}, Supplier: {p['supplier']['legal_name']}, Total TTC: {p['total_ttc']} DH, Status: {p['status']}")

print("\n[3] Verifying Customer Invoice List Separation...")
cust_invs = client.get("/invoices?invoice_type=CUSTOMER", headers=headers)
assert cust_invs.status_code == 200
print(f"    Customer Invoices count: {len(cust_invs.json())}")
for inv in cust_invs.json()[:3]:
    assert inv["invoice_type"] == "CUSTOMER"
    print(f"      - Ref: {inv['reference']}, Type: {inv['invoice_type']}, Client: {inv.get('customer', {}).get('legal_name') if inv.get('customer') else 'N/A'}, Total TTC: {inv['total_ttc']} DH")

print("\n[4] Verifying Supplier Invoice List Separation...")
supp_invs = client.get("/invoices?invoice_type=SUPPLIER", headers=headers)
assert supp_invs.status_code == 200
print(f"    Supplier Invoices count: {len(supp_invs.json())}")
for inv in supp_invs.json()[:3]:
    assert inv["invoice_type"] == "SUPPLIER"
    print(f"      - Ref: {inv['reference']}, Type: {inv['invoice_type']}, Supplier: {inv.get('supplier', {}).get('legal_name') if inv.get('supplier') else 'N/A'}, Total TTC: {inv['total_ttc']} DH")

print("\nALL LIVE INVOICE CANDIDATES AND SEPARATION ENDPOINTS ARE FUNCTIONING PERFECTLY!")
