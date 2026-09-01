from fastapi import status
from app.core.bootstrap import bootstrap_system
from app.db.database import SessionLocal
from app.models.user_model import User
from app.models.role_model import Role
from app.security.passwords import hash_password


def test_missing_access_token_returns_401(client):
    response = client.get("/api/v1/users")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_invalid_access_token_returns_401(client):
    headers = {"Authorization": "Bearer invalid_token_string"}
    response = client.get("/api/v1/users", headers=headers)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_user_without_permission_gets_403_forbidden(client):
    # Regular user assigned only USER role does NOT have 'users.view' permission
    reg_payload = {
        "email": "normaluser@example.com",
        "password": "Password123!",
    }
    client.post("/api/v1/auth/register", json=reg_payload)

    login_res = client.post("/api/v1/auth/login", json=reg_payload)
    access_token = login_res.json()["access_token"]

    headers = {"Authorization": f"Bearer {access_token}"}
    response = client.get("/api/v1/users", headers=headers)
    assert response.status_code == status.HTTP_403_FORBIDDEN


def test_admin_role_bypasses_individual_permission_checks(client):
    # Admin user logging in can access /api/v1/users requiring 'users.view'
    login_payload = {
        "email": "admin@example.com",
        "password": "CHANGE_THIS_PASSWORD",
    }
    login_res = client.post("/api/v1/auth/login", json=login_payload)
    assert login_res.status_code == status.HTTP_200_OK
    access_token = login_res.json()["access_token"]

    headers = {"Authorization": f"Bearer {access_token}"}
    response = client.get("/api/v1/users", headers=headers)
    assert response.status_code == status.HTTP_200_OK
    assert isinstance(response.json(), list)


def test_bootstrap_idempotency():
    # Running bootstrap_system multiple times must not raise errors or duplicate roles/admin
    bootstrap_system()
    bootstrap_system()
    bootstrap_system()

    db = SessionLocal()
    admin_count = db.query(User).filter(User.email == "admin@example.com").count()
    assert admin_count == 1
    db.close()
