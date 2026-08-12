from fastapi import status


def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["application"] == "ERP Platform"
    assert data["status"] == "running"


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "ok"
    assert "environment" in data
    assert "version" in data


def test_health_api_v1_endpoint(client):
    response = client.get("/api/v1/health")
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "ok"


def test_db_health_endpoint(client):
    response = client.get("/health/db")
    # Will return 200 OK if PostgreSQL container is running, or 503 Service Unavailable if offline
    assert response.status_code in (status.HTTP_200_OK, status.HTTP_503_SERVICE_UNAVAILABLE)
    data = response.json()
    if response.status_code == status.HTTP_200_OK:
        assert data["status"] == "ok"
        assert data["database"] == "connected"
    else:
        assert data["error"]["code"] == status.HTTP_503_SERVICE_UNAVAILABLE
