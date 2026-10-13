import httpx

def run_audit():
    client = httpx.Client(base_url='http://localhost:8000', timeout=10.0)
    # 1. Login
    login_res = client.post(
        '/api/v1/auth/login',
        json={'email': 'admin@example.com', 'password': 'CHANGE_THIS_PASSWORD'}
    )

    assert login_res.status_code == 200, f"Login failed: {login_res.text}"
    token = login_res.json()['access_token']
    headers = {'Authorization': f'Bearer {token}'}
    print("[1] Login successful as ADMIN.")

    # 2. Get Sales list, create VTE-202609-0001 if needed
    sales_res = client.get('/api/v1/sales', headers=headers)
    assert sales_res.status_code == 200
    sales = sales_res.json()
    sale_vte = next((s for s in sales if s['reference'] == 'VTE-202609-0001'), None)
    if not sale_vte:
        # Create partner ITS
        p_res = client.post('/api/v1/partners', headers=headers, json={
            "code": "CLI-ITS",
            "legal_name": "ITS",
            "partner_type": "CUSTOMER",
            "email": "contact@its.ma",
            "phone": "0522112233",
            "address": "Bd d'Anfa, Casablanca",
        })
        cust_id = p_res.json()['id']

        # Create category
        cat_res = client.post('/api/v1/categories', headers=headers, json={"name": "Capteurs", "code": "CAP"})
        cat_id = cat_res.json()['id']
        type_res = client.post('/api/v1/product-types', headers=headers, json={"name": "Électronique", "code": "ELEC"})
        type_id = type_res.json()['id']
        unit_res = client.post('/api/v1/units', headers=headers, json={"name": "Pièce", "abbreviation": "PCE"})
        unit_id = unit_res.json()['id']

        wh_res = client.post('/api/v1/warehouses', headers=headers, json={"name": "Atelier casablanca", "code": "WH-CASA", "type": "MAIN"})
        wh_id = wh_res.json()['id']

        prod_res = client.post('/api/v1/products', headers=headers, json={
            "sku": "PROD002",
            "designation": "Capteure Electrique",
            "category_id": cat_id,
            "product_type_id": type_id,
            "unit_id": unit_id,
            "purchase_price": 500.0,
            "sale_price": 1000.0,
            "tax_rate": 20.0,
            "track_stock": True,
        })
        prod_id = prod_res.json()['id']

        # Adjust stock to 200 units
        client.post('/api/v1/stock/adjustments', headers=headers, json={
            "product_id": prod_id,
            "warehouse_id": wh_id,
            "new_quantity": 200.0,
            "reason": "Stock initial"
        })

        # Create sale VTE-202609-0001
        new_sale_res = client.post('/api/v1/sales', headers=headers, json={
            "reference": "VTE-202609-0001",
            "customer_id": cust_id,
            "items": [
                {
                    "product_id": prod_id,
                    "warehouse_id": wh_id,
                    "quantity": 100.0,
                    "unit_price_ht": 1000.0,
                    "discount_rate": 0.0,
                    "tax_rate": 20.0
                }
            ]
        })
        sale_vte = new_sale_res.json()
        # Confirm sale
        client.post(f"/api/v1/sales/{sale_vte['id']}/confirm", headers=headers)
        sale_vte['status'] = 'CONFIRMED'

    print(f"[2] Found/Created Sale: {sale_vte['id']} | Ref: {sale_vte['reference']} | Status: {sale_vte['status']}")


    # 3. Request Sale Delivery Progress (as modal does on select)
    sale_id = sale_vte['id']
    progress_url = f'/api/v1/delivery-notes/sales/{sale_id}/delivery-progress'
    prog_res = client.get(progress_url, headers=headers)
    assert prog_res.status_code == 200, f"Progress request failed: {prog_res.text}"
    prog_data = prog_res.json()
    print(f"[3] Progress response HTTP {prog_res.status_code}: {prog_data}")
    assert len(prog_data['items']) > 0, "No items in progress"
    item = prog_data['items'][0]
    print(f"    Item: {item['product_name']} | SKU: {item['product_sku']} | Warehouse: {item['warehouse_name']} | Ordered: {item['ordered_quantity']} | Delivered: {item['delivered_quantity']} | Remaining: {item['remaining_quantity']}")

    # 4. Stock Balance before BL
    p_id = item['product_id']
    w_id = item['warehouse_id']
    bal_before_res = client.get(f'/api/v1/stock/balance?product_id={p_id}&warehouse_id={w_id}', headers=headers)
    stock_before = bal_before_res.json()
    print(f"[4] Stock balance BEFORE BL creation: {stock_before}")

    # 5. Create Delivery Note
    bl_payload = {
        'sale_id': sale_id,
        'delivery_date': '2026-09-22T12:00:00Z',
        'shipping_address': 'Zone Industrielle, Casablanca',
        'tracking_number': 'CTM-LIV-001',
        'notes': 'Première livraison partielle',
        'items': [
            {
                'sale_item_id': item['sale_item_id'],
                'delivered_quantity': 40.0,
                'notes': 'Colis 1 & 2'
            }
        ]
    }
    bl_res = client.post('/api/v1/delivery-notes', headers=headers, json=bl_payload)
    assert bl_res.status_code == 201, f"BL Creation failed: {bl_res.text}"
    created_bl = bl_res.json()
    print(f"[5] BL Created HTTP 201: Ref={created_bl['reference']} | Status={created_bl['status']}")
    print(f"    Lines: {created_bl['items']}")

    # 6. Stock Balance after BL (MUST BE IDENTICAL)
    bal_after_res = client.get(f'/api/v1/stock/balance?product_id={p_id}&warehouse_id={w_id}', headers=headers)
    stock_after = bal_after_res.json()
    print(f"[6] Stock balance AFTER BL creation: {stock_after}")
    assert stock_before['available_quantity'] == stock_after['available_quantity'], "ERROR: Stock quantity was changed by BL creation!"
    print("    -> VERIFIED: Stock was NOT deducted a second time!")

    # 7. Progress after partial delivery
    prog_res_after = client.get(progress_url, headers=headers).json()
    print(f"[7] Delivery Progress AFTER partial BL: {prog_res_after['items'][0]}")
    assert prog_res_after['items'][0]['delivered_quantity'] == 40.0
    assert prog_res_after['items'][0]['remaining_quantity'] == 60.0

    # 8. Check Sale status
    sale_after = client.get(f'/api/v1/sales/{sale_id}', headers=headers).json()
    print(f"[8] Sale status AFTER partial BL: {sale_after['status']}")
    assert sale_after['status'] == 'PARTIALLY_DELIVERED'

    # 9. Over-delivery check (deliver 70 when remaining is 60)
    over_payload = {
        'sale_id': sale_id,
        'items': [
            {
                'sale_item_id': item['sale_item_id'],
                'delivered_quantity': 70.0,
            }
        ]
    }
    over_res = client.post('/api/v1/delivery-notes', headers=headers, json=over_payload)
    print(f"[9] Over-delivery rejection test: HTTP {over_res.status_code} -> {over_res.text}")
    assert over_res.status_code == 400
    assert "supérieure au reste à livrer" in over_res.text

    # 10. Deliver remaining 60 units
    bl2_payload = {
        'sale_id': sale_id,
        'items': [
            {
                'sale_item_id': item['sale_item_id'],
                'delivered_quantity': 60.0,
            }
        ]
    }
    bl2_res = client.post('/api/v1/delivery-notes', headers=headers, json=bl2_payload)
    assert bl2_res.status_code == 201
    print(f"[10] Full delivery completed with BL {bl2_res.json()['reference']}")

    # 11. Final sale status
    final_sale = client.get(f'/api/v1/sales/{sale_id}', headers=headers).json()
    print(f"[11] Final Sale status: {final_sale['status']}")
    assert final_sale['status'] == 'DELIVERED'

    # 12. List Delivery Notes
    dns_res = client.get('/api/v1/delivery-notes', headers=headers)
    print(f"[12] Total Delivery Notes in database: {len(dns_res.json())}")

    print("\nALL AUDIT CHECKS PASSED SUCCESSFULLY!")


if __name__ == '__main__':
    run_audit()
