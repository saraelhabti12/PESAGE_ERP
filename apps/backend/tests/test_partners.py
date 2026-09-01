import pytest
from fastapi.testclient import TestClient


def get_auth_header(client: TestClient, email: str = "admin@example.com", password: str = "CHANGE_THIS_PASSWORD") -> dict:
    r = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, f"Login failed: {r.text}"
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


# ----------------------------------------------------
# 1. PARTNER CRUD & VALIDATIONS
# ----------------------------------------------------
def test_partner_crud_and_validations(client: TestClient):
    headers = get_auth_header(client)

    # Create Partner (Client)
    payload = {
        "code": "CLI-TEST-001",
        "legal_name": "Société Industrielle de Casablanca SARL",
        "trade_name": "SIC Maroc",
        "partner_type": "CUSTOMER",
        "ice": "001234567890001",
        "tax_id": "12345678",
        "registration_number": "998877 Casa",
        "phone": "+212522000111",
        "email": "contact@sic-maroc.ma",
        "website": "https://sic-maroc.ma",
        "address": "123 Bd Zerktouni",
        "city": "Casablanca",
        "country": "Maroc",
        "postal_code": "20000",
        "notes": "Client VIP",
        "is_active": True,
    }
    r = client.post("/api/v1/partners", json=payload, headers=headers)
    assert r.status_code == 201, f"Create partner failed: {r.text}"
    partner = r.json()
    assert partner["code"] == "CLI-TEST-001"
    assert partner["legal_name"] == "Société Industrielle de Casablanca SARL"
    assert partner["partner_type"] == "CUSTOMER"
    partner_id = partner["id"]

    # Duplicate Code Rejection
    r_dup = client.post("/api/v1/partners", json=payload, headers=headers)
    assert r_dup.status_code == 409
    assert "déjà utilisé" in r_dup.json()["error"]["message"]

    # Get Partner by ID
    r_get = client.get(f"/api/v1/partners/{partner_id}", headers=headers)
    assert r_get.status_code == 200
    detail = r_get.json()
    assert detail["id"] == partner_id
    assert "contacts" in detail
    assert "addresses" in detail

    # Update Partner
    r_upd = client.put(
        f"/api/v1/partners/{partner_id}",
        json={"trade_name": "SIC Nouvelle Version", "city": "Mohammedia"},
        headers=headers,
    )
    assert r_upd.status_code == 200
    assert r_upd.json()["trade_name"] == "SIC Nouvelle Version"
    assert r_upd.json()["city"] == "Mohammedia"

    # Soft Delete (Deactivate) Partner
    r_del = client.delete(f"/api/v1/partners/{partner_id}", headers=headers)
    assert r_del.status_code == 200
    assert r_del.json()["is_active"] is False

    # Reactivate Partner
    r_reactivate = client.put(
        f"/api/v1/partners/{partner_id}",
        json={"is_active": True},
        headers=headers,
    )
    assert r_reactivate.status_code == 200
    assert r_reactivate.json()["is_active"] is True


