import httpx
import time

def verify_all_phase4b_requirements():
    client = httpx.Client()

    print("=== PHASE 4B FINAL VERIFICATION RUN ===")

    # 1. Frontend served at http://localhost:5173
    r_fe = client.get("http://localhost:5173")
    print("1. FRONTEND APP HTTP STATUS:", r_fe.status_code)
    assert r_fe.status_code == 200
    assert '<div id="root"></div>' in r_fe.text

    # 2. Official Logo asset accessible
    r_logo = client.get("http://localhost:5173/branding/pesage-2000-logo.png")
    print("2. PESAGE 2000 LOGO STATUS:", r_logo.status_code, "Size:", len(r_logo.content), "bytes")
    assert r_logo.status_code == 200
    assert len(r_logo.content) > 10000

    # 3. Admin Authentication Login
    r_login = client.post("http://localhost:8000/api/v1/auth/login", json={
        "email": "admin@example.com",
        "password": "CHANGE_THIS_PASSWORD"
    })
    print("3. ADMIN LOGIN STATUS:", r_login.status_code)
    assert r_login.status_code == 200
    tokens = r_login.json()
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    # Fetch Category, Type, Brand, Unit IDs dynamically
    cats = client.get("http://localhost:8000/api/v1/categories", headers=headers).json()
    types = client.get("http://localhost:8000/api/v1/product-types", headers=headers).json()
    brands = client.get("http://localhost:8000/api/v1/brands", headers=headers).json()
    units = client.get("http://localhost:8000/api/v1/units", headers=headers).json()

    cat_id = cats[0]["id"] if cats else 1
    type_id = types[0]["id"] if types else 1
    brand_id = brands[0]["id"] if brands else 1
    unit_id = units[0]["id"] if units else 1

    # 4. Fetch Products Catalog via API
    r_prod_list = client.get("http://localhost:8000/api/v1/products", headers=headers)
    print("4. PRODUCTS LIST API STATUS:", r_prod_list.status_code, "Total products:", len(r_prod_list.json()))
    assert r_prod_list.status_code == 200

    # 5. Create new Product with valid foreign key IDs
    unique_sku = f"PROD-FINAL-{int(time.time())}"
    r_create = client.post("http://localhost:8000/api/v1/products", json={
        "sku": unique_sku,
        "designation": "Balance Électronique Pesage 2000 High-Precision",
        "description": "Système de pesage de précision avec plateau inox",
        "category_id": cat_id,
        "product_type_id": type_id,
        "brand_id": brand_id,
        "unit_id": unit_id,
        "barcode": "6112000500600",
        "purchase_price": 12500.00,
        "sale_price": 18900.00,
        "tax_rate": 20.00,
        "is_active": True,
        "track_stock": True
    }, headers=headers)
    print("5. CREATE PRODUCT STATUS:", r_create.status_code, r_create.json().get("sku"))
    assert r_create.status_code == 201

    print("\n -> ALL PHASE 4B VISUAL & FUNCTIONAL INTEGRATION CHECKS PASSED PERFECTLY!")

if __name__ == "__main__":
    verify_all_phase4b_requirements()
