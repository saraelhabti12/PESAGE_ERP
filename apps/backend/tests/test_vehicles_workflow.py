import pytest
from fastapi.testclient import TestClient
from app.core.config import settings


def get_admin_headers(client: TestClient):
    response = client.post(
        "/api/v1/auth/login",
        json={"email": settings.ADMIN_EMAIL, "password": settings.ADMIN_PASSWORD},
    )
    assert response.status_code == 200
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def test_vehicle_creation_and_driver_management(client: TestClient):
    headers = get_admin_headers(client)

    # 1. Create an active driver in personnel
    emp_res = client.post(
        "/api/v1/employees",
        headers=headers,
        json={
            "first_name": "Tariq",
            "last_name": "El Amrani",
            "phone": "+212 6 11 22 33 44",
            "email": "tariq.amrani@pesage2000.ma",
            "job_title": "Chauffeur Poids Lourds",
            "department": "Transport",
            "is_active": True,
        },
    )
    assert emp_res.status_code == 201
    driver_id = emp_res.json()["id"]

    # 2. Create an inactive employee
    inactive_emp_res = client.post(
        "/api/v1/employees",
        headers=headers,
        json={
            "first_name": "Ancien",
            "last_name": "Chauffeur",
            "is_active": False,
        },
    )
    assert inactive_emp_res.status_code == 201
    inactive_driver_id = inactive_emp_res.json()["id"]

    # 3. Create vehicle WITHOUT chauffeur (driver_id=None or default_driver_id=None)
    # Also test empty strings for optional dates to verify NO 422 is raised!
    v1_res = client.post(
        "/api/v1/vehicles",
        headers=headers,
        json={
            "registration_number": "99881-A-40",
            "brand": "Renault",
            "model": "Master L3H2",
            "mileage": 12500,
            "fuel_type": "Diesel",
            "status": "AVAILABLE",
            "driver_id": None,
            "insurance_expiry": "",
            "technical_inspection_expiry": "",
        },
    )
    assert v1_res.status_code == 201, f"Failed to create vehicle without driver: {v1_res.text}"
    v1 = v1_res.json()
    assert v1["registration_number"] == "99881-A-40"
    assert v1["default_driver_id"] is None
    assert v1["current_mileage"] == 12500.0
    assert v1["status"] == "ACTIVE"

    # 4. Create vehicle WITH active chauffeur
    v2_res = client.post(
        "/api/v1/vehicles",
        headers=headers,
        json={
            "registration_number": "77662-B-40",
            "brand": "Dacia",
            "model": "Dokker Van",
            "mileage": 45000,
            "fuel_type": "Diesel",
            "status": "ACTIVE",
            "default_driver_id": driver_id,
            "insurance_expiry": "2026-12-31T00:00:00Z",
        },
    )
    assert v2_res.status_code == 201, f"Failed to create vehicle with driver: {v2_res.text}"
    v2 = v2_res.json()
    assert v2["default_driver_id"] == driver_id
    assert v2["default_driver"]["first_name"] == "Tariq"

    # 5. Assign driver to the unassigned vehicle (Update)
    update_res = client.put(
        f"/api/v1/vehicles/{v1['id']}",
        headers=headers,
        json={"default_driver_id": driver_id},
    )
    assert update_res.status_code == 200
    assert update_res.json()["default_driver_id"] == driver_id

    # 6. Reject assignment of inactive employee as driver
    inactive_assign_res = client.put(
        f"/api/v1/vehicles/{v1['id']}",
        headers=headers,
        json={"default_driver_id": inactive_driver_id},
    )
    assert inactive_assign_res.status_code == 400
    assert "inactif" in inactive_assign_res.text
