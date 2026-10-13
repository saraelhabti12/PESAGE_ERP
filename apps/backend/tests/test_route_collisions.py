from datetime import datetime, timezone
import pytest
from fastapi import status
from fastapi.testclient import TestClient

from app.core.config import settings


@pytest.fixture
def auth_headers(client: TestClient):
    res = client.post(
        "/api/v1/auth/login",
        json={"email": settings.ADMIN_EMAIL, "password": settings.ADMIN_PASSWORD},
    )
    assert res.status_code == 200, f"Login failed: {res.text}"
    token = res.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ----------------------------------------------------------------------
# 1. EXPENSES ROUTING & COLLISION TESTS
# ----------------------------------------------------------------------
def test_expenses_routing_no_collisions(client: TestClient, auth_headers):
    """Verify GET /expenses/stats, /expenses/statistics, /expenses, /expenses/categories, and /expenses/{id}."""
    # 1. Verify GET /api/v1/expenses/stats returns 200 and is not captured by /{expense_id}
    res_stats = client.get("/api/v1/expenses/stats", headers=auth_headers)
    assert res_stats.status_code == status.HTTP_200_OK, f"Expected 200, got {res_stats.status_code}: {res_stats.text}"
    stats_data = res_stats.json()
    assert "total_expenses" in stats_data
    assert "fixed_expenses" in stats_data
    assert "variable_expenses" in stats_data

    # 2. Verify GET /api/v1/expenses/statistics alias
    res_statistics = client.get("/api/v1/expenses/statistics", headers=auth_headers)
    assert res_statistics.status_code == status.HTTP_200_OK
    assert res_statistics.json() == stats_data

    # 3. Verify GET /api/v1/expenses list endpoint
    res_list = client.get("/api/v1/expenses", headers=auth_headers)
    assert res_list.status_code == status.HTTP_200_OK
    assert isinstance(res_list.json(), list)

    # 4. Verify GET /api/v1/expenses/categories
    res_cat = client.get("/api/v1/expenses/categories", headers=auth_headers)
    assert res_cat.status_code == status.HTTP_200_OK
    assert isinstance(res_cat.json(), list)

    # 5. Verify GET /api/v1/expenses/recurring
    res_rec = client.get("/api/v1/expenses/recurring", headers=auth_headers)
    assert res_rec.status_code == status.HTTP_200_OK
    assert isinstance(res_rec.json(), list)

    # 6. Create a real expense and retrieve by real ID
    cat_id = res_cat.json()[0]["id"]
    res_create = client.post(
        "/api/v1/expenses",
        json={
            "category_id": cat_id,
            "label": "Fournitures bureau test route",
            "amount": 250.0,
            "payment_method": "ESPECES",
            "expense_date": datetime.now(timezone.utc).isoformat(),
        },
        headers=auth_headers,
    )
    assert res_create.status_code == status.HTTP_201_CREATED
    expense_id = res_create.json()["id"]

    # 7. Verify GET /api/v1/expenses/{expense_id} with integer ID returns 200
    res_get = client.get(f"/api/v1/expenses/{expense_id}", headers=auth_headers)
    assert res_get.status_code == status.HTTP_200_OK
    assert res_get.json()["id"] == expense_id
    assert res_get.json()["label"] == "Fournitures bureau test route"

    # 8. Verify GET with non-existent numeric ID returns 404, not 422
    res_404 = client.get("/api/v1/expenses/999999", headers=auth_headers)
    assert res_404.status_code == status.HTTP_404_NOT_FOUND


