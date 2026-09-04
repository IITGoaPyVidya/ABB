# MLOps Platform Technical Assignment

**Role level:** G13 Senior Software Engineer

A compact model registry and deployment control room demonstrating model registration, version records, lifecycle approval, deterministic deployment simulation, event history, retry/rollback, and monitoring metrics.

## Problem statement

Industrial teams need one operational surface to decide which model version is releasable, compare candidates, deploy it safely, and see whether production behavior is healthy. This assignment implements that workflow with persisted state and deterministic local data, without hiding it behind external infrastructure.

## Stack

FastAPI, Pydantic, SQLite, pytest, Angular 17 standalone components, strict TypeScript, and Docker Compose.

## Run locally

```powershell
py -3 -m pip install -r src/backend/requirements.txt
$env:PYTHONPATH="src"
py -3 -m uvicorn backend.app:app --reload
```

Open `http://localhost:8000/docs` for interactive API documentation. Set `$env:SEED_DATA="true"` before starting to load the supplied artifacts. Run the Angular console separately with `cd src/frontend; npm install; npm start`, then open `http://localhost:4200`.

## Run with Docker Compose

Prerequisites: Docker Desktop with Docker Compose available.

From the repository root, build and start the backend and Angular console:

```powershell
docker compose up --build
```

The services are then available at:

- Angular UI: `http://localhost:4200`
- FastAPI Swagger documentation: `http://localhost:8000/docs`
- Backend health check: `http://localhost:8000/health`

The Compose setup enables seeded sample data. To start the stack in the background:

```powershell
docker compose up --build -d
docker compose ps
```

To stop the services:

```powershell
docker compose down
```

To remove the persisted SQLite Docker volume and reload the sample data from a clean state:

```powershell
docker compose down -v
docker compose up --build
```

## Tests

```powershell
py -3 -m pytest src/tests -q
cd src/frontend
npm test -- --watch=false
npm run build
```

## Workflow

Register a model and version, advance it through `VALIDATED` and `APPROVED`, request production deployment with `X-Idempotency-Key`, inspect events and metrics, then retry a simulated failure or roll back a successful production deployment.

See [architecture](src/documentation/architecture.md), [API reference](src/documentation/api.md), and [test strategy](src/documentation/test-strategy.md). Sample data and the initial API contract remain in `artifacts/`.

The architecture diagram is maintained as Mermaid source in the architecture document. No screenshots are claimed here; capture them from the seeded local or Docker UI as submission evidence.

## Known limitations

Deployment is synchronous and simulated. Authentication, authorization, real model serving, queues, Kubernetes, cloud storage, and PostgreSQL migrations are deliberately outside this assignment slice.

## Future improvements

Add authentication and audit identity, a real serving adapter with asynchronous deployment workers, PostgreSQL migrations for multi-instance operation, richer metric aggregation and alerting, and browser E2E coverage.
