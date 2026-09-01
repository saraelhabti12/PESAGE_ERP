from fastapi import status
from sqlalchemy.orm import Session
from app.models.user_model import User
from app.security.passwords import hash_password


def test_user_registration_success(client):
    payload = {
        "email": "testreg@example.com",
        "password": "Password123!",
        "first_name": "Test",
        "last_name": "User",
    }
    response = client.post("/api/v1/auth/register", json=payload)
    assert response.status_code == status.HTTP_201_CREATED
    data = response.json()
    assert data["email"] == "testreg@example.com"
    assert data["first_name"] == "Test"
    assert data["is_active"] is True
    assert "password_hash" not in data
    # Verify USER role is automatically assigned
    role_names = [role["name"] for role in data["roles"]]
    assert "USER" in role_names


def test_user_registration_duplicate_email_rejected(client):
    payload = {
        "email": "dupuser@example.com",
        "password": "Password123!",
    }
    res1 = client.post("/api/v1/auth/register", json=payload)
    assert res1.status_code == status.HTTP_201_CREATED

    # Duplicate registration
    res2 = client.post("/api/v1/auth/register", json=payload)
    assert res2.status_code == status.HTTP_400_BAD_REQUEST


def test_login_success_and_session_creation(client):
    reg_payload = {
        "email": "loginsucc@example.com",
        "password": "Password123!",
    }
    client.post("/api/v1/auth/register", json=reg_payload)

    login_payload = {
        "email": "loginsucc@example.com",
        "password": "Password123!",
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["token_type"] == "bearer"


def test_login_invalid_credentials_rejected(client):
    reg_payload = {
        "email": "loginfail@example.com",
        "password": "Password123!",
    }
    client.post("/api/v1/auth/register", json=reg_payload)

    login_payload = {
        "email": "loginfail@example.com",
        "password": "WrongPassword!",
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_login_inactive_user_rejected(client):
    reg_payload = {
        "email": "inactive@example.com",
        "password": "Password123!",
    }
    res = client.post("/api/v1/auth/register", json=reg_payload)
    user_id = res.json()["id"]

    # Deactivate user directly in db for testing
    from app.db.database import SessionLocal
    db = SessionLocal()
    user = db.query(User).filter(User.id == user_id).first()
    user.is_active = False
    db.commit()
    db.close()

    login_payload = {
        "email": "inactive@example.com",
        "password": "Password123!",
    }
    response = client.post("/api/v1/auth/login", json=login_payload)
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


def test_get_me_endpoint_success(client):
    reg_payload = {
        "email": "getme@example.com",
        "password": "Password123!",
    }
    client.post("/api/v1/auth/register", json=reg_payload)

    login_res = client.post("/api/v1/auth/login", json=reg_payload)
    access_token = login_res.json()["access_token"]

    headers = {"Authorization": f"Bearer {access_token}"}
    me_res = client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == status.HTTP_200_OK
    me_data = me_res.json()
    assert me_data["email"] == "getme@example.com"
    assert "password_hash" not in me_data


def test_refresh_token_rotation(client):
    reg_payload = {
        "email": "refreshtest@example.com",
        "password": "Password123!",
    }
    client.post("/api/v1/auth/register", json=reg_payload)

    login_res = client.post("/api/v1/auth/login", json=reg_payload)
    old_refresh_token = login_res.json()["refresh_token"]

    # Refresh tokens
    ref_res = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh_token})
    assert ref_res.status_code == status.HTTP_200_OK
    ref_data = ref_res.json()
    assert "access_token" in ref_data
    assert "refresh_token" in ref_data
    new_refresh_token = ref_data["refresh_token"]
    assert new_refresh_token != old_refresh_token

    # Verify old refresh token CANNOT be reused (Rotation)
    reuse_res = client.post("/api/v1/auth/refresh", json={"refresh_token": old_refresh_token})
    assert reuse_res.status_code == status.HTTP_401_UNAUTHORIZED


def test_logout_revokes_refresh_session(client):
    reg_payload = {
        "email": "logouttest@example.com",
        "password": "Password123!",
    }
    client.post("/api/v1/auth/register", json=reg_payload)

    login_res = client.post("/api/v1/auth/login", json=reg_payload)
    refresh_token = login_res.json()["refresh_token"]

    # Logout
    logout_res = client.post("/api/v1/auth/logout", json={"refresh_token": refresh_token})
    assert logout_res.status_code == status.HTTP_200_OK

    # Attempt to refresh using revoked refresh token
    ref_res = client.post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})
    assert ref_res.status_code == status.HTTP_401_UNAUTHORIZED
