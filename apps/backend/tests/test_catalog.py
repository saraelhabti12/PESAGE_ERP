import pytest
from fastapi.testclient import TestClient

def get_auth_header(client: TestClient, email: str = "admin@example.com", password: str = "CHANGE_THIS_PASSWORD") -> dict:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ----------------------------------------------------
# CATEGORIES TESTS
# ----------------------------------------------------
def test_category_crud_and_validations(client: TestClient):
    headers = get_auth_header(client)

    # 1. Create Category
    payload = {"name": "Electronics", "code": "CAT-ELEC", "description": "Electronic gadgets"}
    r = client.post("/api/v1/categories", json=payload, headers=headers)
    assert r.status_code == 201, f"Category creation failed: {r.text}"
    cat = r.json()
    assert cat["name"] == "Electronics"
    assert cat["code"] == "CAT-ELEC"
    cat_id = cat["id"]

    # 2. Duplicate Name Rejection
    r_dup_name = client.post("/api/v1/categories", json={"name": "Electronics", "code": "CAT-ELEC2"}, headers=headers)
    assert r_dup_name.status_code == 400
    assert "name already exists" in r_dup_name.json()["error"]["message"]

    # 3. Duplicate Code Rejection
    r_dup_code = client.post("/api/v1/categories", json={"name": "Electronics2", "code": "CAT-ELEC"}, headers=headers)
    assert r_dup_code.status_code == 400
    assert "code already exists" in r_dup_code.json()["error"]["message"]

    # 4. Get Category
    r_get = client.get(f"/api/v1/categories/{cat_id}", headers=headers)
    assert r_get.status_code == 200
    assert r_get.json()["id"] == cat_id

    # 5. Update Category
    r_upd = client.put(f"/api/v1/categories/{cat_id}", json={"description": "Updated description"}, headers=headers)
    assert r_upd.status_code == 200
    assert r_upd.json()["description"] == "Updated description"

    # 6. Delete (Deactivate) Category
    r_del = client.delete(f"/api/v1/categories/{cat_id}", headers=headers)
    assert r_del.status_code == 200
    assert r_del.json()["is_active"] is False


# ----------------------------------------------------
# PRODUCT TYPES TESTS
# ----------------------------------------------------
def test_product_type_crud_and_validations(client: TestClient):
    headers = get_auth_header(client)

    # Create Product Type
    r = client.post("/api/v1/product-types", json={"name": "Equipment", "code": "TYPE-EQP"}, headers=headers)
    assert r.status_code == 201, f"ProductType creation failed: {r.text}"
    type_id = r.json()["id"]

    # Duplicate rejection
    r_dup = client.post("/api/v1/product-types", json={"name": "Equipment", "code": "TYPE-EQP2"}, headers=headers)
    assert r_dup.status_code == 400

    # Get & Update
    r_get = client.get(f"/api/v1/product-types/{type_id}", headers=headers)
    assert r_get.status_code == 200

    r_upd = client.put(f"/api/v1/product-types/{type_id}", json={"name": "Heavy Equipment"}, headers=headers)
    assert r_upd.status_code == 200
    assert r_upd.json()["name"] == "Heavy Equipment"


# ----------------------------------------------------
# BRANDS TESTS
# ----------------------------------------------------
def test_brand_crud_and_validations(client: TestClient):
    headers = get_auth_header(client)

    r = client.post("/api/v1/brands", json={"name": "Logitech", "code": "BRAND-LOGI"}, headers=headers)
    assert r.status_code == 201, f"Brand creation failed: {r.text}"
    brand_id = r.json()["id"]

    r_dup = client.post("/api/v1/brands", json={"name": "Logitech", "code": "BRAND-LOGI2"}, headers=headers)
    assert r_dup.status_code == 400

    r_get = client.get(f"/api/v1/brands/{brand_id}", headers=headers)
    assert r_get.status_code == 200


# ----------------------------------------------------
# UNITS TESTS
# ----------------------------------------------------
def test_unit_crud_and_validations(client: TestClient):
    headers = get_auth_header(client)

    r = client.post("/api/v1/units", json={"name": "Piece", "abbreviation": "Pcs"}, headers=headers)
    assert r.status_code == 201, f"Unit creation failed: {r.text}"
    unit_id = r.json()["id"]

    r_dup = client.post("/api/v1/units", json={"name": "Piece", "abbreviation": "Pcs"}, headers=headers)
    assert r_dup.status_code == 400

    r_get = client.get(f"/api/v1/units/{unit_id}", headers=headers)
    assert r_get.status_code == 200


