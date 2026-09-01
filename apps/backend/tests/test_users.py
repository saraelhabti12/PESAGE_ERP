import pytest
from app.core.config import settings
from app.models.user_model import User
from app.db.database import SessionLocal


def get_admin_auth_headers(client):
    """Helper to authenticate as admin and return Bearer auth headers."""
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": settings.ADMIN_EMAIL, "password": settings.ADMIN_PASSWORD},
    )
    assert login_res.status_code == 200
    token = login_res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_admin_create_user_success(client):
    """Admin can successfully create a new user with assigned roles."""
    headers = get_admin_auth_headers(client)

    payload = {
        "first_name": "Karim",
        "last_name": "Benani",
        "email": "karim.benani@example.com",
        "phone": "+212612345678",
        "password": "SecurePassword123!",
        "role_ids": [1],
    }

    res = client.post("/api/v1/users", json=payload, headers=headers)
    assert res.status_code == 201
    data = res.json()

    assert data["email"] == "karim.benani@example.com"
    assert data["first_name"] == "Karim"
    assert data["last_name"] == "Benani"
    assert data["phone"] == "+212612345678"
    assert data["is_active"] is True
    assert "password" not in data
    assert "password_hash" not in data
    assert len(data["roles"]) == 1
    assert data["roles"][0]["name"] == "ADMIN"

    # Verify password is saved as hash in DB
    db = SessionLocal()
    try:
        user_in_db = db.query(User).filter(User.email == "karim.benani@example.com").first()
        assert user_in_db is not None
        assert user_in_db.password_hash != "SecurePassword123!"
        assert user_in_db.password_hash.startswith("$2b$") or len(user_in_db.password_hash) > 20
    finally:
        db.close()


def test_admin_create_user_duplicate_email(client):
    """Creating a user with existing email returns 409 Conflict with French error message."""
    headers = get_admin_auth_headers(client)

    payload = {
        "first_name": "Admin",
        "last_name": "Duplicate",
        "email": settings.ADMIN_EMAIL,  # Already exists
        "password": "Password123!",
    }

    res = client.post("/api/v1/users", json=payload, headers=headers)
    assert res.status_code == 409
    data = res.json()
    assert data["error"]["message"] == "Cette adresse e-mail est déjà utilisée." or "déjà utilisée" in str(data)


def test_create_user_invalid_email(client):
    """Invalid email format returns 422 Validation Error."""
    headers = get_admin_auth_headers(client)

    payload = {
        "first_name": "Invalid",
        "last_name": "Email",
        "email": "not-an-email",
        "password": "Password123!",
    }

    res = client.post("/api/v1/users", json=payload, headers=headers)
    assert res.status_code == 422


def test_unauthorized_user_creation(client):
    """Unauthenticated or non-admin user without users.create cannot create users."""
    # 1. Unauthenticated
    res = client.post(
        "/api/v1/users",
        json={
            "first_name": "NoAuth",
            "last_name": "User",
            "email": "noauth@example.com",
            "password": "Password123!",
        },
    )
    assert res.status_code == 401

    # 2. Register normal user with USER role only
    reg_res = client.post(
        "/api/v1/auth/register",
        json={
            "first_name": "Normal",
            "last_name": "User",
            "email": "normal.user@example.com",
            "password": "NormalUserPass123!",
        },
    )
    assert reg_res.status_code == 201

    # Login as normal user
    user_login = client.post(
        "/api/v1/auth/login",
        json={"email": "normal.user@example.com", "password": "NormalUserPass123!"},
    )
    assert user_login.status_code == 200
    user_token = user_login.json()["access_token"]
    user_headers = {"Authorization": f"Bearer {user_token}"}

    # Normal user attempts to create another user
    create_res = client.post(
        "/api/v1/users",
        json={
            "first_name": "Hacker",
            "last_name": "Attempt",
            "email": "hacker@example.com",
            "password": "Password123!",
        },
        headers=user_headers,
    )
    assert create_res.status_code == 403


def test_list_and_filter_users(client):
    """Admin can list and search users."""
    headers = get_admin_auth_headers(client)

    # Create two users
    client.post(
        "/api/v1/users",
        json={"first_name": "Alice", "last_name": "Wonder", "email": "alice@example.com", "password": "Pass123!"},
        headers=headers,
    )
    client.post(
        "/api/v1/users",
        json={"first_name": "Bob", "last_name": "Builder", "email": "bob@example.com", "password": "Pass123!"},
        headers=headers,
    )

    # List all
    res = client.get("/api/v1/users", headers=headers)
    assert res.status_code == 200
    users = res.json()
    assert len(users) >= 3  # Admin + Alice + Bob

    # Search filter
    res_search = client.get("/api/v1/users?search=Alice", headers=headers)
    assert res_search.status_code == 200
    assert len(res_search.json()) == 1
    assert res_search.json()[0]["email"] == "alice@example.com"


def test_update_and_deactivate_user(client):
    """Admin can update user fields and deactivate user."""
    headers = get_admin_auth_headers(client)

    # Create user
    create_res = client.post(
        "/api/v1/users",
        json={"first_name": "Charlie", "last_name": "Brown", "email": "charlie@example.com", "password": "Pass123!"},
        headers=headers,
    )
    user_id = create_res.json()["id"]

    # Update user
    update_res = client.put(
        f"/api/v1/users/{user_id}",
        json={"first_name": "Charles", "last_name": "Brown Updated", "phone": "+212699999999"},
        headers=headers,
    )
    assert update_res.status_code == 200
    assert update_res.json()["first_name"] == "Charles"
    assert update_res.json()["phone"] == "+212699999999"

    # Deactivate user
    delete_res = client.delete(f"/api/v1/users/{user_id}", headers=headers)
    assert delete_res.status_code == 200
    assert delete_res.json()["is_active"] is False
