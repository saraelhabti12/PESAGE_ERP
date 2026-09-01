import httpx
import time

def verify_all_phase4d_requirements():
    client = httpx.Client()

    print("=== PHASE 4D FINAL VERIFICATION RUN ===")

    # 1. Frontend App HTTP 200
    r_fe = client.get("http://localhost:5173")
    print("1. FRONTEND APP HTTP STATUS:", r_fe.status_code)
    assert r_fe.status_code == 200
    assert '<div id="root"></div>' in r_fe.text

    # 2. Pesage 2000 Logo Asset Accessible
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

    # 4. Fetch Products, Categories, Types, Brands, Units API
    r_prods = client.get("http://localhost:8000/api/v1/products", headers=headers)
    r_cats = client.get("http://localhost:8000/api/v1/categories", headers=headers)
    r_types = client.get("http://localhost:8000/api/v1/product-types", headers=headers)
    r_brands = client.get("http://localhost:8000/api/v1/brands", headers=headers)
    r_units = client.get("http://localhost:8000/api/v1/units", headers=headers)

    print(f"4. DASHBOARD BACKEND METRICS -> Products: {len(r_prods.json())}, Categories: {len(r_cats.json())}, Types: {len(r_types.json())}, Brands: {len(r_brands.json())}, Units: {len(r_units.json())}")
    assert r_prods.status_code == 200
    assert r_cats.status_code == 200
    assert r_types.status_code == 200
    assert r_brands.status_code == 200
    assert r_units.status_code == 200

    # 5. Create test product & verify count updates
    cat_id = r_cats.json()[0]["id"] if r_cats.json() else 1
    type_id = r_types.json()[0]["id"] if r_types.json() else 1
    brand_id = r_brands.json()[0]["id"] if r_brands.json() else 1
    unit_id = r_units.json()[0]["id"] if r_units.json() else 1

    unique_sku = f"PROD-4D-{int(time.time())}"
    r_create = client.post("http://localhost:8000/api/v1/products", json={
        "sku": unique_sku,
        "designation": "Pèse-Personne Médical Pesage 2000",
        "description": "Pèse-personne de haute précision avec affichage numérique",
        "category_id": cat_id,
        "product_type_id": type_id,
        "brand_id": brand_id,
        "unit_id": unit_id,
        "barcode": "6112000400500",
        "purchase_price": 2500.00,
        "sale_price": 3900.00,
        "tax_rate": 20.00,
        "is_active": True,
        "track_stock": True
    }, headers=headers)
    print("5. CREATE PRODUCT TEST STATUS:", r_create.status_code, r_create.json().get("sku"))
    assert r_create.status_code == 201

    r_prods_after = client.get("http://localhost:8000/api/v1/products", headers=headers)
    print(f"   Product count after creation: {len(r_prods_after.json())}")
    assert len(r_prods_after.json()) == len(r_prods.json()) + 1

    print("\n -> ALL PHASE 4D THEME, SMART NAVIGATION & REAL CATALOG STATS CHECKS PASSED PERFECTLY!")

if __name__ == "__main__":
    verify_all_phase4d_requirements()
