import httpx

def verify_phase4b():
    client = httpx.Client()

    # 1. Verify Frontend React App served at http://localhost:5173
    r_fe = client.get("http://localhost:5173")
    print("1. FRONTEND HTTP STATUS:", r_fe.status_code)
    assert r_fe.status_code == 200
    assert '<div id="root"></div>' in r_fe.text
    print("   -> Frontend React application cleanly served at http://localhost:5173")

    # 2. Login as Admin
    r_login = client.post("http://localhost:8000/api/v1/auth/login", json={
        "email": "admin@example.com",
        "password": "CHANGE_THIS_PASSWORD"
    })
    print("2. LOGIN STATUS:", r_login.status_code)
    assert r_login.status_code == 200
    tokens = r_login.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    # 3. Create French Category
    r_cat = client.post("http://localhost:8000/api/v1/categories", json={
        "name": "Matériel Électrique",
        "code": "CAT-ELEC-FR",
        "description": "Catégorie matériel électrique et câblage"
    }, headers=headers)
    print("3. CATEGORY CREATION:", r_cat.status_code, r_cat.json()["name"])
    assert r_cat.status_code == 201
    cat_id = r_cat.json()["id"]

    # 4. Create French Product Type
    r_type = client.post("http://localhost:8000/api/v1/product-types", json={
        "name": "Composant Électronique",
        "code": "TYPE-ELEC-FR",
        "description": "Composants et modules électroniques"
    }, headers=headers)
    print("4. PRODUCT TYPE CREATION:", r_type.status_code, r_type.json()["name"])
    assert r_type.status_code == 201
    type_id = r_type.json()["id"]

    # 5. Create French Brand
    r_brand = client.post("http://localhost:8000/api/v1/brands", json={
        "name": "Schneider Electric Maroc",
        "code": "BRAND-SCHNEIDER",
        "description": "Fabricant Schneider Electric"
    }, headers=headers)
    print("5. BRAND CREATION:", r_brand.status_code, r_brand.json()["name"])
    assert r_brand.status_code == 201
    brand_id = r_brand.json()["id"]

    # 6. Create French Unit
    r_unit = client.post("http://localhost:8000/api/v1/units", json={
        "name": "Unité",
        "abbreviation": "U",
        "description": "Unité individuelle"
    }, headers=headers)
    print("6. UNIT CREATION:", r_unit.status_code, r_unit.json()["name"])
    assert r_unit.status_code == 201
    unit_id = r_unit.json()["id"]

    # 7. Create French Product
    r_prod = client.post("http://localhost:8000/api/v1/products", json={
        "sku": "SCH-DISJ-32A",
        "designation": "Disjoncteur Magnétothermique 32A Schneider",
        "description": "Disjoncteur modulaires 3P 32A pour tableau électrique",
        "category_id": cat_id,
        "product_type_id": type_id,
        "brand_id": brand_id,
        "unit_id": unit_id,
        "barcode": "6111000200300",
        "purchase_price": 250.00,
        "sale_price": 380.00,
        "tax_rate": 20.00,
        "is_active": True,
        "track_stock": True
    }, headers=headers)
    print("7. PRODUCT CREATION:", r_prod.status_code, r_prod.json()["sku"])
    assert r_prod.status_code == 201

    print("\n   -> ALL PHASE 4B REGRESSION CHECKS & API CONNECTIVITY PASSED PERFECTLY!")

if __name__ == "__main__":
    verify_phase4b()
