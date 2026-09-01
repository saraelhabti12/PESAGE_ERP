import httpx
import time

def verify_all_phase4e_requirements():
    client = httpx.Client()

    print("=== PHASE 4E COMPLETE PESAGE 2000 THEME REBUILD VERIFICATION RUN ===")

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

    print("\n -> ALL PHASE 4E PESAGE 2000 BRAND THEME REBUILD CHECKS PASSED PERFECTLY!")

if __name__ == "__main__":
    verify_all_phase4e_requirements()