# ----------------------------------------------------------------------
# 2. VEHICLES ROUTING & COLLISION TESTS
# ----------------------------------------------------------------------
def test_vehicles_routing_no_collisions(client: TestClient, auth_headers):
    """Verify GET /vehicles/stats, /vehicles/statistics, /vehicles/maintenances, /vehicles/fuel-logs, and /vehicles/{id}."""
    # 1. GET /api/v1/vehicles/stats
    res_stats = client.get("/api/v1/vehicles/stats", headers=auth_headers)
    assert res_stats.status_code == status.HTTP_200_OK, f"Expected 200, got {res_stats.status_code}: {res_stats.text}"
    stats_data = res_stats.json()
    assert "fuel_cost_month" in stats_data
    assert "maintenance_cost_month" in stats_data

    # 2. GET /api/v1/vehicles/statistics
    res_statistics = client.get("/api/v1/vehicles/statistics", headers=auth_headers)
    assert res_statistics.status_code == status.HTTP_200_OK

    # 3. GET /api/v1/vehicles/next-code
    res_code = client.get("/api/v1/vehicles/next-code", headers=auth_headers)
    assert res_code.status_code == status.HTTP_200_OK
    assert "VH-" in res_code.json()["code"]

    # 4. GET /api/v1/vehicles/maintenances and /maintenances/all
    res_maint = client.get("/api/v1/vehicles/maintenances", headers=auth_headers)
    assert res_maint.status_code == status.HTTP_200_OK
    assert isinstance(res_maint.json(), list)

    res_maint_all = client.get("/api/v1/vehicles/maintenances/all", headers=auth_headers)
    assert res_maint_all.status_code == status.HTTP_200_OK

    # 5. GET /api/v1/vehicles/fuel-logs and /fuel/all
    res_fuel = client.get("/api/v1/vehicles/fuel-logs", headers=auth_headers)
    assert res_fuel.status_code == status.HTTP_200_OK
    assert isinstance(res_fuel.json(), list)

    res_fuel_all = client.get("/api/v1/vehicles/fuel/all", headers=auth_headers)
    assert res_fuel_all.status_code == status.HTTP_200_OK

    # 6. GET /api/v1/vehicles (list)
    res_list = client.get("/api/v1/vehicles", headers=auth_headers)
    assert res_list.status_code == status.HTTP_200_OK

    # 7. Create a vehicle and fetch by ID
    res_create = client.post(
        "/api/v1/vehicles",
        json={
            "registration_number": f"TEST-ROUTING-{int(datetime.now().timestamp())}",
            "brand": "Renault",
            "model": "Express Test",
            "current_mileage": 12500.0,
            "fuel_type": "DIESEL",
            "status": "ACTIVE",
        },
        headers=auth_headers,
    )
    assert res_create.status_code == status.HTTP_201_CREATED
    vehicle_id = res_create.json()["id"]

    # 8. GET /api/v1/vehicles/{vehicle_id}
    res_get = client.get(f"/api/v1/vehicles/{vehicle_id}", headers=auth_headers)
    assert res_get.status_code == status.HTTP_200_OK
    assert res_get.json()["id"] == vehicle_id

    # 9. Non-existent vehicle ID returns 404
    res_404 = client.get("/api/v1/vehicles/999999", headers=auth_headers)
    assert res_404.status_code == status.HTTP_404_NOT_FOUND


# ----------------------------------------------------------------------
# 3. NOTIFICATIONS ROUTING & COLLISION TESTS
# ----------------------------------------------------------------------
def test_notifications_routing_no_collisions(client: TestClient, auth_headers):
    """Verify /notifications/unread-count, /notifications/read-all, and /notifications."""
    # 1. GET unread count
    res_unread = client.get("/api/v1/notifications/unread-count", headers=auth_headers)
    assert res_unread.status_code == status.HTTP_200_OK
    assert "unread_count" in res_unread.json()

    # 2. POST read-all
    res_readall = client.post("/api/v1/notifications/read-all", headers=auth_headers)
    assert res_readall.status_code == status.HTTP_200_OK
    assert res_readall.json()["status"] == "ok"

    # 3. GET notifications list
    res_list = client.get("/api/v1/notifications", headers=auth_headers)
    assert res_list.status_code == status.HTTP_200_OK
    assert isinstance(res_list.json(), list)


# ----------------------------------------------------------------------
# 4. REPORTS ROUTING TESTS
# ----------------------------------------------------------------------
def test_reports_routing(client: TestClient, auth_headers):
    """Verify GET /reports/commercial, /reports/commercial-statistics, /reports/commercial-bundle."""
    # 1. GET /api/v1/reports/commercial
    res_comm = client.get("/api/v1/reports/commercial", headers=auth_headers)
    assert res_comm.status_code == status.HTTP_200_OK, f"Expected 200, got {res_comm.status_code}: {res_comm.text}"
    comm_data = res_comm.json()
    assert "total_turnover_ht" in comm_data
    assert "total_turnover_ttc" in comm_data
    assert "top_customers" in comm_data
    assert "monthly_trend" in comm_data

    # 2. GET /api/v1/reports/commercial-statistics
    res_stats = client.get("/api/v1/reports/commercial-statistics", headers=auth_headers)
    assert res_stats.status_code == status.HTTP_200_OK
    assert "sales_total_ht" in res_stats.json()

    # 3. GET /api/v1/reports/commercial-bundle
    res_bundle = client.get("/api/v1/reports/commercial-bundle", headers=auth_headers)
    assert res_bundle.status_code == status.HTTP_200_OK
    assert "sales_by_month" in res_bundle.json()


# ----------------------------------------------------------------------
# 5. EXPORTS ROUTING TESTS
# ----------------------------------------------------------------------
def test_exports_routing(client: TestClient, auth_headers):
    """Verify all Excel export endpoints return valid 200 spreadsheets."""
    endpoints = [
        "/api/v1/exports/customers",
        "/api/v1/exports/suppliers",
        "/api/v1/exports/employees",
        "/api/v1/exports/products",
        "/api/v1/exports/quotes",
        "/api/v1/exports/sales",
        "/api/v1/exports/purchases",
        "/api/v1/exports/invoices",
        "/api/v1/exports/invoices/customers",
        "/api/v1/exports/invoices/suppliers",
        "/api/v1/exports/credit-notes",
        "/api/v1/exports/payments",
        "/api/v1/exports/stock",
        "/api/v1/exports/stock/movements",
        "/api/v1/exports/expenses",
        "/api/v1/exports/vehicles",
        "/api/v1/exports/vehicles/maintenances",
    ]
    for ep in endpoints:
        res = client.get(ep, headers=auth_headers)
        assert res.status_code == status.HTTP_200_OK, f"Failed on {ep}: {res.status_code}"
        assert "spreadsheetml" in res.headers.get("content-type", "")