# ----------------------------------------------------
# 2. CUSTOMER & SUPPLIER FILTERED ENDPOINTS
# ----------------------------------------------------
def test_customer_and_supplier_endpoints_filtering(client: TestClient):
    headers = get_auth_header(client)

    # 1. Create CUSTOMER
    r_c = client.post(
        "/api/v1/partners",
        json={
            "code": "CLI-ONLY-01",
            "legal_name": "Client Pur SARL",
            "partner_type": "CUSTOMER",
        },
        headers=headers,
    )
    assert r_c.status_code == 201
    c_id = r_c.json()["id"]

    # 2. Create SUPPLIER
    r_s = client.post(
        "/api/v1/partners",
        json={
            "code": "SUP-ONLY-01",
            "legal_name": "Fournisseur Pur SA",
            "partner_type": "SUPPLIER",
        },
        headers=headers,
    )
    assert r_s.status_code == 201
    s_id = r_s.json()["id"]

    # 3. Create CUSTOMER_SUPPLIER
    r_both = client.post(
        "/api/v1/partners",
        json={
            "code": "BOTH-01",
            "legal_name": "Partenaire Mixte SARL",
            "partner_type": "CUSTOMER_SUPPLIER",
        },
        headers=headers,
    )
    assert r_both.status_code == 201
    both_id = r_both.json()["id"]

    # Test GET /api/v1/customers
    r_customers = client.get("/api/v1/customers", headers=headers)
    assert r_customers.status_code == 200
    customer_ids = [p["id"] for p in r_customers.json()]
    assert c_id in customer_ids
    assert both_id in customer_ids
    assert s_id not in customer_ids

    # Test GET /api/v1/suppliers
    r_suppliers = client.get("/api/v1/suppliers", headers=headers)
    assert r_suppliers.status_code == 200
    supplier_ids = [p["id"] for p in r_suppliers.json()]
    assert s_id in supplier_ids
    assert both_id in supplier_ids
    assert c_id not in supplier_ids

    # Test GET /api/v1/customers/{id}
    assert client.get(f"/api/v1/customers/{c_id}", headers=headers).status_code == 200
    assert client.get(f"/api/v1/customers/{both_id}", headers=headers).status_code == 200
    assert client.get(f"/api/v1/customers/{s_id}", headers=headers).status_code == 404

    # Test GET /api/v1/suppliers/{id}
    assert client.get(f"/api/v1/suppliers/{s_id}", headers=headers).status_code == 200
    assert client.get(f"/api/v1/suppliers/{both_id}", headers=headers).status_code == 200
    assert client.get(f"/api/v1/suppliers/{c_id}", headers=headers).status_code == 404


# ----------------------------------------------------
# 3. CONTACTS CRUD & PRIMARY FLAG TOGGLING
# ----------------------------------------------------
def test_partner_contacts_crud(client: TestClient):
    headers = get_auth_header(client)

    # Create partner
    r_p = client.post(
        "/api/v1/partners",
        json={"code": "CLI-CONT-01", "legal_name": "Test Contacts SARL", "partner_type": "CUSTOMER"},
        headers=headers,
    )
    p_id = r_p.json()["id"]

    # 1. Create first contact (should auto-become primary if first)
    r_c1 = client.post(
        f"/api/v1/partners/{p_id}/contacts",
        json={
            "first_name": "Karim",
            "last_name": "Benjelloun",
            "position": "Directeur Général",
            "phone": "0661000001",
            "email": "karim@test.ma",
            "is_primary": True,
        },
        headers=headers,
    )
    assert r_c1.status_code == 201
    c1 = r_c1.json()
    assert c1["is_primary"] is True
    c1_id = c1["id"]

    # 2. Create second contact with is_primary=True (should demote c1)
    r_c2 = client.post(
        f"/api/v1/partners/{p_id}/contacts",
        json={
            "first_name": "Samira",
            "last_name": "Alami",
            "position": "Responsable Achats",
            "phone": "0661000002",
            "email": "samira@test.ma",
            "is_primary": True,
        },
        headers=headers,
    )
    assert r_c2.status_code == 201
    c2 = r_c2.json()
    assert c2["is_primary"] is True
    c2_id = c2["id"]

    # Verify c1 is no longer primary
    contacts = client.get(f"/api/v1/partners/{p_id}/contacts", headers=headers).json()
    c1_fetched = next(c for c in contacts if c["id"] == c1_id)
    c2_fetched = next(c for c in contacts if c["id"] == c2_id)
    assert c1_fetched["is_primary"] is False
    assert c2_fetched["is_primary"] is True

    # 3. Update contact 1 to primary again
    r_upd = client.put(
        f"/api/v1/partners/{p_id}/contacts/{c1_id}",
        json={"is_primary": True, "position": "Président Directeur Général"},
        headers=headers,
    )
    assert r_upd.status_code == 200
    assert r_upd.json()["is_primary"] is True
    assert r_upd.json()["position"] == "Président Directeur Général"

    # Verify c2 is now demoted
    contacts_after = client.get(f"/api/v1/partners/{p_id}/contacts", headers=headers).json()
    assert next(c for c in contacts_after if c["id"] == c1_id)["is_primary"] is True
    assert next(c for c in contacts_after if c["id"] == c2_id)["is_primary"] is False

    # 4. Delete contact
    r_del = client.delete(f"/api/v1/partners/{p_id}/contacts/{c2_id}", headers=headers)
    assert r_del.status_code == 200
    contacts_final = client.get(f"/api/v1/partners/{p_id}/contacts", headers=headers).json()
    assert len(contacts_final) == 1
    assert contacts_final[0]["id"] == c1_id


