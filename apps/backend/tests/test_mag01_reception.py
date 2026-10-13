import httpx
import sys
from app.core.config import settings

BASE_URL = "http://localhost:8000"

def run_test():
    print("Logging into live API...")
    login_res = httpx.post(
        f"{BASE_URL}/api/v1/auth/login",
        json={"email": settings.ADMIN_EMAIL, "password": settings.ADMIN_PASSWORD},
    )
    if login_res.status_code != 200:
        print(f"Login failed: {login_res.status_code} {login_res.text}")
        sys.exit(1)
    
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    # 1. Fetch Warehouses
    wh_res = httpx.get(f"{BASE_URL}/api/v1/warehouses?is_active=true", headers=headers)
    assert wh_res.status_code == 200, wh_res.text
    warehouses = wh_res.json()
    mag01 = next((w for w in warehouses if w["code"] == "MAG01"), None)
    if not mag01:
        # Create MAG01 if not exists
        create_wh_res = httpx.post(
            f"{BASE_URL}/api/v1/warehouses",
            json={"code": "MAG01", "name": "Magasin principal", "type": "MAIN", "is_active": True},
            headers=headers
        )
        assert create_wh_res.status_code == 201, create_wh_res.text
        mag01 = create_wh_res.json()
    
    print(f"[OK] Destination warehouse: {mag01['code']} — {mag01['name']} (ID={mag01['id']})")
    
    # 2. Get/Create Product PROD01
    prod_res = httpx.get(f"{BASE_URL}/api/v1/products?search=PROD01", headers=headers)
    products = prod_res.json() if isinstance(prod_res.json(), list) else prod_res.json().get("items", [])
    prod01 = next((p for p in products if p["sku"] == "PROD01"), None)
    if not prod01:
        cat_res = httpx.get(f"{BASE_URL}/api/v1/categories", headers=headers)
        cats = cat_res.json() if isinstance(cat_res.json(), list) else cat_res.json().get("items", [])
        pt_res = httpx.get(f"{BASE_URL}/api/v1/product-types", headers=headers)
        pts = pt_res.json() if isinstance(pt_res.json(), list) else pt_res.json().get("items", [])
        u_res = httpx.get(f"{BASE_URL}/api/v1/units", headers=headers)
        units = u_res.json() if isinstance(u_res.json(), list) else u_res.json().get("items", [])
        
        create_p_res = httpx.post(
            f"{BASE_URL}/api/v1/products",
            json={
                "sku": "PROD01",
                "designation": "Balance Industrielle PROD01",
                "category_id": cats[0]["id"],
                "product_type_id": pts[0]["id"],
                "unit_id": units[0]["id"],
                "price_ht": 1500.0,
                "track_stock": True,
                "is_active": True,
            },
            headers=headers
        )
        assert create_p_res.status_code == 201, create_p_res.text
        prod01 = create_p_res.json()
    
    print(f"[OK] Product: {prod01['sku']} — {prod01['designation']} (ID={prod01['id']})")
    
    # 3. Check Initial Stock in MAG01
    stock_res = httpx.get(f"{BASE_URL}/api/v1/stock?product_id={prod01['id']}&warehouse_id={mag01['id']}", headers=headers)
    stock_items = stock_res.json() if isinstance(stock_res.json(), list) else stock_res.json().get("items", [])
    initial_stock = sum(float(s.get("quantity", 0)) for s in stock_items if s.get("warehouse_id") == mag01["id"])
    print(f"[OK] Initial stock in {mag01['code']}: {initial_stock}")
    
    # 4. Get Supplier
    supp_res = httpx.get(f"{BASE_URL}/api/v1/suppliers?size=1", headers=headers)
    suppliers = supp_res.json() if isinstance(supp_res.json(), list) else supp_res.json().get("items", [])
    if not suppliers:
        create_s = httpx.post(
            f"{BASE_URL}/api/v1/suppliers",
            json={"legal_name": "Fournisseur Principal SARL", "partner_type": "SUPPLIER", "is_active": True},
            headers=headers
        )
        supplier_id = create_s.json()["id"]
    else:
        supplier_id = suppliers[0]["id"]
        
    # 5. Create Purchase Order
    po_res = httpx.post(
        f"{BASE_URL}/api/v1/purchases",
        json={
            "supplier_id": supplier_id,
            "items": [
                {"product_id": prod01["id"], "quantity_ordered": 10.0, "unit_price_ht": 1500.0, "tax_rate": 20.0, "discount_rate": 0.0}
            ]
        },
        headers=headers
    )
    assert po_res.status_code == 201, po_res.text
    po = po_res.json()
    po_id = po["id"]
    po_item_id = po["items"][0]["id"]
    print(f"[OK] Created Purchase Order #{po['reference']} (ID={po_id})")
    
    # 6. Approve Purchase Order
    app_res = httpx.post(f"{BASE_URL}/api/v1/purchases/{po_id}/approve", headers=headers)
    assert app_res.status_code == 200, app_res.text
    print(f"[OK] Approved Purchase Order #{po['reference']}")
    
    # 7. Confirm Receipt of 8 units into MAG01
    receipt_payload = {
        "reference": f"BL-MAG01-{po_id}",
        "purchase_order_id": po_id,
        "warehouse_id": mag01["id"],
        "notes": "Reception MAG01 8 unites",
        "items": [
            {
                "purchase_order_item_id": po_item_id,
                "product_id": prod01["id"],
                "quantity_received": 8.0,
                "warehouse_id": mag01["id"],
                "notes": None
            }
        ]
    }
    
    rec_res = httpx.post(f"{BASE_URL}/api/v1/purchase-receipts", json=receipt_payload, headers=headers)
    assert rec_res.status_code == 201, rec_res.text
    receipt = rec_res.json()
    receipt_id = receipt["id"]
    print(f"[OK] Receipt #{receipt['reference']} (ID={receipt_id}) confirmed into warehouse {receipt.get('warehouse_id')}")
    
    # 8. Verify Stock Level in MAG01 increased by 8
    stock_after_res = httpx.get(f"{BASE_URL}/api/v1/stock?product_id={prod01['id']}&warehouse_id={mag01['id']}", headers=headers)
    stock_after_items = stock_after_res.json() if isinstance(stock_after_res.json(), list) else stock_after_res.json().get("items", [])
    mag01_balances = [s for s in stock_after_items if s.get("warehouse_id") == mag01["id"]]
    final_stock = sum(float(s.get("quantity", 0)) for s in mag01_balances)
    expected_stock = initial_stock + 8.0
    print(f"[OK] Stock after in {mag01['code']}: {final_stock} (expected: {expected_stock})")
    assert final_stock == expected_stock, f"Expected {expected_stock}, got {final_stock}"
    
    # 9. Verify Stock Movements
    mov_res = httpx.get(f"{BASE_URL}/api/v1/stock/movements?product_id={prod01['id']}&warehouse_id={mag01['id']}", headers=headers)
    movements = mov_res.json() if isinstance(mov_res.json(), list) else mov_res.json().get("items", [])
    matching_movement = next((m for m in movements if m.get("reference_id") == receipt_id and m.get("movement_type") == "PURCHASE_RECEIPT"), None)
    assert matching_movement is not None, f"No matching PURCHASE_RECEIPT movement found for receipt_id={receipt_id}"
    print(f"[OK] Verified Stock Movement ID={matching_movement['id']}: type={matching_movement['movement_type']}, qty={matching_movement['quantity']}, warehouse_id={matching_movement['warehouse_id']}")
    
    print("\n==================================================")
    print("SUCCESS: REAL MAG01 RECEPTION VERIFIED END-TO-END!")
    print("==================================================")

if __name__ == "__main__":
    run_test()