# ----------------------------------------------------
# PRODUCTS TESTS & REJECTIONS
# ----------------------------------------------------
def test_product_crud_and_business_rules(client: TestClient):
    headers = get_auth_header(client)

    # Seed active references
    cat_res = client.post("/api/v1/categories", json={"name": "Hardware", "code": "CAT-HW"}, headers=headers)
    assert cat_res.status_code == 201, f"Hardware Category creation failed: {cat_res.text}"
    cat = cat_res.json()

    ptype_res = client.post("/api/v1/product-types", json={"name": "Hardware Type", "code": "TYPE-HW"}, headers=headers)
    assert ptype_res.status_code == 201, f"Hardware Type creation failed: {ptype_res.text}"
    ptype = ptype_res.json()

    brand_res = client.post("/api/v1/brands", json={"name": "Dell", "code": "BRAND-DELL"}, headers=headers)
    assert brand_res.status_code == 201, f"Dell Brand creation failed: {brand_res.text}"
    brand = brand_res.json()

    unit_res = client.post("/api/v1/units", json={"name": "Kilogram", "abbreviation": "Kg"}, headers=headers)
    assert unit_res.status_code == 201, f"Kg Unit creation failed: {unit_res.text}"
    unit = unit_res.json()

    # 1. Successful Product Creation
    prod_payload = {
        "sku": "SKU-DELL-001",
        "designation": "Dell XPS 15",
        "description": "High performance laptop",
        "category_id": cat["id"],
        "product_type_id": ptype["id"],
        "brand_id": brand["id"],
        "unit_id": unit["id"],
        "barcode": "1234567890123",
        "purchase_price": 1000.00,
        "sale_price": 1500.00,
        "tax_rate": 20.00,
        "is_active": True,
        "track_stock": True,
    }
    r_prod = client.post("/api/v1/products", json=prod_payload, headers=headers)
    assert r_prod.status_code == 201, f"Product creation failed: {r_prod.text}"
    p = r_prod.json()
    assert p["sku"] == "SKU-DELL-001"
    assert p["category"]["name"] == "Hardware"
    assert p["brand"]["name"] == "Dell"
    product_id = p["id"]

    # 2. Duplicate SKU Rejection
    r_dup_sku = client.post("/api/v1/products", json={**prod_payload, "barcode": "999999"}, headers=headers)
    assert r_dup_sku.status_code == 400, f"Expected 400, got {r_dup_sku.status_code}: {r_dup_sku.text}"
    assert "SKU already exists" in r_dup_sku.json()["error"]["message"]

    # 3. Duplicate Barcode Rejection
    r_dup_bar = client.post("/api/v1/products", json={**prod_payload, "sku": "SKU-DELL-002"}, headers=headers)
    assert r_dup_bar.status_code == 400, f"Expected 400, got {r_dup_bar.status_code}: {r_dup_bar.text}"
    assert "barcode already exists" in r_dup_bar.json()["error"]["message"]

    # 4. Inactive Category Rejection
    client.delete(f"/api/v1/categories/{cat['id']}", headers=headers)
    r_inact_cat = client.post("/api/v1/products", json={**prod_payload, "sku": "SKU-DELL-003", "barcode": None}, headers=headers)
    assert r_inact_cat.status_code == 400
    assert "inactive category" in r_inact_cat.json()["error"]["message"]

    # 5. Get Product
    r_get = client.get(f"/api/v1/products/{product_id}", headers=headers)
    assert r_get.status_code == 200
    assert r_get.json()["sku"] == "SKU-DELL-001"

    # 6. List Products with Search & Filter
    r_list = client.get("/api/v1/products?search=Dell", headers=headers)
    assert r_list.status_code == 200
    assert len(r_list.json()) >= 1


# ----------------------------------------------------
# UNAUTHENTICATED & PERMISSION DENIED RBAC TESTS
# ----------------------------------------------------
def test_catalog_rbac_protection(client: TestClient):
    # Unauthenticated -> 401
    r_unauth = client.get("/api/v1/products")
    assert r_unauth.status_code == 401
