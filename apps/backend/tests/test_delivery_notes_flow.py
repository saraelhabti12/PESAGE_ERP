import pytest
from fastapi.testclient import TestClient
from app.core.config import settings
from tests.test_commercial_cycle import get_admin_headers, setup_customer_and_product


def test_delivery_note_complete_lifecycle(client: TestClient):
    headers = get_admin_headers(client)
    cust_id, prod_id, wh_id = setup_customer_and_product(client, headers)

    # 1. Create and confirm a sale with 50 units
    sale_res = client.post(
        "/api/v1/sales",
        headers=headers,
        json={
            "customer_id": cust_id,
            "payment_terms": "30 jours",
            "items": [
                {
                    "product_id": prod_id,
                    "warehouse_id": wh_id,
                    "quantity": 50.0,
                    "unit_price_ht": 1000.0,
                    "discount_rate": 0.0,
                    "tax_rate": 20.0,
                }
            ],
        },
    )
    assert sale_res.status_code == 201
    sale = sale_res.json()
    sale_id = sale["id"]
    sale_item_id = sale["items"][0]["id"]

    # Initial stock is 50. Confirm sale -> stock decreases to 0
    conf_res = client.post(f"/api/v1/sales/{sale_id}/confirm", headers=headers)
    assert conf_res.status_code == 200
    assert conf_res.json()["status"] == "CONFIRMED"

    # Verify stock after confirmation
    bal_res = client.get(f"/api/v1/stock/balance?product_id={prod_id}&warehouse_id={wh_id}", headers=headers)
    assert bal_res.status_code == 200
    assert bal_res.json()["available_quantity"] == 0.0

    # 2. Check delivery progress endpoint
    prog_res = client.get(f"/api/v1/delivery-notes/sales/{sale_id}/delivery-progress", headers=headers)
    assert prog_res.status_code == 200
    prog_data = prog_res.json()
    assert prog_data["sale_id"] == sale_id
    assert prog_data["sale_status"] == "CONFIRMED"
    assert len(prog_data["items"]) == 1
    assert prog_data["items"][0]["sale_item_id"] == sale_item_id
    assert prog_data["items"][0]["ordered_quantity"] == 50.0
    assert prog_data["items"][0]["delivered_quantity"] == 0.0
    assert prog_data["items"][0]["remaining_quantity"] == 50.0

    # 3. Create partial delivery note (20 units) using sale_item_id
    dn1_res = client.post(
        "/api/v1/delivery-notes",
        headers=headers,
        json={
            "sale_id": sale_id,
            "shipping_address": "123 Rue Principale",
            "tracking_number": "TRK-9988",
            "items": [
                {
                    "sale_item_id": sale_item_id,
                    "delivered_quantity": 20.0,
                    "notes": "Colis 1",
                }
            ],
        },
    )
    assert dn1_res.status_code == 201
    dn1 = dn1_res.json()
    assert dn1["reference"].startswith("BL-")
    assert dn1["items"][0]["ordered_quantity"] == 50.0
    assert dn1["items"][0]["delivered_quantity"] == 20.0
    assert dn1["items"][0]["remaining_quantity"] == 30.0

    # Sale status must now be PARTIALLY_DELIVERED
    sale_check = client.get(f"/api/v1/sales/{sale_id}", headers=headers).json()
    assert sale_check["status"] == "PARTIALLY_DELIVERED"

    # Stock must NOT change (still 0.0)
    bal_check1 = client.get(f"/api/v1/stock/balance?product_id={prod_id}&warehouse_id={wh_id}", headers=headers).json()
    assert bal_check1["available_quantity"] == 0.0

    # 4. Check progress again -> remaining is 30.0
    prog_res2 = client.get(f"/api/v1/delivery-notes/sales/{sale_id}/delivery-progress", headers=headers)
    assert prog_res2.status_code == 200
    assert prog_res2.json()["items"][0]["delivered_quantity"] == 20.0
    assert prog_res2.json()["items"][0]["remaining_quantity"] == 30.0

    # 5. Over-delivery attempt (attempt to deliver 35 when remaining is 30) -> MUST fail
    over_res = client.post(
        "/api/v1/delivery-notes",
        headers=headers,
        json={
            "sale_id": sale_id,
            "items": [
                {
                    "sale_item_id": sale_item_id,
                    "delivered_quantity": 35.0,
                }
            ],
        },
    )
    assert over_res.status_code == 400
    assert "supérieure au reste à livrer" in over_res.text

    # 6. Deliver remaining 30 units -> Full delivery
    dn2_res = client.post(
        "/api/v1/delivery-notes",
        headers=headers,
        json={
            "sale_id": sale_id,
            "items": [
                {
                    "sale_item_id": sale_item_id,
                    "delivered_quantity": 30.0,
                }
            ],
        },
    )
    assert dn2_res.status_code == 201
    dn2 = dn2_res.json()
    assert dn2["items"][0]["remaining_quantity"] == 0.0

    # Sale status must now be DELIVERED
    sale_check2 = client.get(f"/api/v1/sales/{sale_id}", headers=headers).json()
    assert sale_check2["status"] == "DELIVERED"

    # Stock must STILL NOT change (still 0.0)
    bal_check2 = client.get(f"/api/v1/stock/balance?product_id={prod_id}&warehouse_id={wh_id}", headers=headers).json()
    assert bal_check2["available_quantity"] == 0.0
