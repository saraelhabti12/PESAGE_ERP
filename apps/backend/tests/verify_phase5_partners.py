import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi.testclient import TestClient
from app.main import app

def run_verification():
    client = TestClient(app)

    print("==================================================")
    print("PHASE 5 — BUSINESS PARTNERS VERIFICATION")
    print("==================================================")

    # 1. Admin Login
    print("\n1. Testing Admin Authentication...")
    r = client.post("/api/v1/auth/login", json={"email": "admin@example.com", "password": "CHANGE_THIS_PASSWORD"})
    assert r.status_code == 200, f"Admin login failed: {r.text}"
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("  -> Admin authenticated successfully.")

    # 2. Create Customer
    print("\n2. Creating Customer (Client)...")
    customer_payload = {
        "code": "CLI-VERIF-001",
        "legal_name": "Afriquia Gaz Distribution",
        "trade_name": "Afriquia Gaz",
        "partner_type": "CUSTOMER",
        "ice": "001524389000045",
        "tax_id": "33445566",
        "registration_number": "12345 Casablanca",
        "phone": "+212522112233",
        "email": "contact@afriquia-gaz.ma",
        "city": "Casablanca",
        "country": "Maroc",
        "address": "Km 7 Route d'El Jadida",
        "notes": "Grand compte industriel",
        "is_active": True,
    }
    r = client.post("/api/v1/partners", json=customer_payload, headers=headers)
    assert r.status_code == 201, f"Failed: {r.text}"
    customer = r.json()
    cust_id = customer["id"]
    print(f"  -> Customer created with ID {cust_id} and Code {customer['code']}.")

    # 3. Create Supplier
    print("\n3. Creating Supplier (Fournisseur)...")
    supplier_payload = {
        "code": "FRS-VERIF-001",
        "legal_name": "Mettler Toledo Maroc SARL",
        "trade_name": "Mettler Toledo",
        "partner_type": "SUPPLIER",
        "ice": "001889977000012",
        "tax_id": "77889900",
        "registration_number": "54321 Casablanca",
        "phone": "+212522445566",
        "email": "sales@mettler-toledo.ma",
        "city": "Casablanca",
        "country": "Maroc",
        "address": "Zone Industrielle Sidi Maarouf",
        "notes": "Fournisseur principal capteurs et indicateurs de pesage",
        "is_active": True,
    }
    r = client.post("/api/v1/partners", json=supplier_payload, headers=headers)
    assert r.status_code == 201, f"Failed: {r.text}"
    supplier = r.json()
    supp_id = supplier["id"]
    print(f"  -> Supplier created with ID {supp_id} and Code {supplier['code']}.")

    # 4. Create Dual Customer/Supplier
    print("\n4. Creating Dual Partner (Client & Fournisseur)...")
    dual_payload = {
        "code": "DUAL-VERIF-001",
        "legal_name": "Pesage & Automatismes du Nord",
        "trade_name": "PAN Tanger",
        "partner_type": "CUSTOMER_SUPPLIER",
        "ice": "002998877000033",
        "city": "Tanger",
        "country": "Maroc",
        "is_active": True,
    }
    r = client.post("/api/v1/partners", json=dual_payload, headers=headers)
    assert r.status_code == 201
    dual_id = r.json()["id"]
    print(f"  -> Dual Partner created with ID {dual_id}.")

    # 5. Check Endpoint Filtering
    print("\n5. Testing /customers and /suppliers endpoint segregation...")
    r_cust = client.get("/api/v1/customers", headers=headers)
    assert r_cust.status_code == 200
    cust_ids = [c["id"] for c in r_cust.json()]
    assert cust_id in cust_ids
    assert dual_id in cust_ids
    assert supp_id not in cust_ids
    print(f"  -> /customers correctly returned {len(r_cust.json())} clients (excluding supplier-only).")

    r_supp = client.get("/api/v1/suppliers", headers=headers)
    assert r_supp.status_code == 200
    supp_ids = [s["id"] for s in r_supp.json()]
    assert supp_id in supp_ids
    assert dual_id in supp_ids
    assert cust_id not in supp_ids
    print(f"  -> /suppliers correctly returned {len(r_supp.json())} suppliers (excluding customer-only).")

    # 6. Add Contacts to Customer
    print("\n6. Adding Contacts to Customer...")
    r_c1 = client.post(
        f"/api/v1/partners/{cust_id}/contacts",
        json={
            "first_name": "Hassan",
            "last_name": "Tazi",
            "position": "Responsable Maintenance & Pesage",
            "phone": "0661223344",
            "email": "h.tazi@afriquia-gaz.ma",
            "is_primary": True,
        },
        headers=headers,
    )
    assert r_c1.status_code == 201
    c1_id = r_c1.json()["id"]
    assert r_c1.json()["is_primary"] is True

    r_c2 = client.post(
        f"/api/v1/partners/{cust_id}/contacts",
        json={
            "first_name": "Youssef",
            "last_name": "Mansouri",
            "position": "Directeur des Achats",
            "phone": "0661998877",
            "email": "y.mansouri@afriquia-gaz.ma",
            "is_primary": True,
        },
        headers=headers,
    )
    assert r_c2.status_code == 201
    assert r_c2.json()["is_primary"] is True

    # Verify primary contact switch
    r_contacts = client.get(f"/api/v1/partners/{cust_id}/contacts", headers=headers)
    contacts_list = r_contacts.json()
    assert len(contacts_list) == 2
    assert next(c for c in contacts_list if c["id"] == c1_id)["is_primary"] is False
    assert next(c for c in contacts_list if c["id"] == r_c2.json()["id"])["is_primary"] is True
    print(f"  -> 2 contacts added and primary switch verified.")

    # 7. Add Addresses to Customer
    print("\n7. Adding Addresses to Customer...")
    r_a1 = client.post(
        f"/api/v1/partners/{cust_id}/addresses",
        json={
            "type": "MAIN",
            "label": "Siège Administratif",
            "address_line": "Km 7 Route d'El Jadida",
            "city": "Casablanca",
            "postal_code": "20200",
            "country": "Maroc",
            "is_primary": True,
        },
        headers=headers,
    )
    assert r_a1.status_code == 201
    assert r_a1.json()["is_primary"] is True

    r_a2 = client.post(
        f"/api/v1/partners/{cust_id}/addresses",
        json={
            "type": "SHIPPING",
            "label": "Centre Emplisseur Jorf Lasfar",
            "address_line": "Zone Portuaire Jorf Lasfar",
            "city": "El Jadida",
            "postal_code": "24000",
            "country": "Maroc",
            "is_primary": False,
        },
        headers=headers,
    )
    assert r_a2.status_code == 201
    print(f"  -> 2 addresses (Main and Shipping) added successfully.")

    # 8. Check Partner Detailed View
    print("\n8. Checking Partner Detailed Profile...")
    r_detail = client.get(f"/api/v1/partners/{cust_id}", headers=headers)
    assert r_detail.status_code == 200
    detail = r_detail.json()
    assert len(detail["contacts"]) == 2
    assert len(detail["addresses"]) == 2
    print(f"  -> Detailed partner profile contains {len(detail['contacts'])} contacts and {len(detail['addresses'])} addresses.")

    print("\n==================================================")
    print("ALL PHASE 5 VERIFICATIONS PASSED SUCCESSFULLY!")
    print("==================================================")

if __name__ == "__main__":
    run_verification()
