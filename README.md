# MLOps Platform Technical Assignment

**Role level:** G13 Senior Software Engineer

A compact model registry and deployment control room demonstrating model registration, version records, lifecycle approval, deterministic deployment simulation, event history, retry/rollback, and monitoring metrics.

## Stack

FastAPI, Pydantic, SQLite, pytest, Angular 17 standalone components, strict TypeScript, and Docker Compose.

## Run locally

```powershell
py -3 -m pip install -r src/backend/requirements.txt
$env:PYTHONPATH="src"
py -3 -m uvicorn backend.app:app --reload
```

Open `http://localhost:8000/docs` for interactive API documentation. Set `$env:SEED_DATA="true"` before starting to load the supplied artifacts. Run the Angular console separately with `cd src/frontend; npm install; npm start`, then open `http://localhost:4200`.

The complete packaged setup is `docker compose up --build`; it serves the API on port 8000 and console on port 4200 with seeded data.

## Tests

```powershell
py -3 -m pytest src/tests -q
cd src/frontend
npm run build
```

## Workflow

Register a model and version, advance it through `VALIDATED` and `APPROVED`, request production deployment with `X-Idempotency-Key`, inspect events and metrics, then retry a simulated failure or roll back a successful production deployment.

See [architecture](src/documentation/architecture.md), [API reference](src/documentation/api.md), and [test strategy](src/documentation/test-strategy.md). Sample data and the initial API contract remain in `artifacts/`.

## Known limitations

Deployment is synchronous and simulated. Authentication, authorization, real model serving, queues, Kubernetes, cloud storage, and PostgreSQL migrations are deliberately outside this assignment slice.
