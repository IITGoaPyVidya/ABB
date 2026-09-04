# Test Strategy

- **Unit/API workflow:** `src/tests/test_workflow.py` uses a temporary SQLite database and FastAPI TestClient.
- **Covered rules:** production approval gate, invalid lifecycle transition, deployment idempotency, failed deployment retry, successful production rollback, and structured errors.
- **Seed/integration path:** `src/config/seed.py` deterministically imports the supplied registry, deployment events, and metrics artifacts. Docker enables it with `SEED_DATA=true`.
- **Frontend:** strict Angular compilation is the current UI check; the app uses injectable `HttpClient` and explicit loading, empty, and failure fallbacks. A future increment should add Karma tests for service failures and action controls.
- **E2E scenario:** register model, add version, advance through validation/approval, deploy with an idempotency key, inspect events/metrics, and roll back.

Tests are isolated from live systems and do not depend on execution order.
