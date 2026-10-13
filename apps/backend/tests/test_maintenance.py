import pytest
from datetime import datetime, timedelta, timezone
from fastapi import status
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


def test_maintenance_module_full_lifecycle(client: TestClient):
    auth_headers = get_admin_headers(client)

    # 1. Create a Customer
    partner_payload = {
        "legal_name": "Agro-Industrie Atlas SARL",
        "trade_name": "Atlas Agro",
        "partner_type": "CUSTOMER",
        "email": "contact@agroatlas.ma",
        "phone": "+212661234567",
        "city": "Casablanca",
        "address": "Zone Industrielle Ain Sebaa",
    }
    res = client.post("/api/v1/partners", json=partner_payload, headers=auth_headers)
    assert res.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED), res.text
    customer_id = res.json()["id"]

    # 2. Create a Technician (Employee)
    tech_payload = {
        "first_name": "Omar",
        "last_name": "Technicien",
        "email": "omar.tech@pesage2000.com",
        "phone": "+212670001122",
        "position": "Technicien Métrologue Senior",
        "is_active": True,
    }
    res = client.post("/api/v1/employees", json=tech_payload, headers=auth_headers)
    assert res.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)
    technician_id = res.json()["id"]

    # 3. Create a Catalog Product for Spare Parts
    prod_payload = {
        "reference": "CAP-LOAD-30T-TEST",
        "name": "Capteur de charge 30T inox IP68",
        "price": 3200.00,
        "cost_price": 2100.00,
        "stock_quantity": 10,
    }
    res = client.post("/api/v1/products", json=prod_payload, headers=auth_headers)
    product_id = res.json()["id"] if res.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED) else None

    # ----------------------------------------------------
    # PART D: EQUIPMENT CREATION & MANAGEMENT
    # ----------------------------------------------------
    eq_payload = {
        "customer_id": customer_id,
        "designation": "Pont-Bascule Métallique 60T (Fosse)",
        "equipment_type": "PONTS_BASCULES",
        "brand": "Pesage 2000 Pro",
        "model": "PB-60T-18M",
        "serial_number": "SN-2026-PB-088",
        "site_name": "Site Principal Usine Ain Sebaa",
        "site_address": "Km 12 Route de Rabat",
        "city": "Casablanca",
        "installation_date": "2024-03-15T09:00:00Z",
        "capacity_max": 60000.0,
        "capacity_min": 400.0,
        "graduation": 20.0,
        "status": "OPERATIONAL",
        "notes": "Équipement sous contrat d'entretien annuel P1.",
    }
    res = client.post("/api/v1/maintenance/equipments", json=eq_payload, headers=auth_headers)
    assert res.status_code == status.HTTP_201_CREATED, res.text
    equipment = res.json()
    assert equipment["designation"] == "Pont-Bascule Métallique 60T (Fosse)"
    assert equipment["equipment_code"].startswith("EQ-")
    equipment_id = equipment["id"]

    # Test get equipments
    res = client.get(f"/api/v1/maintenance/equipments?customer_id={customer_id}", headers=auth_headers)
    assert res.status_code == status.HTTP_200_OK
    assert len(res.json()) >= 1

    # ----------------------------------------------------
    # PART E: INTERVENTION CREATION
    # ----------------------------------------------------
    now_iso = datetime.now(timezone.utc).isoformat()
    intervention_payload = {
        "customer_id": customer_id,
        "equipment_id": equipment_id,
        "site": "Site Principal Usine Ain Sebaa",
        "assigned_technician_id": technician_id,
        "date_start": now_iso,
        "intervention_type": "PREVENTIVE_MAINTENANCE",
        "priority": "HIGH",
        "status": "SCHEDULED",
        "problem_description": "Visite périodique trimestrielle et contrôle de métrologie légale.",
        "diagnosis": "Plateforme en bon état général, encrassement léger des boîtes de raccordement.",
        "work_performed": "Nettoyage complet, test de répétabilité, étalonnage avec masses étalons classe M1.",
        "labor_cost": 850.0,
        "travel_cost": 250.0,
        "other_cost": 100.0,
        "tasks": [
            {"description": "Démontage et inspection des trappes d'accès", "status": "PENDING", "order_index": 1},
            {"description": "Nettoyage et contrôle d'étanchéité de la boîte de jonction", "status": "PENDING", "order_index": 2},
            {"description": "Vérification des butées longitudinales et transversales", "status": "PENDING", "order_index": 3},
            {"description": "Contrôle de linéarité et d'excentration avec masses étalons", "status": "PENDING", "order_index": 4},
            {"description": "Poinçonnage et délivrance du certificat d'étalonnage", "status": "PENDING", "order_index": 5},
        ],
        "parts": [
            {
                "product_id": product_id,
                "designation": "Kit presse-étoupe étanche IP68 pour boîte de jonction",
                "quantity": 2.0,
                "unit_price": 150.0,
                "tax_rate": 20.0,
            }
        ],
    }

    res = client.post("/api/v1/maintenance/interventions", json=intervention_payload, headers=auth_headers)
    assert res.status_code == status.HTTP_201_CREATED, res.text
    intervention = res.json()
    assert intervention["intervention_code"].startswith("INT-")
    assert intervention["status"] == "SCHEDULED"
    assert len(intervention["tasks"]) == 5
    assert len(intervention["parts"]) == 1
    # Cost formula: labor(850) + parts(2 * 150 = 300) + travel(250) + other(100) = 1500.0
    assert intervention["parts_cost"] == 300.0
    assert intervention["total_cost"] == 1500.0
    intervention_id = intervention["id"]

    # ----------------------------------------------------
    # STATUS TRANSITIONS & TASK COMPLETION
    # ----------------------------------------------------
    # Start intervention
    res = client.patch(
        f"/api/v1/maintenance/{intervention_id}/status",
        json={"status": "IN_PROGRESS"},
        headers=auth_headers,
    )
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["status"] == "IN_PROGRESS"

    # Complete a task
    task_id = intervention["tasks"][0]["id"]
    res = client.patch(
        f"/api/v1/maintenance/tasks/{task_id}",
        json={"status": "COMPLETED", "notes": "Trappes vérifiées et graissées."},
        headers=auth_headers,
    )
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["status"] == "COMPLETED"

    # Complete intervention
    res = client.patch(
        f"/api/v1/maintenance/{intervention_id}/status",
        json={
            "status": "COMPLETED",
            "observations": "Tous les tests sont conformes aux tolérances de la classe III.",
            "work_performed": "Maintenance préventive complète réalisée avec succès.",
        },
        headers=auth_headers,
    )
    assert res.status_code == status.HTTP_200_OK
    assert res.json()["status"] == "COMPLETED"
    assert res.json()["date_end"] is not None

    # ----------------------------------------------------
    # PART K: EQUIPMENT HISTORY
    # ----------------------------------------------------
    res = client.get(f"/api/v1/maintenance/equipments/{equipment_id}/history", headers=auth_headers)
    assert res.status_code == status.HTTP_200_OK
    history = res.json()
    assert len(history) >= 1
    assert history[0]["id"] == intervention_id

    # ----------------------------------------------------
    # PART L: FILTERS & SEARCH
    # ----------------------------------------------------
    res = client.get(f"/api/v1/maintenance/interventions?status=COMPLETED", headers=auth_headers)
    assert res.status_code == status.HTTP_200_OK
    assert any(item["id"] == intervention_id for item in res.json())

    res = client.get(f"/api/v1/maintenance/interventions?intervention_type=PREVENTIVE_MAINTENANCE", headers=auth_headers)
    assert res.status_code == status.HTTP_200_OK
    assert any(item["id"] == intervention_id for item in res.json())

    # ----------------------------------------------------
    # PART M: STATISTICS
    # ----------------------------------------------------
    res = client.get("/api/v1/maintenance/stats", headers=auth_headers)
    assert res.status_code == status.HTTP_200_OK
    stats = res.json()
    assert stats["equipment_count"] >= 1
    assert stats["completed_count"] >= 1
    assert stats["annual_cost"] >= 1500.0


def test_maintenance_empty_stats_and_defaults(client: TestClient):
    auth_headers = get_admin_headers(client)
    res = client.get("/api/v1/maintenance/stats?year=1999&month=1", headers=auth_headers)
    assert res.status_code == status.HTTP_200_OK
    data = res.json()
    assert data["interventions_month"] == 0
    assert data["monthly_cost"] == 0.0
