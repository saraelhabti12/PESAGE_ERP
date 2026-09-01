import httpx
import time

def verify_phase4c_layout_architecture():
    client = httpx.Client()

    print("=== PHASE 4C LAYOUT ARCHITECTURE VERIFICATION ===")

    # 1. Frontend served at http://localhost:5173
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

    # 4. Fetch Products Catalog via API
    r_prod_list = client.get("http://localhost:8000/api/v1/products", headers=headers)
    print("4. PRODUCTS CATALOG API STATUS:", r_prod_list.status_code, "Total products:", len(r_prod_list.json()))
    assert r_prod_list.status_code == 200

    print("\n -> ALL PHASE 4C LAYOUT ARCHITECTURE VERIFICATIONS PASSED PERFECTLY!")

if __name__ == "__main__":
    verify_phase4c_layout_architecture()
