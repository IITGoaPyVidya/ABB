# Test Strategy

- **Unit/API workflow:** `src/tests/test_workflow.py` uses a temporary SQLite database and FastAPI TestClient.
- **Covered rules:** production approval gate, invalid lifecycle transition, version comparison, monitoring summary fields, deployment idempotency including changed-payload conflicts, failed deployment retry, successful production rollback, and structured errors.
- **Seed/integration path:** `src/config/seed.py` deterministically imports the supplied registry, deployment events, and metrics artifacts. Docker enables it with `SEED_DATA=true`.
- **Frontend:** `app.component.spec.ts` covers component rendering, inventory HTTP failure visibility, and model registration through `HttpTestingController`. `npm test -- --watch=false` is the non-interactive check, alongside strict production compilation.
- **E2E scenario:** register model, add version, advance through validation/approval, deploy with an idempotency key, inspect events/metrics, and roll back.

Tests are isolated from live systems and do not depend on execution order.
