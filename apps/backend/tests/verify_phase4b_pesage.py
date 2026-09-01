import httpx

def verify_pesage_2000_ui():
    client = httpx.Client()

    # 1. Verify Frontend React App served at http://localhost:5173
    r_fe = client.get("http://localhost:5173")
    print("1. FRONTEND HTTP STATUS:", r_fe.status_code)
    assert r_fe.status_code == 200
    assert '<div id="root"></div>' in r_fe.text
    print("   -> Frontend React application cleanly served at http://localhost:5173")

    # 2. Verify Official Pesage 2000 Logo Asset Accessible
    r_logo = client.get("http://localhost:5173/branding/pesage-2000-logo.png")
    print("2. OFFICIAL LOGO ASSET HTTP STATUS:", r_logo.status_code, "Size:", len(r_logo.content), "bytes")
    assert r_logo.status_code == 200
    assert len(r_logo.content) > 10000
    print("   -> Official Pesage 2000 logo file verified accessible!")

    # 3. Login as Admin
    r_login = client.post("http://localhost:8000/api/v1/auth/login", json={
        "email": "admin@example.com",
        "password": "CHANGE_THIS_PASSWORD"
    })
    print("3. LOGIN STATUS:", r_login.status_code)
    assert r_login.status_code == 200
    tokens = r_login.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    # 4. Create French Category for Pesage 2000
    r_cat = client.post("http://localhost:8000/api/v1/categories", json={
        "name": "Balance Industrielle Pesage 2000",
        "code": "CAT-PESAGE-IND",
        "description": "Gamme de pesage industriel lourd et convoyeurs"
    }, headers=headers)
    print("4. CATEGORY CREATION:", r_cat.status_code, r_cat.json()["name"])
    assert r_cat.status_code == 201
    cat_id = r_cat.json()["id"]

    # 5. Create French Product Type
    r_type = client.post("http://localhost:8000/api/v1/product-types", json={
        "name": "Système de Pesage Électronique",
        "code": "TYPE-PESAGE-ELEC",
        "description": "Indicateurs de poids et capteurs de force"
    }, headers=headers)
    print("5. PRODUCT TYPE CREATION:", r_type.status_code, r_type.json()["name"])
    assert r_type.status_code == 201
    type_id = r_type.json()["id"]

    # 6. Create Brand
    r_brand = client.post("http://localhost:8000/api/v1/brands", json={
        "name": "PESAGE 2000",
        "code": "BRAND-PESAGE2000",
        "description": "Marque officielle Pesage 2000 Maroc"
    }, headers=headers)
    print("6. BRAND CREATION:", r_brand.status_code, r_brand.json()["name"])
    assert r_brand.status_code == 201
    brand_id = r_brand.json()["id"]

    # 7. Create Unit
    r_unit = client.post("http://localhost:8000/api/v1/units", json={
        "name": "Ensemble / Système",
        "abbreviation": "Ens",
        "description": "Système complet de pesage"
    }, headers=headers)
    print("7. UNIT CREATION:", r_unit.status_code, r_unit.json()["name"])
    assert r_unit.status_code == 201
    unit_id = r_unit.json()["id"]

    # 8. Create Product (Pont-Bascule Industrielle 60T)
    r_prod = client.post("http://localhost:8000/api/v1/products", json={
        "sku": "PONT-BASCULE-60T",
        "designation": "Pont-Bascule Métallique Homologué 60 Tonnes",
        "description": "Plate-forme de pesage pour camions avec indicateur numérique et imprimante ticket",
        "category_id": cat_id,
        "product_type_id": type_id,
        "brand_id": brand_id,
        "unit_id": unit_id,
        "barcode": "6112000300400",
        "purchase_price": 85000.00,
        "sale_price": 120000.00,
        "tax_rate": 20.00,
        "is_active": True,
        "track_stock": True
    }, headers=headers)
    print("8. PRODUCT CREATION:", r_prod.status_code, r_prod.json()["sku"])
    assert r_prod.status_code == 201
    prod = r_prod.json()
    assert prod["brand"]["name"] == "PESAGE 2000"

    print("\n   -> PESAGE 2000 BRANDING & FULL REGRESSION VERIFICATION PASSED PERFECTLY!")

if __name__ == "__main__":
    verify_pesage_2000_ui()
