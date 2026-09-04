# Test Strategy

## Automated checks

- Backend workflow tests use FastAPI `TestClient` and temporary SQLite databases.
- Angular tests use Karma, Jasmine, `HttpTestingController`, and headless Chrome.
- CI runs Ruff, Python compilation, pytest, Angular tests, and Angular production build.

## Covered behavior

- Model and version registration
- Lifecycle transition validation and production approval gate
- Version comparison
- Monitoring summary fields
- Idempotency and changed-payload conflicts
- Failed deployment retry
- Successful production rollback
- Structured error responses
- Angular rendering, API error visibility, registration, lifecycle actions, comparison, retry, and rollback

## Manual UI checks

Use [`../testing_Ui.md`](../testing_Ui.md) for the click-by-click scenarios, including responsive layout and evidence capture.
