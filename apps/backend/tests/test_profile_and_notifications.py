import pytest
from fastapi.testclient import TestClient
from app.core.config import settings


def get_auth_header(client: TestClient, email: str = settings.ADMIN_EMAIL, password: str = settings.ADMIN_PASSWORD) -> dict:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_profile_update_and_validations(client: TestClient):
    headers = get_auth_header(client)

    # 1. Get current profile
    r_me = client.get("/api/v1/auth/me", headers=headers)
    assert r_me.status_code == 200
    user_data = r_me.json()
    assert user_data["email"] == settings.ADMIN_EMAIL

    # 2. Update profile name and phone
    update_payload = {
        "first_name": "AdminPrenom",
        "last_name": "AdminNom",
        "phone": "+212600112233",
    }
    r_upd = client.put("/api/v1/auth/me", json=update_payload, headers=headers)
    assert r_upd.status_code == 200
    updated = r_upd.json()
    assert updated["first_name"] == "AdminPrenom"
    assert updated["last_name"] == "AdminNom"
    assert updated["phone"] == "+212600112233"

    # 3. Create another user to test duplicate email rejection on profile update
    r_u2 = client.post(
        "/api/v1/users",
        json={
            "email": "user2.test@example.com",
            "password": "Password123!",
            "first_name": "User",
            "last_name": "Deux",
        },
        headers=headers,
    )
    assert r_u2.status_code == 201

    # Try updating Admin's email to user2's email -> Should fail with 400
    r_dup = client.put("/api/v1/auth/me", json={"email": "user2.test@example.com"}, headers=headers)
    assert r_dup.status_code == 400
    assert "déjà utilisée" in r_dup.json()["error"]["message"]


def test_change_password_workflow(client: TestClient):
    admin_headers = get_auth_header(client)

    # 1. Create a dedicated user for password change test
    test_email = "pwd.user@example.com"
    old_pwd = "InitialPassword123!"
    new_pwd = "NewSecurePassword456!"

    client.post(
        "/api/v1/users",
        json={
            "email": test_email,
            "password": old_pwd,
            "first_name": "Tester",
            "last_name": "Password",
        },
        headers=admin_headers,
    )

    user_headers = get_auth_header(client, email=test_email, password=old_pwd)

    # 2. Fail with wrong current password
    r_wrong = client.post(
        "/api/v1/auth/change-password",
        json={
            "current_password": "WrongPassword999!",
            "new_password": new_pwd,
            "confirm_password": new_pwd,
        },
        headers=user_headers,
    )
    assert r_wrong.status_code == 400
    assert "mot de passe actuel est incorrect" in r_wrong.json()["error"]["message"]

    # 3. Fail with mismatched confirmation
    r_mismatch = client.post(
        "/api/v1/auth/change-password",
        json={
            "current_password": old_pwd,
            "new_password": new_pwd,
            "confirm_password": "DifferentPassword789!",
        },
        headers=user_headers,
    )
    assert r_mismatch.status_code == 400
    assert "ne correspondent pas" in r_mismatch.json()["error"]["message"]

    # 4. Fail with too short password
    r_short = client.post(
        "/api/v1/auth/change-password",
        json={
            "current_password": old_pwd,
            "new_password": "short",
            "confirm_password": "short",
        },
        headers=user_headers,
    )
    assert r_short.status_code == 400
    assert "au moins 8 caractères" in r_short.json()["error"]["message"]

    # 5. Success
    r_success = client.post(
        "/api/v1/auth/change-password",
        json={
            "current_password": old_pwd,
            "new_password": new_pwd,
            "confirm_password": new_pwd,
        },
        headers=user_headers,
    )
    assert r_success.status_code == 200
    assert "succès" in r_success.json()["message"]

    # 6. Verify old password no longer works
    r_old_login = client.post("/api/v1/auth/login", json={"email": test_email, "password": old_pwd})
    assert r_old_login.status_code == 401

    # 7. Verify new password works
    r_new_login = client.post("/api/v1/auth/login", json={"email": test_email, "password": new_pwd})
    assert r_new_login.status_code == 200


