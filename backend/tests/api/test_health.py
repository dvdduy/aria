def test_health_returns_status(client):
    response = client.get("/health")

    assert response.status_code == 200
    body = response.json()
    assert body["status"] in {"healthy", "degraded"}
    assert body["version"] == "0.1.0-test"
    assert set(body["checks"].keys()) == {"database", "redis"}
