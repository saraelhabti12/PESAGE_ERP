import httpx

def run_verification():
    client = httpx.Client()

    # 1. Verify Frontend react page
    r_fe = client.get("http://localhost:5173")
    print("1. FRONTEND HTTP STATUS:", r_fe.status_code)
    assert r_fe.status_code == 200
    assert '<div id="root"></div>' in r_fe.text
    print("   -> React App served cleanly at http://localhost:5173")

    # 2. Login as Admin
    r_login = client.post("http://localhost:8000/api/v1/auth/login", json={
        "email": "admin@example.com",
        "password": "CHANGE_THIS_PASSWORD"
    })
    print("2. LOGIN STATUS:", r_login.status_code)
    assert r_login.status_code == 200
    tokens = r_login.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    # 3. Create Category via API
    r_cat = client.post("http://localhost:8000/api/v1/categories", json={
        "name": "Industrial Robotics",
        "code": "CAT-ROBOT",
        "description": "Robotics category"
    }, headers=headers)
    print("3. CATEGORY CREATION:", r_cat.status_code, r_cat.json()["name"])
    assert r_cat.status_code == 201
    cat_id = r_cat.json()["id"]

    # 4. Create Product Type via API
    r_type = client.post("http://localhost:8000/api/v1/product-types", json={
        "name": "Heavy Machinery",
        "code": "TYPE-HEAVY",
        "description": "Machinery product type"
    }, headers=headers)
    print("4. PRODUCT TYPE CREATION:", r_type.status_code, r_type.json()["name"])
    assert r_type.status_code == 201
    type_id = r_type.json()["id"]

    # 5. Create Brand via API
    r_brand = client.post("http://localhost:8000/api/v1/brands", json={
        "name": "ABB Automation",
        "code": "BRAND-ABB",
        "description": "ABB Manufacturer"
    }, headers=headers)
    print("5. BRAND CREATION:", r_brand.status_code, r_brand.json()["name"])
    assert r_brand.status_code == 201
    brand_id = r_brand.json()["id"]

    # 6. Create Unit via API
    r_unit = client.post("http://localhost:8000/api/v1/units", json={
        "name": "Pack of 10",
        "abbreviation": "Pk10",
        "description": "Packaging unit"
    }, headers=headers)
    print("6. UNIT CREATION:", r_unit.status_code, r_unit.json()["name"])
    assert r_unit.status_code == 201
    unit_id = r_unit.json()["id"]

    # 7. Create Product via API using referenced IDs
    r_prod = client.post("http://localhost:8000/api/v1/products", json={
        "sku": "ROBOT-ABB-IRB120",
        "designation": "ABB IRB 120 Industrial Robot Arm",
        "description": "6-axis compact industrial robot",
        "category_id": cat_id,
        "product_type_id": type_id,
        "brand_id": brand_id,
        "unit_id": unit_id,
        "barcode": "7612345678901",
        "purchase_price": 12500.00,
        "sale_price": 18900.00,
        "tax_rate": 20.00,
        "is_active": True,
        "track_stock": True
    }, headers=headers)
    print("7. PRODUCT CREATION:", r_prod.status_code, r_prod.json()["sku"])
    assert r_prod.status_code == 201
    prod = r_prod.json()
    assert prod["category"]["name"] == "Industrial Robotics"
    assert prod["product_type"]["name"] == "Heavy Machinery"
    assert prod["brand"]["name"] == "ABB Automation"
    assert prod["unit"]["abbreviation"] == "Pk10"

    # 8. List & Search Products
    r_search = client.get("http://localhost:8000/api/v1/products?search=IRB120", headers=headers)
    print("8. PRODUCT SEARCH RESULT STATUS:", r_search.status_code, len(r_search.json()), "items found")
    assert r_search.status_code == 200
    assert len(r_search.json()) >= 1
    print("   -> END-TO-END PHASE 4A VERIFICATION SUCCESSFUL!")

if __name__ == "__main__":
    run_verification()