# ----------------------------------------------------
# 4. ADDRESSES CRUD & PRIMARY FLAG TOGGLING
# ----------------------------------------------------
def test_partner_addresses_crud(client: TestClient):
    headers = get_auth_header(client)

    # Create partner
    r_p = client.post(
        "/api/v1/partners",
        json={"code": "CLI-ADDR-01", "legal_name": "Test Addresses SARL", "partner_type": "CUSTOMER"},
        headers=headers,
    )
    p_id = r_p.json()["id"]

    # 1. Create main address
    r_a1 = client.post(
        f"/api/v1/partners/{p_id}/addresses",
        json={
            "type": "MAIN",
            "label": "Siège Social",
            "address_line": "15 Rue Allal Ben Abdellah",
            "city": "Rabat",
            "postal_code": "10000",
            "country": "Maroc",
            "is_primary": True,
        },
        headers=headers,
    )
    assert r_a1.status_code == 201
    a1_id = r_a1.json()["id"]
    assert r_a1.json()["is_primary"] is True

    # 2. Create shipping address with is_primary=True
    r_a2 = client.post(
        f"/api/v1/partners/{p_id}/addresses",
        json={
            "type": "SHIPPING",
            "label": "Dépôt Tanger Med",
            "address_line": "Zone Franche Logistique",
            "city": "Tanger",
            "postal_code": "90000",
            "country": "Maroc",
            "is_primary": True,
        },
        headers=headers,
    )
    assert r_a2.status_code == 201
    a2_id = r_a2.json()["id"]
    assert r_a2.json()["is_primary"] is True

    # Verify a1 is no longer primary
    addresses = client.get(f"/api/v1/partners/{p_id}/addresses", headers=headers).json()
    assert next(a for a in addresses if a["id"] == a1_id)["is_primary"] is False
    assert next(a for a in addresses if a["id"] == a2_id)["is_primary"] is True

    # 3. Update a1
    r_upd = client.put(
        f"/api/v1/partners/{p_id}/addresses/{a1_id}",
        json={"label": "Siège Principal Rabat"},
        headers=headers,
    )
    assert r_upd.status_code == 200
    assert r_upd.json()["label"] == "Siège Principal Rabat"

    # 4. Delete a2
    r_del = client.delete(f"/api/v1/partners/{p_id}/addresses/{a2_id}", headers=headers)
    assert r_del.status_code == 200
    addresses_final = client.get(f"/api/v1/partners/{p_id}/addresses", headers=headers).json()
    assert len(addresses_final) == 1


# ----------------------------------------------------
# 5. SEARCH AND FILTERING
# ----------------------------------------------------
def test_partner_search_and_filtering(client: TestClient):
    headers = get_auth_header(client)

    client.post(
        "/api/v1/partners",
        json={"code": "CLI-SEARCH-1", "legal_name": "Agro Alimentaire du Sud", "city": "Agadir", "ice": "111222333444555"},
        headers=headers,
    )
    client.post(
        "/api/v1/partners",
        json={"code": "CLI-SEARCH-2", "legal_name": "Textile du Nord", "city": "Tanger", "ice": "999888777666555"},
        headers=headers,
    )

    # Search by code
    r = client.get("/api/v1/partners?search=SEARCH-1", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["code"] == "CLI-SEARCH-1"

    # Search by city
    r_city = client.get("/api/v1/partners?search=Tanger", headers=headers)
    assert r_city.status_code == 200
    assert len(r_city.json()) == 1
    assert r_city.json()[0]["city"] == "Tanger"

    # Search by ICE
    r_ice = client.get("/api/v1/partners?search=111222333", headers=headers)
    assert r_ice.status_code == 200
    assert len(r_ice.json()) == 1
    assert r_ice.json()[0]["ice"] == "111222333444555"