# ----------------------------------------------------------------------
# 6. ROLES ROUTING TESTS
# ----------------------------------------------------------------------
def test_roles_routing(client: TestClient, auth_headers):
    """Verify /roles GET, POST, PUT, and /{role_id}."""
    # 1. GET /api/v1/roles
    res_list = client.get("/api/v1/roles", headers=auth_headers)
    assert res_list.status_code == status.HTTP_200_OK
    roles = res_list.json()
    assert len(roles) > 0
    admin_role = next((r for r in roles if r["name"] == "ADMIN"), None)
    assert admin_role is not None

    # 2. GET /api/v1/roles/{role_id}
    res_get = client.get(f"/api/v1/roles/{admin_role['id']}", headers=auth_headers)
    assert res_get.status_code == status.HTTP_200_OK
    assert res_get.json()["name"] == "ADMIN"

    # 3. POST /api/v1/roles
    res_create = client.post(
        "/api/v1/roles",
        json={"name": f"TEST_ROLE_{int(datetime.now().timestamp())}", "description": "Test role"},
        headers=auth_headers,
    )
    assert res_create.status_code == status.HTTP_201_CREATED
    new_role_id = res_create.json()["id"]

    # 4. PUT /api/v1/roles/{role_id}
    res_update = client.put(
        f"/api/v1/roles/{new_role_id}",
        json={"description": "Updated test role description"},
        headers=auth_headers,
    )
    assert res_update.status_code == status.HTTP_200_OK
    assert res_update.json()["description"] == "Updated test role description"


# ----------------------------------------------------------------------
# 7. INVOICES ROUTING & FILTERS TESTS (NO 500 / NO 422)
# ----------------------------------------------------------------------
def test_invoices_routing_and_filters(client: TestClient, auth_headers):
    """Verify GET /invoices, /invoices?invoice_type=CUSTOMER, /invoices?invoice_type=SUPPLIER, and /{id}."""
    # 1. GET /api/v1/invoices returns 200 (not 500)
    res_all = client.get("/api/v1/invoices", headers=auth_headers)
    assert res_all.status_code == status.HTTP_200_OK, f"Expected 200, got {res_all.status_code}: {res_all.text}"
    assert isinstance(res_all.json(), list)

    # 2. GET /api/v1/invoices?invoice_type=CUSTOMER returns 200
    res_cust = client.get("/api/v1/invoices?invoice_type=CUSTOMER", headers=auth_headers)
    assert res_cust.status_code == status.HTTP_200_OK
    assert isinstance(res_cust.json(), list)

    # 3. GET /api/v1/invoices?invoice_type=SUPPLIER returns 200
    res_supp = client.get("/api/v1/invoices?invoice_type=SUPPLIER", headers=auth_headers)
    assert res_supp.status_code == status.HTTP_200_OK
    assert isinstance(res_supp.json(), list)

    # 4. GET /api/v1/invoices with search query returns 200
    res_search = client.get("/api/v1/invoices?search=nonexistent_invoice_123", headers=auth_headers)
    assert res_search.status_code == status.HTTP_200_OK
    assert isinstance(res_search.json(), list)

    # 5. GET /api/v1/invoices/999999 returns 404 (not 500 or 422)
    res_404 = client.get("/api/v1/invoices/999999", headers=auth_headers)
    assert res_404.status_code == status.HTTP_404_NOT_FOUND

    # 6. Create customer + product to create real invoice
    ts = int(datetime.now().timestamp())
    partner_res = client.post(
        "/api/v1/partners",
        json={
            "code": f"CLI-INV-{ts}",
            "legal_name": f"Client Facture Test {ts}",
            "partner_type": "CUSTOMER",
            "email": f"client{ts}@test.ma",
        },
        headers=auth_headers,
    )
    assert partner_res.status_code == status.HTTP_201_CREATED
    partner_id = partner_res.json()["id"]

    inv_create_res = client.post(
        "/api/v1/invoices",
        json={
            "invoice_type": "CUSTOMER",
            "customer_id": partner_id,
            "payment_terms": "30 jours",
            "items": [
                {
                    "description": "Prestation métrologie industrielle",
                    "quantity": 2.0,
                    "unit_price_ht": 1500.0,
                    "tax_rate": 20.0,
                    "discount_rate": 0.0,
                }
            ],
        },
        headers=auth_headers,
    )
    assert inv_create_res.status_code == status.HTTP_201_CREATED
    inv_id = inv_create_res.json()["id"]

    # 7. GET /api/v1/invoices/{invoice_id} with integer ID returns 200
    res_get = client.get(f"/api/v1/invoices/{inv_id}", headers=auth_headers)
    assert res_get.status_code == status.HTTP_200_OK
    assert res_get.json()["id"] == inv_id
    assert res_get.json()["total_ttc"] == 3600.0

