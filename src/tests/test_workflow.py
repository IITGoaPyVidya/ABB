import pytest
from fastapi.testclient import TestClient

from backend import app as api


@pytest.fixture
def client(tmp_path, monkeypatch):
    api.store = api.Store(tmp_path / "test.db")
    with TestClient(api.app) as test_client:
        yield test_client


def register(client):
    assert client.post("/models", json={"model_id": "demo-model", "name": "Demo", "owner": "Platform", "framework": "sklearn"}).status_code == 201
    assert client.post("/models/demo-model/versions", json={"version": "1.0.0", "artifact_uri": "file:///model"}).status_code == 201


def test_production_requires_approval_and_workflow_can_rollback(client):
    register(client)
    denied = client.post("/deployments", json={"model_id": "demo-model", "version": "1.0.0", "environment": "production"})
    assert denied.status_code == 422
    assert denied.json()["detail"]["code"] == "APPROVAL_REQUIRED"

    assert client.post("/models/demo-model/versions/1.0.0/lifecycle", json={"stage": "VALIDATED"}).status_code == 200
    assert client.post("/models/demo-model/versions/1.0.0/lifecycle", json={"stage": "APPROVED"}).status_code == 200
    deployment = client.post("/deployments", headers={"X-Idempotency-Key": "demo-deploy"}, json={"model_id": "demo-model", "version": "1.0.0", "environment": "production"})
    assert deployment.status_code == 202
    deployment_id = deployment.json()["deployment_id"]
    duplicate = client.post("/deployments", headers={"X-Idempotency-Key": "demo-deploy"}, json={"model_id": "demo-model", "version": "1.0.0", "environment": "production"})
    assert duplicate.json()["deployment_id"] == deployment_id
    rolled_back = client.post(f"/deployments/{deployment_id}/rollback")
    assert rolled_back.json()["status"] == "ROLLED_BACK"


def test_failed_deployment_can_retry_once(client):
    register(client)
    assert client.post("/models/demo-model/versions/1.0.0/lifecycle", json={"stage": "VALIDATED"}).status_code == 200
    failed = client.post("/deployments", json={"model_id": "demo-model", "version": "1.0.0", "environment": "staging", "simulate_failure": True})
    deployment_id = failed.json()["deployment_id"]
    retried = client.post(f"/deployments/{deployment_id}/retry")
    assert retried.status_code == 202
    assert retried.json()["status"] == "SUCCEEDED"
    assert client.post(f"/deployments/{deployment_id}/retry").status_code == 409


def test_invalid_lifecycle_transition_is_rejected(client):
    register(client)
    response = client.post("/models/demo-model/versions/1.0.0/lifecycle", json={"stage": "PRODUCTION"})
    assert response.status_code == 409
    assert response.json()["detail"]["code"] == "INVALID_LIFECYCLE_TRANSITION"
