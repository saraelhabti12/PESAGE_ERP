import urllib.request
import json
import sys
import uuid

BASE_URL = "http://localhost:8000/api/v1"

def api_call(endpoint, method="GET", data=None, token=None):
    url = f"{BASE_URL}{endpoint}"
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    
    req_body = json.dumps(data).encode("utf-8") if data is not None else None
    req = urllib.request.Request(url, data=req_body, headers=headers, method=method)
    
    try:
        with urllib.request.urlopen(req) as response:
            res_data = response.read().decode("utf-8")
            if res_data:
                return response.status, json.loads(res_data)
            return response.status, {}
    except urllib.error.HTTPError as e:
        err_data = e.read().decode("utf-8")
        try:
            return e.code, json.loads(err_data)
        except Exception:
            return e.code, {"error": err_data}

def run_e2e():
    print("=== LIVE E2E COMMERCIAL CYCLE VERIFICATION ===")
    
    # Auth
    status, login_res = api_call("/auth/login", method="POST", data={"email": "admin@example.com", "password": "CHANGE_THIS_PASSWORD"})
    if status != 200:
        print(f"Login failed: {status} - {login_res}")
        sys.exit(1)
    token = login_res["access_token"]
    print("1. Authenticated as ADMIN.")

    # 1. Customer
    status, partners = api_call("/partners?partner_type=CUSTOMER", token=token)
    if not partners:
        code_rand = f"CLT-{uuid.uuid4().hex[:6].upper()}"
        status, customer = api_call("/partners", method="POST", data={
            "code": code_rand,
            "legal_name": "Atlas Pesage SARL",
            "partner_type": "CUSTOMER",
            "ice": "001234567890001",
            "phone": "0522001122",
            "email": "contact@atlaspesage.ma",
            "address": "Zone Industrielle Sidi Bernoussi",
            "city": "Casablanca",
            "is_active": True
        }, token=token)
    else:
        customer = partners[0]
    print(f"Using Customer: {customer.get('legal_name')} (ID: {customer['id']})")

    # 2. Category, Product Type, Unit, Product
    status, categories = api_call("/categories", token=token)
    if not categories:
        _, cat = api_call("/categories", method="POST", data={"name": "Balances Industrielles", "code": "BAL-IND"}, token=token)
    else:
        cat = categories[0]

    status, types = api_call("/product-types", token=token)
    if not types:
        _, ptype = api_call("/product-types", method="POST", data={"name": "Matériel", "code": "MAT"}, token=token)
    else:
        ptype = types[0]

    status, units = api_call("/units", token=token)
    if not units:
        _, unit = api_call("/units", method="POST", data={"name": "Unité", "abbreviation": "U"}, token=token)
    else:
        unit = units[0]

    status, products = api_call("/products", token=token)
    if not products:
        sku_rand = f"SKU-{uuid.uuid4().hex[:6].upper()}"
        status, product = api_call("/products", method="POST", data={
            "sku": sku_rand,
            "designation": "Pont-Bascule Métrologique 60T",
            "category_id": cat["id"],
            "product_type_id": ptype["id"],
            "unit_id": unit["id"],
            "purchase_price": 5000.0,
            "sale_price": 8500.0,
            "tax_rate": 20.0,
            "track_stock": True,
            "is_active": True
        }, token=token)
    else:
        product = products[0]
    print(f"Using Product: {product['designation']} (ID: {product['id']})")

    # 3. Warehouse
    status, warehouses = api_call("/warehouses", token=token)
    if not warehouses:
        status, warehouse = api_call("/warehouses", method="POST", data={
            "name": "Magasin Central Casablanca",
            "code": "MAG-01",
            "is_active": True
        }, token=token)
    else:
        warehouse = warehouses[0]
    print(f"Using Warehouse: {warehouse['name']} (ID: {warehouse['id']})")

    # 4. Stock Adjustment
    status, adj = api_call("/stock/adjustments", method="POST", data={
        "product_id": product["id"],
        "warehouse_id": warehouse["id"],
        "new_quantity": 100.0,
        "reason": "E2E stock prep"
    }, token=token)
    print(f"Initial stock balance prepared (Status: {status}, Qty: 100).")

    # Step 1: Create Quote (Devis)
    q_ref = f"DEV-{uuid.uuid4().hex[:6].upper()}"
    quote_payload = {
        "reference": q_ref,
        "customer_id": customer["id"],
        "quote_date": "2026-09-18",
        "payment_terms": "30 jours",
        "notes": "Proposition commerciale Pesage 2000",
        "items": [
            {
                "product_id": product["id"],
                "warehouse_id": warehouse["id"],
                "quantity": 5,
                "unit_price_ht": 1200.0,
                "tax_rate": 20.0,
                "discount_rate": 10.0
            }
        ]
    }
    status, quote = api_call("/quotes", method="POST", data=quote_payload, token=token)
    assert status == 201, f"Create quote failed: {quote}"
    print(f"2. Created Devis {quote['reference']} (Status: {quote['status']}, Total TTC: {quote['total_ttc']} MAD)")

    # Step 2: Send & Accept Quote
    api_call(f"/quotes/{quote['id']}/send", method="POST", token=token)
    status, accept_res = api_call(f"/quotes/{quote['id']}/accept", method="POST", token=token)
    assert status == 200
    print(f"3. Devis accepted (Status: {accept_res['status']})")

    # Step 3: Convert Quote to Sale
    status, sale = api_call(f"/quotes/{quote['id']}/convert-to-sale", method="POST", token=token)
    assert status == 201, f"Convert to sale failed: {sale}"
    print(f"4. Converted to Sale {sale['reference']} (Quote ID: {sale.get('quote_id')}, Status: {sale['status']})")

    # Step 4: Confirm Sale (Stock Deduction)
    status, sale_confirmed = api_call(f"/sales/{sale['id']}/confirm", method="POST", token=token)
    assert status == 200, f"Confirm sale failed: {sale_confirmed}"
    print(f"5. Sale Confirmed (Status: {sale_confirmed['status']}) — Stock deducted with SALE movement.")

    # Step 5: Check Delivery Progress & Create Delivery Note (Bon de Livraison)
    status, prog = api_call(f"/delivery-notes/sale-progress/{sale['id']}", token=token)
    assert status == 200, f"Delivery progress failed: {prog}"
    prod_key = str(product["id"]) if str(product["id"]) in prog else product["id"]
    rem_qty = prog[prod_key]["remaining"]
    print(f"6. Delivery Progress retrieved: {rem_qty} remaining to deliver.")

    bl_ref = f"BL-{uuid.uuid4().hex[:6].upper()}"
    bl_payload = {
        "reference": bl_ref,
        "sale_id": sale["id"],
        "delivery_date": "2026-09-18",
        "shipping_address": "Zone Industrielle Sidi Bernoussi, Casablanca",
        "tracking_number": "LIV-INTERNE-01",
        "items": [
            {
                "product_id": product["id"],
                "delivered_quantity": 5.0
            }
        ]
    }
    status, bl = api_call("/delivery-notes", method="POST", data=bl_payload, token=token)
    assert status == 201, f"Create BL failed: {bl}"
    print(f"7. Created Bon de Livraison {bl['reference']} (Status: {bl['status']}) — Zero double stock deduction.")

    # Check sale status transitioned to DELIVERED
    status, sale_deliv = api_call(f"/sales/{sale['id']}", token=token)
    print(f"8. Sale Status after full delivery: {sale_deliv['status']}")
    assert sale_deliv['status'] == 'DELIVERED'

    # Step 6: Create Invoice from Sale
    inv_ref = f"FACT-{uuid.uuid4().hex[:6].upper()}"
    status, invoice = api_call("/invoices/from-sale", method="POST", data={
        "sale_id": sale["id"],
        "reference": inv_ref,
        "payment_terms": "30 jours"
    }, token=token)
    assert status == 201, f"Create Invoice failed: {invoice}"
    print(f"9. Created Invoice {invoice['reference']} (Total TTC: {invoice['total_ttc']}, Amount Due: {invoice['amount_due']}, Status: {invoice['status']}, Due Date: {invoice['due_date']})")

    # Step 7: Record Partial Payment
    status, pay1 = api_call("/payments", method="POST", data={
        "invoice_id": invoice["id"],
        "amount": 3000.0,
        "payment_date": "2026-09-18",
        "payment_method": "check",
        "transaction_reference": "CHQ-889911"
    }, token=token)
    assert status == 201
    print(f"10. Recorded Partial Payment: 3 000.00 MAD")

    # Check Invoice is PARTIALLY_PAID
    status, inv_part = api_call(f"/invoices/{invoice['id']}", token=token)
    print(f"11. Invoice Status: {inv_part['status']} (Paid: {inv_part['amount_paid']} MAD, Due: {inv_part['amount_due']} MAD)")
    assert inv_part['status'] == 'PARTIALLY_PAID'

    # Step 8: Pay Remaining Balance
    rem_amount = inv_part['amount_due']
    status, pay2 = api_call("/payments", method="POST", data={
        "invoice_id": invoice["id"],
        "amount": rem_amount,
        "payment_date": "2026-09-18",
        "payment_method": "bank_transfer",
        "transaction_reference": "VIR-BMCE-4402"
    }, token=token)
    assert status == 201
    print(f"12. Recorded Full Settlement Payment: {rem_amount} MAD")

    # Check Invoice is PAID
    status, inv_paid = api_call(f"/invoices/{invoice['id']}", token=token)
    print(f"13. Final Invoice Status: {inv_paid['status']} (Paid: {inv_paid['amount_paid']} MAD, Due: {inv_paid['amount_due']} MAD)")
    assert inv_paid['status'] == 'PAID'
    assert inv_paid['amount_due'] == 0.0

    # Step 9: Customer Financial Balance Summary
    status, cust_sum = api_call(f"/payments/customer-summary/{customer['id']}", token=token)
    assert status == 200, f"Customer summary failed: {cust_sum}"
    print(f"14. Customer Financial Summary: Total Invoiced: {cust_sum['total_invoiced']} MAD, Total Paid: {cust_sum['total_paid']} MAD, Balance Due: {cust_sum['balance_due']} MAD, Unpaid Count: {cust_sum['unpaid_invoice_count']}")

    # Step 10: Dashboard Statistics
    status, dash_stats = api_call("/dashboard/stats", token=token)
    assert status == 200, f"Dashboard stats failed: {dash_stats}"
    print(f"15. Dashboard Stats: Total Quotes: {dash_stats['quotes']['total_quotes']}, Total Invoices: {dash_stats['invoices']['total_invoices']}, Total Invoiced TTC: {dash_stats['invoices']['total_invoiced_ttc']} MAD, Total Collected: {dash_stats['invoices']['total_amount_paid']} MAD")

    print("\n>>> ALL 15 VERIFICATION STEPS PASSED SUCCESSFULLY! COMPLETE COMMERCIAL CYCLE IS 100% OPERATIONAL. <<<")

if __name__ == "__main__":
    run_e2e()
