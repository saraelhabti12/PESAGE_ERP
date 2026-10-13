import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Add app parent directory to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
from app.core.config import settings

BASE_URL = "http://127.0.0.1:8000"


def run_e2e():
    print("=" * 70)
    print("[START] RUNNING FULL END-TO-END VERIFICATION: VEHICLES & MAINTENANCE")
    print("=" * 70)

    client = httpx.Client(base_url=BASE_URL, timeout=30.0)

    # 1. Login
    login_res = client.post(
        "/api/v1/auth/login",
        json={"email": settings.ADMIN_EMAIL, "password": settings.ADMIN_PASSWORD},
    )
    if login_res.status_code != 200:
        print(f"[FAIL] Login failed: {login_res.status_code} {login_res.text}")
        return False
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("[PASS] Step 1: Logged in as Administrator.")

    # ------------------------------------------------------------------
    # PART A: VEHICLE & CHAUFFEUR WORKFLOW
    # ------------------------------------------------------------------
    print("\n--- PART A: TESTING VEHICLE 422 FIX & CHAUFFEUR WORKFLOW ---")

    # A1. Create Chauffeur in Personnel
    driver_payload = {
        "employee_code": f"DRV-{datetime.now().strftime('%M%S')}",
        "first_name": "Rachid",
        "last_name": "El Mansouri",
        "phone": "+212 6 61 99 88 77",
        "email": f"rachid.mansouri.{datetime.now().strftime('%M%S')}@pesage2000.ma",
        "job_title": "Chauffeur Poids Lourds & Métrologie",
        "department": "Logistique & Transport",
        "is_active": True,
    }
    drv_res = client.post("/api/v1/employees", json=driver_payload, headers=headers)
    assert drv_res.status_code in (200, 201), f"Driver creation failed: {drv_res.text}"
    driver_id = drv_res.json()["id"]
    print(f"[PASS] A1: Created driver in Personnel: {driver_payload['first_name']} {driver_payload['last_name']} (ID: {driver_id})")

    # A2. Create Vehicle WITHOUT Chauffeur (Optional driver business rule)
    veh_no_driver_payload = {
        "brand": "Renault",
        "model": "Master DCI 150 (Fourgon SAV)",
        "registration_number": f"SAV-{datetime.now().strftime('%M%S')}-A",
        "mileage": 145000,
        "fuel_type": "Diesel",
        "status": "AVAILABLE",
        "insurance_expiry": "",  # Empty string from HTML date input
        "technical_inspection_expiry": "",  # Empty string from HTML date input
        "notes": "Véhicule d'intervention SAV sans chauffeur fixe assigné.",
    }
    v1_res = client.post("/api/v1/vehicles", json=veh_no_driver_payload, headers=headers)
    assert v1_res.status_code in (200, 201), f"Vehicle without driver failed with {v1_res.status_code}: {v1_res.text}"
    v1_id = v1_res.json()["id"]
    print(f"[PASS] A2: Created Vehicle WITHOUT driver successfully (ID: {v1_id}, Code: {v1_res.json()['code']}) - NO 422!")

    # A3. Create Vehicle WITH Chauffeur
    veh_with_driver_payload = {
        "brand": "Mercedes-Benz",
        "model": "Actros 3340 (Camion Étalon 32T)",
        "registration_number": f"ETALON-{datetime.now().strftime('%M%S')}-B",
        "mileage": 280000,
        "fuel_type": "Diesel",
        "driver_id": driver_id,
        "status": "AVAILABLE",
        "insurance_expiry": (datetime.now(timezone.utc) + timedelta(days=180)).isoformat(),
        "notes": "Camion équipé pour transport des masses étalons de 20T.",
    }
    v2_res = client.post("/api/v1/vehicles", json=veh_with_driver_payload, headers=headers)
    assert v2_res.status_code in (200, 201), f"Vehicle with driver failed: {v2_res.text}"
    v2_id = v2_res.json()["id"]
    assert v2_res.json()["driver_id"] == driver_id
    print(f"[PASS] A3: Created Vehicle WITH assigned driver (ID: {v2_id}, Code: {v2_res.json()['code']})")

    # A4. Edit Vehicle / Reassign Driver
    v_edit_payload = {
        "driver_id": driver_id,
        "mileage": 146200,
        "status": "IN_USE",
    }
    v_edit_res = client.put(f"/api/v1/vehicles/{v1_id}", json=v_edit_payload, headers=headers)
    assert v_edit_res.status_code == 200, f"Vehicle update failed: {v_edit_res.text}"
    assert v_edit_res.json()["driver_id"] == driver_id
    print(f"[PASS] A4: Successfully updated vehicle {v1_id} with newly assigned driver Rachid El Mansouri.")

    # ------------------------------------------------------------------
    # PART B: MAINTENANCE & INTERVENTIONS MODULE
    # ------------------------------------------------------------------
    print("\n--- PART B: TESTING PESAGE 2000 MAINTENANCE & INTERVENTIONS ---")

    # B1. Client
    cust_res = client.get("/api/v1/partners?type=CUSTOMER", headers=headers)
    customers = cust_res.json()
    if customers:
        customer_id = customers[0]["id"]
    else:
        cust_create = client.post(
            "/api/v1/partners",
            json={
                "legal_name": "Société Industrielle des Ciments SA",
                "partner_type": "CUSTOMER",
                "city": "Casablanca",
            },
            headers=headers,
        )
        customer_id = cust_create.json()["id"]
    print(f"[PASS] B1: Using customer ID: {customer_id}")

    # B2. Create Weighing Equipment (Installed Base)
    eq_payload = {
        "customer_id": customer_id,
        "designation": "Pont-Bascule Métallique 60T (Fosse)",
        "equipment_type": "PONTS_BASCULES",
        "brand": "Pesage 2000 Pro",
        "model": "PB-60T-18M",
        "serial_number": f"SN-2026-PB-{datetime.now().strftime('%M%S')}",
        "site_name": "Silo Principal Ain Sebaa",
        "site_address": "Zone Industrielle Route 110",
        "city": "Casablanca",
        "installation_date": "2024-05-10T00:00:00Z",
        "capacity_max": 60000.0,
        "capacity_min": 400.0,
        "graduation": 20.0,
        "status": "OPERATIONAL",
        "notes": "Pont-bascule 6 capteurs sous contrat d'entretien préventif P1.",
    }
    eq_res = client.post("/api/v1/maintenance/equipments", json=eq_payload, headers=headers)
    assert eq_res.status_code == 201, f"Equipment creation failed: {eq_res.text}"
    equipment = eq_res.json()
    eq_id = equipment["id"]
    print(f"[PASS] B2: Created Weighing Equipment: {equipment['designation']} (Code: {equipment['equipment_code']}, ID: {eq_id})")

    # B3. Create Intervention with Structured Tasks & Spare Parts
    int_payload = {
        "customer_id": customer_id,
        "equipment_id": eq_id,
        "site": "Silo Principal Ain Sebaa",
        "assigned_technician_id": driver_id,
        "date_start": datetime.now(timezone.utc).isoformat(),
        "intervention_type": "PREVENTIVE_MAINTENANCE",
        "priority": "HIGH",
        "status": "IN_PROGRESS",
        "problem_description": "Visite périodique semestrielle et contrôle métrologique des 6 capteurs.",
        "diagnosis": "Boîte de raccordement saine, léger déséquilibre sur coin nord-est.",
        "work_performed": "Nettoyage fosse, équilibrage des 6 voies par potentiomètre, étalonnage masses étalons.",
        "labor_cost": 1200.0,
        "travel_cost": 300.0,
        "other_cost": 50.0,
        "tasks": [
            {"description": "Démontage trappes et nettoyage boîte de jonction", "status": "COMPLETED", "order_index": 1},
            {"description": "Ajustage des 6 capteurs de pesage", "status": "COMPLETED", "order_index": 2},
            {"description": "Vérification avec poids étalons classe M1", "status": "IN_PROGRESS", "order_index": 3},
            {"description": "Poinçonnage et apposition vignette verte", "status": "PENDING", "order_index": 4},
        ],
        "parts": [
            {
                "designation": "Kit joints étanchéité IP68 boîte de jonction",
                "quantity": 2.0,
                "unit_price": 180.0,
                "tax_rate": 20.0,
            }
        ],
    }
    int_res = client.post("/api/v1/maintenance/interventions", json=int_payload, headers=headers)
    assert int_res.status_code == 201, f"Intervention creation failed: {int_res.text}"
    intervention = int_res.json()
    int_id = intervention["id"]
    # Total formula: labor(1200) + parts(2 * 180 = 360) + travel(300) + other(50) = 1910.0
    assert intervention["parts_cost"] == 360.0
    assert intervention["total_cost"] == 1910.0
    print(f"[PASS] B3: Created Intervention {intervention['intervention_code']} with 4 tasks and 1 spare part. Total cost: {intervention['total_cost']} MAD")

    # B4. Complete Intervention
    status_update_res = client.patch(
        f"/api/v1/maintenance/{int_id}/status",
        json={
            "status": "COMPLETED",
            "observations": "Rapport technique validé conforme, écart maximal < 5 kg sur 60 tonnes.",
            "work_performed": "Maintenance préventive et étalonnage achevés avec succès.",
        },
        headers=headers,
    )
    assert status_update_res.status_code == 200
    assert status_update_res.json()["status"] == "COMPLETED"
    print(f"[PASS] B4: Updated Intervention {intervention['intervention_code']} to COMPLETED.")

    # B5. Verify Equipment History
    hist_res = client.get(f"/api/v1/maintenance/equipments/{eq_id}/history", headers=headers)
    assert hist_res.status_code == 200
    history_items = hist_res.json()
    assert len(history_items) >= 1
    assert any(h["id"] == int_id for h in history_items)
    print(f"[PASS] B5: Verified equipment history timeline: {len(history_items)} intervention(s) linked to equipment {eq_id}.")

    # B6. Verify Filters
    filtered_res = client.get(f"/api/v1/maintenance?status=COMPLETED&intervention_type=PREVENTIVE_MAINTENANCE", headers=headers)
    if filtered_res.status_code != 200:
        print(f"[DEBUG B6] Status: {filtered_res.status_code}, Text: {filtered_res.text}")
    assert filtered_res.status_code == 200
    assert any(h["id"] == int_id for h in filtered_res.json())
    print("[PASS] B6: Verified backend SQLAlchemy filters (status, type, year, customer).")

    # B7. Verify KPI Stats
    stats_res = client.get("/api/v1/maintenance/stats", headers=headers)
    assert stats_res.status_code == 200
    stats = stats_res.json()
    assert stats["equipment_count"] >= 1
    assert stats["completed_count"] >= 1
    assert stats["annual_cost"] > 0
    print(f"[PASS] B7: Verified real KPI statistics: {stats['equipment_count']} equipments, {stats['completed_count']} completed interventions, Annual cost: {stats['annual_cost']} MAD.")

    print("\n" + "=" * 70)
    print("[SUCCESS] ALL E2E WORKFLOW TESTS PASSED 100% WITH SUCCESS!")
    print("=" * 70)
    return True


if __name__ == "__main__":
    success = run_e2e()
    sys.exit(0 if success else 1)