def test_notifications_crud_and_events(client: TestClient):
    headers = get_auth_header(client)

    # 1. Unread count initially 0
    r_cnt0 = client.get("/api/v1/notifications/unread-count", headers=headers)
    assert r_cnt0.status_code == 200
    assert r_cnt0.json()["unread_count"] == 0

    # 2. Trigger notifications via Purchase Workflow
    # Create supplier & product
    supp = client.post(
        "/api/v1/partners",
        json={"code": "FRS-NOTIF", "legal_name": "Fournisseur Notif", "partner_type": "SUPPLIER"},
        headers=headers,
    ).json()
    cat = client.post("/api/v1/categories", json={"name": "Cat Notif", "code": "CAT-N"}, headers=headers).json()
    pt = client.post("/api/v1/product-types", json={"name": "Type Notif", "code": "TYP-N"}, headers=headers).json()
    u = client.post("/api/v1/units", json={"name": "Unit Notif", "abbreviation": "UN"}, headers=headers).json()
    prod = client.post(
        "/api/v1/products",
        json={
            "sku": "PROD-NOTIF-01",
            "designation": "Produit Notif",
            "category_id": cat["id"],
            "product_type_id": pt["id"],
            "unit_id": u["id"],
            "purchase_price": 500.0,
            "sale_price": 800.0,
        },
        headers=headers,
    ).json()

    # Create Order
    po = client.post(
        "/api/v1/purchases",
        json={
            "reference": "PO-NOTIF-001",
            "supplier_id": supp["id"],
            "items": [{"product_id": prod["id"], "quantity_ordered": 2, "unit_price_ht": 500.0}],
        },
        headers=headers,
    ).json()

    # Approve Order -> triggers notification
    client.post(f"/api/v1/purchases/{po['id']}/approve", headers=headers)

    # Check unread count is now >= 1
    r_cnt1 = client.get("/api/v1/notifications/unread-count", headers=headers)
    assert r_cnt1.json()["unread_count"] >= 1

    # List notifications
    r_list = client.get("/api/v1/notifications", headers=headers)
    assert r_list.status_code == 200
    notifs = r_list.json()
    assert len(notifs) >= 1
    first_notif = notifs[0]
    assert "validée" in first_notif["title"]
    assert first_notif["is_read"] is False

    # Mark single notification as read
    r_read = client.post(f"/api/v1/notifications/{first_notif['id']}/read", headers=headers)
    assert r_read.status_code == 200
    assert r_read.json()["is_read"] is True

    # Record receipt -> triggers second notification
    item_id = po["items"][0]["id"]
    client.post(
        "/api/v1/purchase-receipts",
        json={
            "reference": "REC-NOTIF-01",
            "purchase_order_id": po["id"],
            "items": [{"purchase_order_item_id": item_id, "product_id": prod["id"], "quantity_received": 2}],
        },
        headers=headers,
    )

    # Mark all as read
    r_read_all = client.post("/api/v1/notifications/read-all", headers=headers)
    assert r_read_all.status_code == 200

    r_cnt_final = client.get("/api/v1/notifications/unread-count", headers=headers)
    assert r_cnt_final.json()["unread_count"] == 0


def test_dashboard_statistics_real_data(client: TestClient):
    headers = get_auth_header(client)

    # Create 1 customer, 1 supplier, 1 product, 1 category, 1 PO
    client.post(
        "/api/v1/partners",
        json={"code": "CLI-DASH", "legal_name": "Client Dash", "partner_type": "CUSTOMER"},
        headers=headers,
    )
    supp = client.post(
        "/api/v1/partners",
        json={"code": "FRS-DASH", "legal_name": "Fournisseur Dash", "partner_type": "SUPPLIER"},
        headers=headers,
    ).json()
    cat = client.post("/api/v1/categories", json={"name": "Cat Dash", "code": "CAT-D"}, headers=headers).json()
    pt = client.post("/api/v1/product-types", json={"name": "Type Dash", "code": "TYP-D"}, headers=headers).json()
    u = client.post("/api/v1/units", json={"name": "Unit Dash", "abbreviation": "UD"}, headers=headers).json()
    prod = client.post(
        "/api/v1/products",
        json={
            "sku": "PROD-DASH-01",
            "designation": "Produit Dashboard",
            "category_id": cat["id"],
            "product_type_id": pt["id"],
            "unit_id": u["id"],
            "purchase_price": 1000.0,
            "sale_price": 1500.0,
            "tax_rate": 20.0,
        },
        headers=headers,
    ).json()

    client.post(
        "/api/v1/purchases",
        json={
            "reference": "PO-DASH-001",
            "supplier_id": supp["id"],
            "items": [{"product_id": prod["id"], "quantity_ordered": 3, "unit_price_ht": 1000.0}],
        },
        headers=headers,
    )

    # Query Dashboard stats
    r_dash = client.get("/api/v1/dashboard/stats", headers=headers)
    assert r_dash.status_code == 200
    data = r_dash.json()

    # Check Catalog stats
    assert data["catalog"]["total_products"] >= 1
    assert data["catalog"]["total_categories"] >= 1

    # Check Partners stats
    assert data["partners"]["total_customers"] >= 1
    assert data["partners"]["total_suppliers"] >= 1

    # Check Purchases stats
    assert data["purchases"]["total_orders"] >= 1
    assert data["purchases"]["draft_orders"] >= 1
    assert data["purchases"]["total_subtotal_ht"] >= 3000.0

    # Check Recent Activity
    assert len(data["recent_activity"]) >= 1
